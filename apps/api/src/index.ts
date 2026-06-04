import dotenv from 'dotenv';
dotenv.config();

// Sentry MUST be initialised before any other module that we want instrumented
// (express, http, prisma, etc.). The dotenv.config() above must run first so
// instrument.ts can read SENTRY_DSN from the environment.
import './instrument';
import * as Sentry from '@sentry/node';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import * as xlsx from 'xlsx';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { smsService } from './services/sms.service';
import { watiService } from './services/wati.service';
import { apifyService } from './services/apify.service';
import { sendApplicationReceivedEmail, sendStoreApprovedEmail, sendStoreRejectedEmail, sendStoreNeedsInfoEmail, sendAdminInviteEmail } from './services/email.service';
import { NotificationService } from './services/notification.service';
import { initScheduledJobs } from './services/scheduled-jobs';
import { parseArrivalTime } from './utils/parseArrivalTime';
import staffRouter from './routes/staff';
import bookingsRouter from './routes/bookings';

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3000;

// --- Request Logger ---
app.use((req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    next();
});

app.disable('x-powered-by');
const prisma = new PrismaClient();
const notificationService = new NotificationService(prisma);

// Mount scheduled background jobs (node-cron) — runs every 1 minute.
// Jobs: pickup/dining reminders + order_requests expiry. See scheduled-jobs.ts.
initScheduledJobs(prisma, notificationService);

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Supabase Admin Client (for server-side user creation via service_role key)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// --- Middleware ---
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

// --- Staff RBAC Routes ---
app.use('/api/staff', staffRouter);

// --- Table Booking Routes ---
app.use('/bookings', bookingsRouter);

// --- Helper Functions ---
async function getAuthUser(req: express.Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid token');
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
        throw new Error('Unauthorized');
    }
    return user;
}

// Guard: admin-only route. Writes 401/403 directly and returns null on failure;
// caller does `const u = await requireAdmin(req, res); if (!u) return;`.
// Matches the inline pattern at /admin/allowlist (~3747). Used by coupon admin routes.
async function requireAdmin(req: express.Request, res: express.Response) {
    let caller;
    try {
        caller = await getAuthUser(req);
    } catch {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    const callerProfile = await prisma.user.findUnique({
        where: { id: caller.id },
        select: { isAdmin: true, role: true },
    });
    // Per the 2026-06-02 RBAC doc, requireAdmin = SUPER_ADMIN only (governance tier).
    // The legacy isAdmin flag is treated as SUPER_ADMIN equivalent for backwards
    // compatibility. OPERATIONS / FINANCE / SUPPORT do NOT pass requireAdmin — use
    // requireRole(['SUPER_ADMIN', 'OPERATIONS', …]) for per-route role checks.
    const ok =
        !!callerProfile &&
        (callerProfile.isAdmin === true || callerProfile.role === 'SUPER_ADMIN');
    if (!ok) {
        res.status(403).json({ error: 'Super-admin access required' });
        return null;
    }
    return caller;
}

/**
 * Generic RBAC guard. Pass an allowed-roles list; SUPER_ADMIN is always allowed.
 *
 *   const u = await requireRole(req, res, ['OPERATIONS', 'FINANCE']); if (!u) return;
 *
 * Per the 2026-06-02 RBAC doc:
 *   SUPER_ADMIN   founder/eng — unrestricted; always passes
 *   OPERATIONS    daily marketplace ops
 *   FINANCE       settlements + payouts + reconciliation
 *   SUPPORT       customer support (mostly view-only)
 *
 * The legacy `isAdmin: true` flag is treated as SUPER_ADMIN equivalent for
 * backwards compatibility with users who pre-date the Role enum.
 */
async function requireRole(
    req: express.Request,
    res: express.Response,
    allowedRoles: ReadonlyArray<'SUPER_ADMIN' | 'OPERATIONS' | 'FINANCE' | 'SUPPORT'>,
) {
    let caller;
    try {
        caller = await getAuthUser(req);
    } catch {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    const callerProfile = await prisma.user.findUnique({
        where: { id: caller.id },
        select: { isAdmin: true, role: true },
    });
    if (!callerProfile) {
        res.status(403).json({ error: 'Access denied' });
        return null;
    }
    // SUPER_ADMIN always allowed; isAdmin flag treated as SUPER_ADMIN.
    if (callerProfile.role === 'SUPER_ADMIN' || callerProfile.isAdmin === true) {
        return caller;
    }
    if (callerProfile.role && allowedRoles.includes(callerProfile.role as any)) {
        return caller;
    }
    res.status(403).json({ error: 'Insufficient role for this action' });
    return null;
}

// Guard: any logged-in user. Writes 401 directly and returns null on failure;
// caller does `const u = await requireUser(req, res); if (!u) return;`.
// Used by consumer-side coupon routes (/coupons/available, validate-coupon, redeem)
// so we derive userId from the verified token instead of trusting the request body.
async function requireUser(req: express.Request, res: express.Response) {
    try {
        return await getAuthUser(req);
    } catch {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
}

async function logAudit(productId: string, action: string, field: string | null, oldValue: any, newValue: any, changedBy: string = 'System') {
    try {
        await prisma.productAuditLog.create({
            data: {
                productId,
                action,
                field,
                oldValue: oldValue ? String(oldValue) : null,
                newValue: newValue ? String(newValue) : null,
                changedBy
            }
        });
    } catch (error) {
        console.error('Failed to create audit log', error);
    }
}

// --- MOCK DATABASE (In-Memory Fallback) ---
// This allows the app to work fully even without a PostgreSQL connection.
let MOCK_PRODUCTS: any[] = [
    {
        id: 'mock-1',
        name: 'Amul Gold Milk',
        description: 'Full cream milk',
        mrp: 68,
        category: 'Dairy & Milk',
        vertical: 'Grocery & Kirana',
        brand: 'Amul',
        ean: '8901262010043',
        image: 'https://m.media-amazon.com/images/I/61lzZAgv5GL.jpg',
        images: [{ id: 'img-1', url: 'https://m.media-amazon.com/images/I/61lzZAgv5GL.jpg', isPrimary: true }],
        unitType: 'ml',
        unitValue: 500,
        hsnCode: '0401',
        gstRate: 5,
        createdAt: new Date().toISOString()
    },
    {
        id: 'mock-2',
        name: 'Britannia Good Day',
        description: 'Cashew Cookies',
        mrp: 30,
        category: 'Bakery',
        brand: 'Britannia',
        ean: '8901063010023',
        image: 'https://m.media-amazon.com/images/I/71uOt9s-uEL.jpg',
        images: [],
        unitType: 'g',
        unitValue: 200,
        hsnCode: '1905',
        gstRate: 18,
        createdAt: new Date().toISOString()
    },
    {
        id: 'mock-3',
        name: 'Tata Salt',
        description: 'Iodized Salt 1kg',
        mrp: 28,
        category: 'Staples',
        brand: 'Tata',
        ean: '8901063000000',
        image: 'https://m.media-amazon.com/images/I/61K-uO6v1IL._AC_UF1000,1000_QL80_.jpg',
        images: [],
        unitType: 'kg',
        unitValue: 1,
        hsnCode: '2501',
        gstRate: 0,
        createdAt: new Date().toISOString()
    }
];

// Helper to update mock data
const updateMockProduct = (id: string, updates: any) => {
    const idx = MOCK_PRODUCTS.findIndex(p => p.id === id);
    if (idx !== -1) {
        MOCK_PRODUCTS[idx] = { ...MOCK_PRODUCTS[idx], ...updates };
        return MOCK_PRODUCTS[idx];
    }
    return null;
};

const addMockImage = (productId: string, url: string, name: string, isPrimary: boolean) => {
    const product = MOCK_PRODUCTS.find(p => p.id === productId);
    if (product) {
        if (!product.images) product.images = [];
        const newImg = { id: `img-${Date.now()}`, url, name, isPrimary, productId };
        product.images.push(newImg);
        // Update main image if primary
        if (isPrimary || product.images.length === 1) {
            product.image = url;
        }
        return newImg;
    }
    return null;
};

// --- Routes ---

const crypto = require('crypto');
const Razorpay = require('razorpay');
let razorpayInstance: any = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}

app.post('/payments/create-order', async (req, res) => {
    try {
        if (!razorpayInstance) return res.status(500).json({ error: 'Razorpay not configured' });
        
        const { amount, type = 'consumer', userId = 'unknown', notes = {} } = req.body;
        if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Valid amount is required' });

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.floor(100 + Math.random() * 900);
        const prefix = type === 'merchant' ? 'SUB' : 'PAS';
        const receipt = `${prefix}-${dateStr}-${String(userId).slice(0, 4).toUpperCase()}-${randomStr}`;

        const options = {
            amount: Math.round(Number(amount) * 100), // convert to paise
            currency: 'INR',
            receipt,
            notes
        };

        const order = await razorpayInstance.orders.create(options);
        res.json({ order_id: order.id, receipt, amount: options.amount, currency: options.currency, details: order });
    } catch (error: any) {
        console.error('Failed to create Razorpay order:', error);
        res.status(500).json({ error: 'Order creation failed', details: error.message });
    }
});

app.post('/payments/verify', (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing required signature payload' });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            res.json({ success: true, message: 'Payment verified successfully' });
        } else {
            res.status(400).json({ success: false, error: 'Invalid signature' });
        }
    } catch (error: any) {
        console.error('Signature verification failed:', error);
        res.status(500).json({ error: 'Verification failed', details: error.message });
    }
});

/**
 * GET /payments/methods
 * List saved payment tokens for the authenticated user.
 * Mandate 2: Lazy Customer Creation (Return [] if no ID exists)
 */
app.get('/payments/methods', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { razorpayCustomerId: true }
        });

        if (!profile?.razorpayCustomerId) {
            return res.json([]);
        }

        if (!razorpayInstance) return res.status(500).json({ error: 'Razorpay not configured' });

        const tokens = await razorpayInstance.customers.fetchTokens(profile.razorpayCustomerId);
        res.json(tokens.items || []);
    } catch (error: any) {
        const status = (error.message === 'Unauthorized' || error.message === 'Missing or invalid token') ? 401 : 500;
        // Smarter Error Handling
        if (error.code === 'BAD_REQUEST_ERROR') return res.status(400).json({ error: error.description });
        res.status(status).json({ error: error.message });
    }
});

/**
 * DELETE /payments/methods/:tokenId
 * Mandate 1: Prevent IDOR (Strict ownership verification)
 */
app.delete('/payments/methods/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        const user = await getAuthUser(req);
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { razorpayCustomerId: true }
        });

        if (!profile?.razorpayCustomerId) {
            return res.status(403).json({ error: 'Forbidden: No associated payment account' });
        }

        if (!razorpayInstance) return res.status(500).json({ error: 'Razorpay not configured' });

        // Mandate 1: Fetch first to verify customer_id ownership
        let rzpToken;
        try {
            rzpToken = await razorpayInstance.tokens.fetch(tokenId);
        } catch (err: any) {
            if (err.code === 'BAD_REQUEST_ERROR') return res.status(404).json({ error: 'Payment method not found' });
            throw err;
        }

        if (rzpToken.customer_id !== profile.razorpayCustomerId) {
            console.error(`[SECURITY] IDOR attempt detected! User ${user.id} tried to delete token ${tokenId}`);
            return res.status(403).json({ error: 'Forbidden: You do not own this payment method' });
        }

        await razorpayInstance.tokens.delete(tokenId);
        res.json({ success: true, message: 'Payment method deleted' });
    } catch (error: any) {
        const status = (error.message === 'Unauthorized' || error.message === 'Missing or invalid token') ? 401 : 500;
        if (error.code === 'BAD_REQUEST_ERROR') return res.status(400).json({ error: error.description });
        res.status(status).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('PickAtStore API is running 🚀');
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), service: 'pick-at-store-api' });
});

// Get Products
// Get Products (with Filtering & Pagination)
app.get('/products', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search,
            category,
            vertical,
            brand,
            minPrice,
            maxPrice,
            gstRate,

            missingData,
            type = 'global' // 'global' | 'custom' | 'all'
        } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // Build Filter Conditions
        const where: any = {};

        // Filter by Type
        if (type === 'global') {
            where.createdByStoreId = null;
        } else if (type === 'custom') {
            where.createdByStoreId = { not: null };
        }

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { ean: { contains: String(search) } }
            ];
        }

        if (category) {
            where.category = { in: String(category).split(',') };
        }

        if (vertical) {
            where.vertical = { in: String(vertical).split(',') };
        }

        if (brand) {
            where.brand = { in: String(brand).split(',') };
        }

        if (gstRate) {
            where.gstRate = { in: String(gstRate).split(',').map(Number) };
        }

        if (minPrice || maxPrice) {
            where.mrp = {};
            if (minPrice) where.mrp.gte = Number(minPrice);
            if (maxPrice) where.mrp.lte = Number(maxPrice);
        }

        if (missingData) {
            const missing = String(missingData).split(',');
            if (missing.includes('image')) where.image = null;
            if (missing.includes('brand')) where.brand = null;
            if (missing.includes('hsn')) where.hsnCode = null;
        }

        // Execute Query with Pagination
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: { images: true }
            }),
            prisma.product.count({ where })
        ]);

        res.json({
            data: products,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / take)
            }
        });
    } catch (error) {
        console.error('Products API Error:', error);
        // Fallback for dev only - usually wouldn't do this in prod but keeping for safety
        res.json({ data: MOCK_PRODUCTS, pagination: { total: MOCK_PRODUCTS.length, page: 1, limit: 100, totalPages: 1 } });
    }
});

// Excel Template Download
app.get('/products/template', async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();

        // 1. Create Data Sheet
        const worksheet = workbook.addWorksheet('Template');
        worksheet.columns = [
            { header: 'name', key: 'name', width: 30 },
            { header: 'mrp', key: 'mrp', width: 15 },
            { header: 'vertical', key: 'vertical', width: 20 },
            { header: 'category', key: 'category', width: 20 },
            { header: 'brand', key: 'brand', width: 20 },
            { header: 'ean', key: 'ean', width: 20 },
            { header: 'unitType', key: 'unitType', width: 12 },
            { header: 'unitValue', key: 'unitValue', width: 12 },
            { header: 'hsnCode', key: 'hsnCode', width: 15 },
            { header: 'gstRate', key: 'gstRate', width: 10 },
            { header: 'image', key: 'image', width: 40 }
        ];

        // 2. Create Reference Sheet (Hidden)
        const refSheet = workbook.addWorksheet('RefData');
        refSheet.state = 'hidden';

        const verticals = ['Grocery & Kirana', 'Restaurants & Cafes', 'Bakeries & Desserts', 'Meat & Seafood', 'Pharmacy & Wellness', 'Electronics & Accessories', 'Fashion & Apparel', 'Home & Lifestyle', 'Beauty & Personal Care', 'Pet Care & Supplies'];
        const categories = ['Dairy & Milk', 'Staples & Pulse', 'Snacks & Munchies', 'Beverages', 'Personal Care', 'Home Essentials', 'Fruits & Vegetables', 'Ready-to-Eat'];
        const unitTypes = ['ml', 'L', 'kg', 'g', 'pc'];
        const gstRates = [0, 5, 12, 18, 28];

        // Populate RefData: Column A = Verticals, B = Categories, C = Unit Types, D = GST Rates
        verticals.forEach((v, i) => refSheet.getCell(`A${i + 1}`).value = v);
        categories.forEach((c, i) => refSheet.getCell(`B${i + 1}`).value = c);
        unitTypes.forEach((u, i) => refSheet.getCell(`C${i + 1}`).value = u);
        gstRates.forEach((g, i) => refSheet.getCell(`D${i + 1}`).value = g);

        // 3. Apply Data Validations (Rows 2-1000)
        for (let i = 2; i <= 1000; i++) {
            // Vertical (Column C)
            worksheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$A$1:$A$${verticals.length}`]
            };
            // Category (Column D)
            worksheet.getCell(`D${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$B$1:$B$${categories.length}`]
            };
            // Unit Type (Column F)
            worksheet.getCell(`F${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$B$1:$B$${unitTypes.length}`]
            };
            // GST Rate (Column I)
            worksheet.getCell(`I${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$C$1:$C$${gstRates.length}`]
            };
        }

        // 4. Formatting header
        worksheet.getRow(1).font = { bold: true };

        // 5. Sample Row
        worksheet.addRow({
            name: 'Amul Gold Milk',
            mrp: 34,
            vertical: 'Grocery & Kirana',
            category: 'Dairy & Milk',
            brand: 'Amul',
            ean: '8901262010043',
            unitType: 'ml',
            unitValue: 500,
            hsnCode: '0401',
            gstRate: 5,
            image: ''
        });

        // Response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Template generation failed:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Export Products
// Export Products
app.get('/products/export', async (req, res) => {
    try {
        const products = await prisma.product.findMany();
        const data = products.map(p => ({
            name: p.name,
            mrp: p.mrp,
            vertical: p.subcategory,
            category: p.subcategory,
            brand: p.brand,
            ean: p.ean,
            image: p.image,
            id: p.id
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Products');
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=products_export.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to export products' });
    }
});

// Export Selected Products (Template Format)
app.post('/products/export-selected', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No product IDs provided' });
        }

        const products = await prisma.product.findMany({
            where: { id: { in: ids } }
        });

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Export');

        // Define Columns (Matching Template)
        worksheet.columns = [
            { header: 'name', key: 'name', width: 30 },
            { header: 'mrp', key: 'mrp', width: 15 },
            { header: 'vertical', key: 'vertical', width: 20 },
            { header: 'category', key: 'category', width: 20 },
            { header: 'brand', key: 'brand', width: 20 },
            { header: 'ean', key: 'ean', width: 20 },
            { header: 'unitType', key: 'unitType', width: 12 },
            { header: 'unitValue', key: 'unitValue', width: 12 },
            { header: 'hsnCode', key: 'hsnCode', width: 15 },
            { header: 'gstRate', key: 'gstRate', width: 10 },
            { header: 'image', key: 'image', width: 40 }
        ];

        // Add Data
        products.forEach(p => {
            worksheet.addRow({
                name: p.name,
                mrp: p.mrp,
                vertical: p.subcategory,
                category: p.subcategory,
                brand: p.brand,
                ean: p.ean,
                unitType: p.unitType,
                unitValue: p.unitValue,
                hsnCode: p.hsnCode,
                gstRate: p.gstRate,
                image: p.image
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=selected_products_export.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export selected failed:', error);
        res.status(500).json({ error: 'Failed to export selected products' });
    }
});

const upload = multer({ dest: 'uploads/' });

// Image Upload to Supabase Storage
app.post('/products/upload-image', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const fileContent = fs.readFileSync(req.file.path);
        // Sanitize filename
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${Date.now()}-${safeName}`;

        const BUCKET_NAME = 'products';

        // DIRECT UPLOAD STRATEGY
        // We skip checking listBuckets() because RLS policies often hide buckets from the Anon Key.
        // We assume the bucket 'products' exists (as verified by user).

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, fileContent, {
                contentType: req.file.mimetype,
                upsert: false
            });

        // Clean up temp file immediately
        fs.unlinkSync(req.file.path);

        if (error) {
            console.error('Supabase upload error:', error);
            const err = error as any;
            // Help the user debug specific policy errors
            if (err.statusCode === '403' || err.error === 'Unauthorized') {
                return res.status(500).json({
                    error: `Upload failed (Access Denied). Please check your Supabase Storage Policies for the '${BUCKET_NAME}' bucket.`
                });
            }
            if (err.statusCode === '404' || err.error === 'Bucket not found') {
                return res.status(500).json({
                    error: `Bucket '${BUCKET_NAME}' not found. Please ensure it exists and is Public.`
                });
            }
            return res.status(500).json({ error: 'Supabase upload failed', details: error.message });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        res.json({ url: publicUrl });
    } catch (error) {
        console.error('Upload failed:', error);
        // Ensure cleanup on error
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// --- Catalog Sync (Live Sync) ---

// Memory lock to prevent race conditions where webhook and polling process the same dataset concurrently
const processedDatasets = new Set<string>();

async function processScraperDataset(datasetId: string) {
    if (processedDatasets.has(datasetId)) {
        console.log(`[Sync] Dataset ${datasetId} already processed. Skipping to prevent race conditions.`);
        return { status: 'SUCCEEDED', itemsCount: 0, itemsAdded: 0, message: 'Dataset already processed.' };
    }
    processedDatasets.add(datasetId);

    const items = await apifyService.getDatasetItems(datasetId);
    
    // Helper to remove \u0000 unicode characters from strings that crash Prisma/Postgres
    const sanitizeNullBytes = (str: string | null | undefined): string | null => {
        if (!str) return str as any;
        return str.replace(/\u0000/g, '');
    };

    const mapCategory = (rawCategory: string | null): { vertical: string, category: string } => {
        if (!rawCategory) return { vertical: 'Grocery & Kirana', category: 'General' };
        const lowerCat = rawCategory.toLowerCase();
        
        // 1. Fresh Items (Fruits & Vegetables)
        if (lowerCat.includes('fruit') || lowerCat.includes('veg') || lowerCat.includes('produce'))
            return { vertical: 'Fresh Items', category: 'Fresh Produce' };

        // 2. Pharmacy & Wellness (Includes Personal Care/Hygiene)
        if (lowerCat.includes('pharmacy') || lowerCat.includes('wellness') || lowerCat.includes('med') || 
            lowerCat.includes('personal care') || lowerCat.includes('hygiene') || lowerCat.includes('skin') ||
            lowerCat.includes('hair') || lowerCat.includes('dent') || lowerCat.includes('soap') || lowerCat.includes('shampoo'))
            return { vertical: 'Pharmacy & Wellness', category: 'Personal Care' };

        // 3. Home & Lifestyle (Includes Home Essentials/Cleaning)
        if (lowerCat.includes('home') || lowerCat.includes('lifestyle') || lowerCat.includes('cleaning') || 
            lowerCat.includes('detergent') || lowerCat.includes('household') || lowerCat.includes('kitchen') || 
            lowerCat.includes('essential'))
            return { vertical: 'Home & Lifestyle', category: 'Home Essentials' };

        // 4. Grocery & Kirana (Staples, Dairy, Snacks, Beverages)
        if (lowerCat.includes('dairy') || lowerCat.includes('milk') || lowerCat.includes('paneer') || lowerCat.includes('cheese') || lowerCat.includes('egg')) 
            return { vertical: 'Grocery & Kirana', category: 'Dairy & Milk' };
        if (lowerCat.includes('staple') || lowerCat.includes('rice') || lowerCat.includes('dal') || lowerCat.includes('flour') || lowerCat.includes('atta') || lowerCat.includes('masala')) 
            return { vertical: 'Grocery & Kirana', category: 'Staples & Pulse' };
        if (lowerCat.includes('biscuit') || lowerCat.includes('snack') || lowerCat.includes('chip') || lowerCat.includes('namkeen')) 
            return { vertical: 'Grocery & Kirana', category: 'Snacks & Munchies' };
        if (lowerCat.includes('beverage') || lowerCat.includes('drink') || lowerCat.includes('soda') || lowerCat.includes('juice')) 
            return { vertical: 'Grocery & Kirana', category: 'Beverages' };
            
        return { vertical: 'Grocery & Kirana', category: 'General' };
    };

    // Pre-fetch taxonomy lookup maps for resolving category strings → UUIDs
    const allVerticals = await (prisma as any).vertical.findMany({ select: { id: true, name: true } });
    const allTier2Categories = await (prisma as any).tier2Category.findMany({
        select: { id: true, name: true, verticalId: true }
    });
    const verticalMap = new Map<string, string>(allVerticals.map((v: any) => [v.name, v.id]));
    const categoryLookup = new Map<string, string>(
        allTier2Categories.map((c: any) => [`${c.verticalId}::${c.name}`, c.id])
    );

    const sanitizeScraperData = (obj: any): any => {
        if (typeof obj === 'string') return sanitizeNullBytes(obj);
        if (Array.isArray(obj)) return obj.map(sanitizeScraperData);
        if (obj !== null && typeof obj === 'object') {
            const cleanObj: any = {};
            for (const [k, v] of Object.entries(obj)) {
                cleanObj[k] = sanitizeScraperData(v);
            }
            return cleanObj;
        }
        return obj;
    };

    let itemsAdded = 0;
    for (const itemDataRaw of items) {
        try {
            const itemData = sanitizeScraperData(itemDataRaw);
            // Scraper payload has a nested `item` structure
            const entry = itemData?.item || itemData;
            const productData = entry?.product || entry;
            
            const name = sanitizeNullBytes(productData?.name) || 'Unknown';
            
            // Brand Normalization
            let rawBrand = sanitizeNullBytes(productData?.brand) || sanitizeNullBytes(productData?.brand_name) || null;
            const junkBrands = ['fruits', 'vegetables', 'fresh', 'cut', 'chilean kiwi', 'indian', 'imported', 'organic'];
            let brand = 'Unbranded';
            if (rawBrand && !junkBrands.includes(rawBrand.toLowerCase().trim())) {
                brand = rawBrand;
            }

            // Packsize Extraction
            const packsize = sanitizeNullBytes(entry?.productVariant?.formattedPacksize) || 
                             sanitizeNullBytes(productData?.formattedPacksize) || 
                             sanitizeNullBytes(itemData?.formatted_packsize) || 
                             sanitizeNullBytes(entry?.quantity ? `${entry.quantity} ${entry.unitOfMeasure || ''}` : null) || 
                             null;
            
            // MRP Logic
            let rawMrp = entry?.mrp || entry?.price?.mrp || 0;
            let rawSp = entry?.sellingPrice || entry?.discountedSellingPrice || entry?.price?.sp || 0;
            const mrp = rawMrp > 1000 ? rawMrp / 100 : rawMrp;
            const sellingPrice = rawSp > 1000 ? rawSp / 100 : rawSp;

            const rawCategory = sanitizeNullBytes(entry?.primaryCategoryName) || sanitizeNullBytes(productData?.category);
            const { vertical, category } = mapCategory(rawCategory);
            // Resolve mapped category/vertical strings to taxonomy UUIDs
            const resolvedVerticalId = verticalMap.get(vertical) || null;
            const resolvedCategoryId = resolvedVerticalId
                ? (categoryLookup.get(`${resolvedVerticalId}::${category}`) || null)
                : null;
            const subcategory = sanitizeNullBytes(entry?.primarySubcategoryName) || sanitizeNullBytes(productData?.subcategory) || null;
            const sourceProductId = String(productData?.id || itemData?.sku_id || itemData?.id);
            
            if (!sourceProductId || sourceProductId === 'undefined') continue;

            // Extract image
            let image = null;
            if (entry?.productVariant?.images && entry.productVariant.images.length > 0) {
                const imgPath = entry.productVariant.images[0].path;
                image = imgPath ? `https://cdn.zeptonow.com/production/${imgPath}` : null;
            } else if (itemData?.images && itemData.images.length > 0) {
                const imgPath = itemData.images[0];
                if (imgPath && !imgPath.startsWith('http')) {
                    image = `https://cdn.zeptonow.com/production/${imgPath}`;
                } else {
                    image = imgPath;
                }
            }

            // Raw data insertion for Phase 2
            await (prisma as any).syncQueue.upsert({
                where: { sourceProductId: sourceProductId },
                update: {
                    status: 'PENDING',
                    name,
                    brand,
                    mrp: mrp > 0 ? mrp : sellingPrice,
                    subcategory,
                    packsize,
                    image,
                    metadata: itemData as any,
                    vertical_id: resolvedVerticalId,
                    category_id: resolvedCategoryId,
                },
                create: {
                    name,
                    brand,
                    mrp: mrp > 0 ? mrp : sellingPrice,
                    subcategory,
                    packsize,
                    image,
                    sourceProductId,
                    status: 'PENDING',
                    metadata: itemData as any,
                    vertical_id: resolvedVerticalId,
                    category_id: resolvedCategoryId,
                }
            });
            itemsAdded++;
        } catch (dbError) {
            console.error('Failed to queue item:', itemDataRaw?.item?.product?.name || itemDataRaw?.name, dbError);
        }
    }

    return { 
        status: 'SUCCEEDED', 
        itemsCount: items.length,
        itemsAdded,
        message: `Successfully processed ${itemsAdded} items into the sync queue.`
    };
}

// Trigger a new sync run
app.post('/catalog/sync/trigger', async (req, res) => {
    try {
        const { queries, location = 'Mumbai', limit = 20 } = req.body;
        
        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            return res.status(400).json({ error: 'At least one search query is required' });
        }

        // Phase 8: Smart Category Sync
        // If a query matches a Smart Category key, we expand it into a massive array of specific keywords
        // to bypass the 20-keyword limit and 0-hit broad keyword limit.
        const SMART_CATEGORIES: Record<string, string[]> = {
            '[SMART] Medicines': [
                'Paracetamol', 'Dolo', 'Vicks', 'Band Aid', 'Digene', 'Eno', 'Volini', 
                'Saridon', 'Revital', 'ORSL', 'Electral', 'Pudin Hara', 'Hajmola', 'Zandu',
                'Moov', 'Iodex', 'Amrutanjan', 'Strepsils', 'Honitus', 'Benadryl', 'Crocin',
                'Combiflam', 'B-Complex', 'Vitamin C', 'Zincovit', 'Becosules', 'Cough Syrup',
                'Betadine', 'Savlon', 'Dettol', 'Thermometer', 'Pregnancy Test', 'Odomos'
            ],
            '[SMART] Fruits & Vegetables': [
                'Apple', 'Banana', 'Mango', 'Orange', 'Papaya', 'Watermelon', 'Grapes', 'Pomegranate',
                'Onion', 'Potato', 'Tomato', 'Garlic', 'Ginger', 'Chilli', 'Lemon', 'Carrot', 
                'Cucumber', 'Capsicum', 'Cabbage', 'Cauliflower', 'Brinjal', 'Bhindi', 'Okra',
                'Spinach', 'Palak', 'Coriander', 'Mint', 'Methi', 'Bottle Gourd', 'Bitter Gourd',
                'Coconut', 'Mushroom', 'Sweet Corn', 'Avocado', 'Kiwi', 'Strawberry', 'Broccoli'
            ],
            '[SMART] Spices & Masalas': [
                'Turmeric', 'Haldi', 'Red Chilli', 'Lal Mirch', 'Coriander Powder', 'Dhaniya', 
                'Jeera', 'Cumin', 'Garam Masala', 'Mustard Seeds', 'Rai', 'Black Pepper', 'Kali Mirch',
                'Cardamom', 'Elaichi', 'Cinnamon', 'Dalchini', 'Cloves', 'Laung', 'Hing', 'Asafoetida',
                'Fenugreek', 'Methi Seeds', 'Fennel', 'Saunf', 'Meat Masala', 'Chicken Masala',
                'Kitchen King', 'Chat Masala', 'Pav Bhaji Masala', 'Chhole Masala', 'Sambar Powder'
            ],
            '[SMART] Staples & Pulses': [
                'Atta', 'Wheat Flour', 'Maida', 'Besan', 'Sooji', 'Rawa', 'Sugar', 'Jaggery', 'Salt',
                'Toor Dal', 'Arhar Dal', 'Moong Dal', 'Urad Dal', 'Chana Dal', 'Masoor Dal', 
                'Rajma', 'Kabuli Chana', 'Soya Chunks', 'Poha', 'Murmura', 'Rice', 'Basmati Rice',
                'Sona Masoori', 'Idli Rice', 'Brown Rice', 'Peanuts', 'Mungfali', 'Mustard Oil',
                'Sunflower Oil', 'Groundnut Oil', 'Olive Oil', 'Ghee'
            ]
        };

        // Expand queries
        let expandedQueries: string[] = [];
        let isSmartSync = false;
        for (const q of queries) {
            if (SMART_CATEGORIES[q]) {
                expandedQueries.push(...SMART_CATEGORIES[q]);
                isSmartSync = true;
            } else {
                expandedQueries.push(q);
            }
        }

        // Deduplicate just in case
        expandedQueries = [...new Set(expandedQueries)];

        // Force limit to 20 ONLY for smart syncs to maximize total distinct yield per Apify actor rules without timing out
        const finalLimit = isSmartSync ? 20 : limit;

        const run = await apifyService.triggerLiveSync(expandedQueries, location, finalLimit);
        const runData = run.data || run;
        
        res.json({ 
            success: true, 
            message: 'Live sync triggered successfully',
            runId: runData.id,
            status: runData.status
        });
    } catch (error: any) {
        console.error('Sync Trigger Error:', error);
        res.status(500).json({ error: 'Failed to trigger sync', details: error.message });
    }
});

// Get run status and fetch results to queue
app.get('/catalog/sync/status/:runId', async (req, res) => {
    try {
        const { runId } = req.params;
        const result = await apifyService.getRunStatus(runId);
        const run = result?.data || result; // Handle Apify's { data: { ... } } response wrapper

        if (run.status === 'SUCCEEDED') {
            const datasetId = run.defaultDatasetId;
            const result = await processScraperDataset(datasetId);
            return res.json(result);
        }

        res.json({ status: run.status, progress: run.status });
    } catch (error: any) {
        console.error('Sync Status Error:', error);
        res.status(500).json({ error: 'Failed to fetch sync status', details: error.message });
    }
});

// Webhook listener for Apify
app.post('/catalog/sync/webhook', async (req, res) => {
    try {
        const { eventType, resource } = req.body;
        // Check if it's the specific SUCCEEDED event from Apify
        if (eventType === 'ACTOR.RUN.SUCCEEDED' && resource?.defaultDatasetId) {
            console.log(`[Webhook] Processing successful scrape for dataset ${resource.defaultDatasetId}`);
            await processScraperDataset(resource.defaultDatasetId);
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Server Error');
    }
});

// Get current sync queue
app.get('/catalog/sync/queue', async (req, res) => {
    try {
        const queue = await (prisma as any).syncQueue.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            include: { Vertical: { select: { name: true } }, Tier2Category: { select: { name: true } } }
        });
        // Flatten relation names into top-level fields the frontend expects
        const mapped = queue.map((item: any) => ({
            ...item,
            vertical: item.Vertical?.name || null,
            category: item.Tier2Category?.name || null,
        }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sync queue' });
    }
});

// --- AUDIT LOGGING HELPERS ---
async function logBulkAudit(items: any[], action: string, changedBy: string = 'system', tx?: any) {
    if (items.length === 0) return;
    const client = tx || prisma;
    const logs = items.map(p => ({
        id: crypto.randomUUID(),
        productId: p.id,
        action,
        field: p.changedFields || 'bulk_operation',
        newValue: JSON.stringify(p.updateData || p.item || {}),
        changedAt: new Date(),
        changedBy
    }));
    return (client as any).productAuditLog.createMany({ data: logs });
}

// --- TAXONOMY VALIDATION HELPER ---
async function validateTaxonomy(verticalId: string, category_id: string): Promise<boolean> {
    const category = await (prisma as any).tier2Category.findUnique({
        where: { id: category_id }
    });
    return category && category.verticalId === verticalId;
}

// Get All Verticals and Categories (API-driven taxonomy)
app.get('/verticals', async (req, res) => {
    try {
        const verticals = await prisma.vertical.findMany({
            select: {
                id: true,
                name: true,
                requiresFssai: true,
                isPremium: true,
                isDining: true,
                isGrocery: true,
                isBakery: true
            },
            orderBy: { name: 'asc' }
        });
        res.json(verticals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch verticals' });
    }
});

// Delete Vertical (Atomic with Product Audit)
app.delete('/verticals/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.$transaction(async (tx) => {
            const affectedProducts = await (tx as any).product.findMany({
                where: { verticalId: id },
                select: { id: true }
            });

            if (affectedProducts.length > 0) {
                await logBulkAudit(affectedProducts.map((p: any) => ({ 
                    id: p.id, 
                    item: { note: 'Uncategorized due to Vertical deletion' } 
                })), 'VERTICAL_DELETED_UNCATEGORIZED', 'admin', tx);
            }

            await (tx as any).vertical.delete({ where: { id } });
        });
        res.json({ success: true, message: 'Vertical deleted and products gracefully uncategorized' });
    } catch (error) {
        console.error('Vertical deletion error:', error);
        res.status(500).json({ error: 'Failed to delete vertical' });
    }
});

// Delete Category (Atomic with Product Audit)
app.delete('/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.$transaction(async (tx) => {
            const affectedProducts = await (tx as any).product.findMany({
                where: { category_id: id },
                select: { id: true }
            });

            if (affectedProducts.length > 0) {
                await logBulkAudit(affectedProducts.map((p: any) => ({ 
                    id: p.id, 
                    item: { note: 'Uncategorized due to Category deletion' } 
                })), 'CATEGORY_DELETED_UNCATEGORIZED', 'admin', tx);
            }

            await (tx as any).tier2Category.delete({ where: { id } });
        });
        res.json({ success: true, message: 'Category deleted and products gracefully uncategorized' });
    } catch (error) {
        console.error('Category deletion error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Approve items from sync queue to master catalog (O(1) Raw SQL Batch)
app.post('/catalog/sync/approve', async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Valid items array required' });
    }

    try {
        // 1. Pre-fetch taxonomy for resolving string names → UUIDs
        //    Handles: pre-resolved UUIDs from scraper, user-edited dropdown strings, and nulls
        const allVerticals = await (prisma as any).vertical.findMany({ select: { id: true, name: true } });
        const allTier2Cats = await (prisma as any).tier2Category.findMany({
            select: { id: true, name: true, verticalId: true }
        });
        const vertNameToId = new Map<string, string>(allVerticals.map((v: any) => [v.name, v.id]));
        const catNameToId = new Map<string, string>(
            allTier2Cats.map((c: any) => [`${c.verticalId}::${c.name}`, c.id])
        );

        // 2. Resolve each item's vertical_id and category_id
        const resolvedItems = items.map((item: any) => {
            // Prefer string name lookup (catches user edits), fall back to existing UUID
            let vId = item.vertical ? (vertNameToId.get(item.vertical) || null) : (item.vertical_id || null);
            let cId: string | null = null;
            if (vId) {
                const catName = item.category;
                cId = catName ? (catNameToId.get(`${vId}::${catName}`) || null) : (item.category_id || null);
            }
            return { ...item, resolved_vertical_id: vId, resolved_category_id: cId };
        });

        // 3. Pre-validation: Taxonomy Integrity Check
        for (const item of resolvedItems) {
            if (item.resolved_vertical_id && item.resolved_category_id) {
                const isValid = await validateTaxonomy(item.resolved_vertical_id, item.resolved_category_id);
                if (!isValid) {
                    return res.status(400).json({
                        error: `Invalid Category/Vertical pairing for item: ${item.name}`,
                        itemId: item.id
                    });
                }
            }
        }

        await prisma.$transaction(async (tx) => {
            // 4. High-Performance Bulk Upsert via Raw SQL
            for (const item of resolvedItems) {
                const sourceId = item.source_product_id || item.sourceProductId;
                const vId = item.resolved_vertical_id || null;
                const cId = item.resolved_category_id || null;
                await tx.$executeRaw`
                    INSERT INTO "Product" (
                        id, name, brand, mrp, image, uom, source, source_product_id,
                        vertical_id, category_id, "updatedAt", "createdAt"
                    ) VALUES (
                        ${crypto.randomUUID()}, ${item.name}, ${item.brand}, ${Number(item.mrp)},
                        ${item.image}, ${item.packsize || item.uom}, 'purchased_catalog',
                        ${sourceId}, ${vId}::uuid, ${cId}::uuid,
                        NOW(), NOW()
                    )
                    ON CONFLICT (source_product_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        brand = EXCLUDED.brand,
                        mrp = EXCLUDED.mrp,
                        image = EXCLUDED.image,
                        uom = EXCLUDED.uom,
                        vertical_id = EXCLUDED.vertical_id,
                        category_id = EXCLUDED.category_id,
                        "updatedAt" = NOW()
                `;
            }

            // 5. Batched Audit (Inside Transaction for Atomicity)
            const auditProducts = await (tx as any).product.findMany({
                where: { sourceProductId: { in: resolvedItems.map((i: any) => i.source_product_id || i.sourceProductId) } },
                select: { id: true }
            });

            await logBulkAudit(auditProducts.map((p: any, idx: number) => ({
                id: p.id,
                item: resolvedItems[idx]
            })), 'CATALOG_SYNC_APPROVE', 'system', tx);

            // 6. Batch Cleanup
            const idsToDelete = resolvedItems.map((i: any) => i.id);
            await (tx as any).syncQueue.deleteMany({
                where: { id: { in: idsToDelete } }
            });
        }, {
            timeout: 60000,
            maxWait: 15000
        });

        res.json({ success: true, message: `Successfully approved ${items.length} items with O(1) performance` });
    } catch (error) {
        console.error('High-performance sync approval error:', error);
        res.status(500).json({ error: 'Failed to approve items due to database pressure or constraint violation' });
    }
});

// Reject and delete junk items from sync queue
app.post('/catalog/sync/reject', async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No items provided for rejection' });
        }

        const result = await prisma.syncQueue.deleteMany({
            where: { id: { in: ids } }
        });

        res.json({ 
            success: true, 
            message: `Successfully deleted ${result.count} items from queue.`
        });
    } catch (error: any) {
        console.error('Reject Sync Error:', error);
        res.status(500).json({ error: 'Failed to reject sync items', details: error.message });
    }
});

// Bulk Import
app.post('/products/bulk', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        const created = [];
        const skipped = []; // { row: number, name: string, reason: string }

        let rowNumber = 1; // 1-based index for user friendliness (Header is 1, data starts 2)

        for (const row of data as any[]) {
            rowNumber++;

            // 1. Validate Mandatory Fields
            if (!row.name || !row.mrp || !row.category || !row.vertical) {
                skipped.push({
                    row: rowNumber,
                    name: row.name || 'Unknown',
                    reason: `Missing mandatory fields: ${!row.name ? 'Name ' : ''}${!row.mrp ? 'MRP ' : ''}${!row.vertical ? 'Vertical ' : ''}${!row.category ? 'Category' : ''}`
                });
                continue;
            }

            // 2. Validate Data Types
            const mrp = parseFloat(row.mrp);
            const unitValue = row.unitValue ? parseFloat(row.unitValue) : null;
            const gstRate = row.gstRate ? parseFloat(row.gstRate) : null;

            if (isNaN(mrp)) {
                skipped.push({ row: rowNumber, name: row.name, reason: 'Invalid MRP (Not a number)' });
                continue;
            }

            // 3. New Validations for Commerce
            if (row.unitType && !['ml', 'L', 'kg', 'g', 'pc'].includes(row.unitType)) {
                skipped.push({ row: rowNumber, name: row.name, reason: `Invalid Unit Type: ${row.unitType}` });
                continue;
            }
            if (row.unitType && !unitValue) {
                skipped.push({ row: rowNumber, name: row.name, reason: 'Unit Value required if Unit Type is set' });
                continue;
            }

            // 4. Check Duplicate EAN (if provided)
            if (row.ean) {
                const existing = await prisma.product.findFirst({ where: { ean: String(row.ean) } });
                if (existing) {
                    skipped.push({ row: rowNumber, name: row.name, reason: `Duplicate EAN: ${row.ean}` });
                    continue;
                }
            }

            try {
                const product = await prisma.product.create({
                    data: {
                        name: row.name,
                        description: row.description || null,
                        mrp: Number(row.mrp),
                        image: row.image || null,
                        brand: row.brand || null,
                        ean: row.ean ? String(row.ean) : null,
                        sourceProductId: row.source_product_id ? String(row.source_product_id) : null,
                        updatedAt: new Date(),
                        category_id: row.category_id || null,
                        // New Fields
                        unitType: row.unitType || null,
                        unitValue: unitValue,
                        hsnCode: row.hsnCode ? String(row.hsnCode) : null,
                        gstRate: gstRate
                    }
                });
                await logAudit(product.id, 'CREATE', null, null, null, 'Bulk Import');
                created.push(product);
            } catch (dbError) {
                console.error('Row Import Error:', dbError);
                skipped.push({ row: rowNumber, name: row.name, reason: 'Database Error (Constraints)' });
            }
        }

        fs.unlinkSync(req.file.path);

        res.json({
            message: `Processed. Imported: ${created.length}, Skipped: ${skipped.length}`,
            importedCount: created.length,
            skippedCount: skipped.length,
            skipped // Return the details
        });
    } catch (error) {
        console.error('Bulk import failed:', error);
        res.status(500).json({ error: 'Failed to import products' });
    }
});

// Delete Product
app.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await prisma.product.findUnique({ where: { id } });
        if (product) {
            // Manually handle dependencies if DB cascade is not active
            await prisma.storeProduct.deleteMany({ where: { productId: id } }).catch(() => { });
            await logAudit(id, 'DELETE', null, JSON.stringify(product), null);
            await prisma.product.delete({ where: { id } });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// BULK DELETE Products
app.post('/products/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No product IDs provided' });
        }

        // Log audit for each product
        for (const id of ids) {
            await logAudit(id, 'BULK_DELETE', null, null, null).catch(() => { });
        }

        // Delete associated inventory first
        await prisma.storeProduct.deleteMany({
            where: { productId: { in: ids } }
        }).catch(() => { });

        // Delete all products in a single transaction
        const result = await prisma.product.deleteMany({
            where: { id: { in: ids } }
        });

        res.json({
            message: `Deleted ${result.count} products successfully`,
            deletedCount: result.count
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ error: 'Failed to delete products' });
    }
});

// BULK UPDATE Products (category, GST rate, etc.)
app.post('/products/bulk-update', async (req, res) => {
    try {
        const { ids, updates } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No product IDs provided' });
        }

        // Build safe update data
        const updateData: any = {};
        if (updates.vertical !== undefined) updateData.vertical = updates.vertical;
        if (updates.category !== undefined) updateData.category = updates.category;
        if (updates.vertical_id !== undefined) updateData.vertical_id = updates.vertical_id;
        if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
        if (updates.gstRate !== undefined) updateData.gstRate = parseFloat(updates.gstRate);
        if (updates.unitType !== undefined) updateData.unitType = updates.unitType;
        if (updates.brand !== undefined) updateData.brand = updates.brand;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        const changedFields = Object.keys(updateData).join(', ');

        // Taxonomy Integrity Check (Strict)
        if (updateData.vertical_id || updateData.category_id) {
            if (updateData.vertical_id && updateData.category_id) {
                const isValid = await validateTaxonomy(updateData.vertical_id, updateData.category_id);
                if (!isValid) return res.status(400).json({ error: 'Invalid Category/Vertical pairing' });
            }
        }

        // Update with Atomic Auditing
        const result = await prisma.$transaction(async (tx) => {
            const updateResult = await (tx as any).product.updateMany({
                where: { id: { in: ids } },
                data: updateData
            });

            // Batched Audit (Inside Transaction prevents "Lying Logs")
            const auditPayload = ids.map(id => ({ id, updateData, changedFields }));
            await logBulkAudit(auditPayload, 'BULK_UPDATE', 'system', tx);

            return updateResult;
        });

        res.json({
            message: `Updated ${result.count} products successfully`,
            updatedCount: result.count
        });
    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({ error: 'Failed to update products' });
    }
});

// Patch Product (with Audit)
app.patch('/products/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Build update data object
    const updateData: any = {};
    if (updates.mrp !== undefined) updateData.mrp = parseFloat(updates.mrp);
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.brand !== undefined) updateData.brand = updates.brand;
    if (updates.vertical !== undefined) updateData.vertical = updates.vertical;
    if (updates.vertical_id !== undefined) updateData.vertical_id = updates.vertical_id;
    if (updates.category_id !== undefined) updateData.category_id = updates.category_id;

    // Taxonomy Integrity Check
    if (updateData.vertical_id && updateData.category_id) {
        const isValid = await validateTaxonomy(updateData.vertical_id, updateData.category_id);
        if (!isValid) return res.status(400).json({ error: 'Invalid Category for the selected Vertical' });
    }
    if (updates.ean !== undefined) updateData.ean = updates.ean;
    if (updates.image !== undefined) updateData.image = updates.image;
    if (updates.unitType !== undefined) updateData.unitType = updates.unitType;
    if (updates.unitValue !== undefined) updateData.unitValue = updates.unitValue;
    if (updates.hsnCode !== undefined) updateData.hsnCode = updates.hsnCode;
    if (updates.gstRate !== undefined) updateData.gstRate = updates.gstRate;

    try {
        // Single DB call: Update and return the new product
        const newProduct = await prisma.product.update({
            where: { id },
            data: updateData,
            include: { images: true }
        });

        // RESPOND IMMEDIATELY - don't wait for audit
        res.json(newProduct);

        // ASYNC AUDIT: Fire-and-forget (non-blocking)
        // We log what was changed without fetching old values (simpler, faster)
        const changedFields = Object.keys(updateData).join(', ');
        logAudit(id, 'UPDATE', changedFields, null, JSON.stringify(updateData)).catch(err => {
            console.error('Audit log failed (non-blocking):', err);
        });

    } catch (error) {
        console.error('PATCH DB Error:', error);
        // MOCK FALLBACK: Update in-memory data
        console.warn('⚠️ DB unavailable. Using MOCK fallback for PATCH.');
        const updated = updateMockProduct(id, updateData);
        if (updated) {
            res.json(updated);
        } else {
            res.status(404).json({ error: 'Product not found in mock data' });
        }
    }
});

// Add Image to Product
app.post('/products/:id/images', async (req, res) => {
    const { id } = req.params;
    const { url, name, isPrimary } = req.body;

    try {
        const image = await prisma.productImage.create({
            data: {
                productId: id,
                url,
                name: name || 'Product Image',
                isPrimary: isPrimary || false
            }
        });

        // If primary, update main product image field for backward compatibility
        if (isPrimary || (await prisma.productImage.count({ where: { productId: id } })) === 1) {
            await prisma.product.update({
                where: { id },
                data: { image: url }
            });
        }

        await logAudit(id, 'ADD_IMAGE', 'images', null, url);
        res.json(image);
    } catch (error) {
        console.error('Add Image DB Error:', error);
        // MOCK FALLBACK
        console.warn('⚠️ DB unavailable. Using MOCK fallback for Add Image.');
        const newImg = addMockImage(id, url, name || 'Product Image', isPrimary || false);
        if (newImg) {
            res.json(newImg);
        } else {
            res.status(404).json({ error: 'Product not found in mock data' });
        }
    }
});

// Delete Image
app.delete('/products/images/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        const image = await prisma.productImage.findUnique({ where: { id: imageId } });

        if (image) {
            await prisma.productImage.delete({ where: { id: imageId } });
            await logAudit(image.productId, 'REMOVE_IMAGE', 'images', image.url, null);

            // If we deleted the primary image, pick another one or null
            const remaining = await prisma.productImage.findFirst({ where: { productId: image.productId } });
            await prisma.product.update({
                where: { id: image.productId },
                data: { image: remaining ? remaining.url : null }
            });
        }

        res.json({ message: 'Image removed' });
    } catch (error) {
        console.error('Delete Image Error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// Update Image Details (Name/Primary)
app.patch('/products/images/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        const { name, isPrimary } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (isPrimary !== undefined) updateData.isPrimary = isPrimary;

        const image = await prisma.productImage.update({
            where: { id: imageId },
            data: updateData
        });

        res.json(image);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update image' });
    }
});

// --- JSON Bulk Import for Purchased Catalog Data ---

// POST /products/bulk-import-json
// Accepts JSON array of products from purchased catalog
// Supports field mapping, batch processing, and merge deduplication
app.post('/products/bulk-import-json', express.json({ limit: '100mb' }), async (req, res) => {
    try {
        const { products, fieldMapping, source = 'purchased_catalog' } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: 'No products provided. Expected { products: [...] }' });
        }

        // Default field mapping (can be customized via request)
        const mapping = fieldMapping || {
            product_id: 'sourceProductId',
            product_name: 'name',
            image_url: 'image',
            product_price: 'mrp',
            vertical: 'vertical',
            category_hierarchy: 'category', // Will be parsed for category + subcategory
            avg_rating: 'avgRating',
            number_of_ratings: 'numberOfRatings',
            is_sold_out: 'isSoldOut',
            product_url: 'productUrl',
            country_code: 'countryCode',
            catalog_name: 'catalogName',
            unit_price: 'unitPrice',
            UOM: 'uom',
            shipping_charges: 'shippingCharges',
            source: 'source',
            others: 'extraData',
        };

        const BATCH_SIZE = 500;
        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        const errors: { row: number; name: string; reason: string }[] = [];

        // Process in batches
        for (let batchStart = 0; batchStart < products.length; batchStart += BATCH_SIZE) {
            const batch = products.slice(batchStart, batchStart + BATCH_SIZE);

            for (let i = 0; i < batch.length; i++) {
                const raw = batch[i];
                const rowNum = batchStart + i + 1;

                try {
                    // Apply field mapping
                    const mapped: any = {};
                    for (const [srcField, destField] of Object.entries(mapping)) {
                        if (raw[srcField] !== undefined && raw[srcField] !== null && raw[srcField] !== '') {
                            mapped[destField as string] = raw[srcField];
                        }
                    }

                    // Parse category_hierarchy into category + subcategory
                    if (raw.category_hierarchy) {
                        const parts = String(raw.category_hierarchy).split(/[>\/|,]/).map((s: string) => s.trim()).filter(Boolean);
                        mapped.category = parts[0] || 'Uncategorized';
                        mapped.subcategory = parts.length > 1 ? parts[1] : null;
                    }

                    // Validate required fields
                    const productName = mapped.name || raw.product_name || raw.name;
                    if (!productName) {
                        errors.push({ row: rowNum, name: 'Unknown', reason: 'Missing product name' });
                        skipped++;
                        continue;
                    }
                    mapped.name = String(productName).trim();

                    // Parse numeric fields safely
                    const mrp = parseFloat(mapped.mrp || raw.product_price || raw.mrp || 0);
                    if (isNaN(mrp) || mrp <= 0) {
                        errors.push({ row: rowNum, name: mapped.name, reason: `Invalid price: ${mapped.mrp}` });
                        skipped++;
                        continue;
                    }
                    mapped.mrp = mrp;

                    if (mapped.avgRating) mapped.avgRating = parseFloat(mapped.avgRating) || null;
                    if (mapped.numberOfRatings) mapped.numberOfRatings = parseInt(mapped.numberOfRatings) || null;
                    if (mapped.unitPrice) mapped.unitPrice = parseFloat(mapped.unitPrice) || null;
                    if (mapped.shippingCharges) mapped.shippingCharges = parseFloat(mapped.shippingCharges) || null;
                    if (mapped.isSoldOut) mapped.isSoldOut = mapped.isSoldOut === true || mapped.isSoldOut === 'true' || mapped.isSoldOut === 1;

                    // Handle extraData (others + any unmapped fields)
                    const knownFields = new Set(Object.keys(mapping));
                    const extraFields: any = {};
                    for (const [key, value] of Object.entries(raw)) {
                        if (!knownFields.has(key) && value !== null && value !== undefined && value !== '') {
                            extraFields[key] = value;
                        }
                    }
                    if (raw.others) {
                        try {
                            const othersData = typeof raw.others === 'string' ? JSON.parse(raw.others) : raw.others;
                            Object.assign(extraFields, othersData);
                        } catch {
                            extraFields.others_raw = raw.others;
                        }
                    }
                    if (Object.keys(extraFields).length > 0) {
                        mapped.extraData = extraFields;
                    }

                    // Set source
                    mapped.source = source;

                    // Build Prisma data object
                    const productData: any = {
                        name: mapped.name,
                        mrp: mapped.mrp,
                        category: mapped.category || 'Uncategorized',
                        image: mapped.image || null,
                        subcategory: mapped.subcategory || null,
                        source: mapped.source,
                        sourceProductId: mapped.sourceProductId ? String(mapped.sourceProductId) : null,
                        avgRating: mapped.avgRating || null,
                        numberOfRatings: mapped.numberOfRatings || null,
                        isSoldOut: mapped.isSoldOut || false,
                        productUrl: mapped.productUrl || null,
                        countryCode: mapped.countryCode || null,
                        catalogName: mapped.catalogName || null,
                        unitPrice: mapped.unitPrice || null,
                        uom: mapped.uom || null,
                        shippingCharges: mapped.shippingCharges || null,
                        extraData: mapped.extraData || null,
                    };

                    // Merge strategy: upsert by sourceProductId if available
                    if (productData.sourceProductId) {
                        await prisma.product.upsert({
                            where: { sourceProductId: productData.sourceProductId },
                            update: { ...productData, updatedAt: new Date() },
                            create: productData,
                        });

                        // Check if it was an update or insert by querying
                        const existing = await prisma.product.findUnique({
                            where: { sourceProductId: productData.sourceProductId },
                            select: { createdAt: true, updatedAt: true }
                        });
                        if (existing && existing.createdAt.getTime() !== existing.updatedAt.getTime()) {
                            updated++;
                        } else {
                            inserted++;
                        }
                    } else {
                        // No sourceProductId — just insert
                        await prisma.product.create({ data: productData });
                        inserted++;
                    }

                } catch (err: any) {
                    const productName = raw.product_name || raw.name || 'Unknown';
                    errors.push({ row: rowNum, name: productName, reason: err.message?.substring(0, 100) || 'Database error' });
                    skipped++;
                }
            }

            // Log batch progress
            console.log(`[Bulk Import] Processed ${Math.min(batchStart + BATCH_SIZE, products.length)}/${products.length}`);
        }

        res.json({
            message: `Import complete. Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`,
            inserted,
            updated,
            skipped,
            total: products.length,
            errors: errors.slice(0, 50), // Return first 50 errors max
            hasMoreErrors: errors.length > 50,
        });

    } catch (error: any) {
        console.error('JSON Bulk import failed:', error);
        res.status(500).json({ error: 'Bulk import failed', details: error.message });
    }
});

// --- Consumer-Facing APIs (for Consumer App) ---

// GET /consumer/stores - List stores with inventory
// Returns stores that have at least 1 active product
app.get('/consumer/stores', async (req, res) => {
    try {
        const { category, search, limit = 50, page = 1 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const where: any = { active: true };

        if (category) {
            // Filter stores that have products in the given category
            where.products = {
                some: {
                    active: true,
                    product: { category: String(category) }
                }
            };
        } else {
            // Only show stores with at least 1 active product
            where.products = { some: { active: true } };
        }

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { address: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        const [stores, total] = await Promise.all([
            prisma.store.findMany({
                where,
                skip,
                take,
                include: {
                    city: { select: { name: true } },
                    _count: { select: { products: { where: { active: true } } } }
                },
                orderBy: { name: 'asc' }
            }),
            prisma.store.count({ where })
        ]);

        // Format response for consumer app
        const formatted = stores.map(store => ({
            id: store.id,
            name: store.name,
            address: store.address,
            image: store.image,
            city: (store as any).city?.name || null,
            active: store.active,
            operating_hours: store.operatingHours,
            operating_days: store.operatingDays,
            product_count: (store as any)._count?.products || 0,
        }));

        res.json({
            data: formatted,
            pagination: { total, page: Number(page), limit: take, totalPages: Math.ceil(total / take) }
        });
    } catch (error: any) {
        console.error('Consumer stores error:', error);
        res.status(500).json({ error: 'Failed to fetch stores', details: error.message });
    }
});

// GET /consumer/stores/:id - Store detail with products
app.get('/consumer/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, search } = req.query;

        const store = await prisma.store.findUnique({
            where: { id },
            include: {
                city: { select: { name: true } },
            }
        });

        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }

        // Build product filter
        const productWhere: any = { storeId: id, active: true };
        if (category) {
            productWhere.product = { category: String(category) };
        }
        if (search) {
            productWhere.product = {
                ...productWhere.product,
                name: { contains: String(search), mode: 'insensitive' }
            };
        }

        const storeProducts = await prisma.storeProduct.findMany({
            where: productWhere,
            include: {
                product: {
                    include: { images: { where: { isPrimary: true }, take: 1 } }
                }
            },
            orderBy: { product: { name: 'asc' } }
        });

        // Group products by category/subcategory for the storefront
        const groupedByCategory: Record<string, any[]> = {};
        for (const sp of storeProducts) {
            const cat = sp.product.subcategory || 'Other';
            if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
            groupedByCategory[cat].push({
                id: sp.id,
                productId: sp.product.id,
                name: sp.product.name,
                image: sp.product.image,
                mrp: sp.product.mrp,
                price: sp.price,
                stock: sp.stock,
                active: sp.active,
                variant: sp.variant,
                isBestSeller: sp.is_best_seller,
                category: sp.product.subcategory,
                subcategory: sp.product.subcategory,
                brand: sp.product.brand,
                uom: sp.product.uom || sp.product.unitType ? `${sp.product.unitValue || ''}${sp.product.unitType || ''}` : null,
                avgRating: sp.product.avgRating,
                discount: sp.product.mrp > sp.price ? Math.round(((sp.product.mrp - sp.price) / sp.product.mrp) * 100) : 0,
            });
        }

        // Convert to sections array
        const sections = Object.entries(groupedByCategory).map(([title, items]) => ({
            title,
            data: items
        }));

        res.json({
            store: {
                id: store.id,
                name: store.name,
                address: store.address,
                image: store.image,
                city: store.city?.name || null,
                operating_hours: (store as any).operatingHours,
                operating_days: (store as any).operatingDays,
            },
            sections,
            totalProducts: storeProducts.length,
        });
    } catch (error: any) {
        console.error('Consumer store detail error:', error);
        res.status(500).json({ error: 'Failed to fetch store details', details: error.message });
    }
});

// GET /consumer/products/search - Search products across all stores
app.get('/consumer/products/search', async (req, res) => {
    try {
        const { q, category, limit = 30 } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query (q) is required' });
        }

        const storeProducts = await prisma.storeProduct.findMany({
            where: {
                active: true,
                store: { active: true },
                product: {
                    name: { contains: String(q), mode: 'insensitive' },
                    ...(category ? { category: String(category) } : {})
                }
            },
            include: {
                product: true,
                store: { select: { id: true, name: true, address: true, image: true } }
            },
            take: Number(limit),
            orderBy: { product: { name: 'asc' } }
        });

        const results = storeProducts.map((sp: any) => ({
            storeProductId: sp.id,
            product: {
                id: sp.product?.id,
                name: sp.product?.name,
                image: sp.product?.image,
                mrp: sp.product?.mrp,
                category: sp.product?.category,
                brand: sp.product?.brand,
            },
            price: sp.price,
            stock: sp.stock,
            store: sp.store,
        }));

        res.json({ data: results, total: results.length });
    } catch (error: any) {
        console.error('Product search error:', error);
        res.status(500).json({ error: 'Search failed', details: error.message });
    }
});

// --- Order Routes ---

// Create Order (for testing/Consumer App)
app.post('/orders', async (req, res) => {
    try {
        const {
            userId,
            storeId,
            branchId,
            items,
            totalAmount,
            paid,               // Consumer sends true after successful payment
            paymentId,          // Razorpay payment ID for audit trail
            orderRequestId,     // Reference to the original order_request
            customerName,       // Pickup/dine-in person name
            customerPhone,      // Pickup/dine-in person phone
            storeName,          // Store display name
            specialInstructions,
            arrivalTime,
            otp,                // OTP generated by consumer app
            orderType,          // 'pickup' | 'dine-in' (defaults to 'pickup')
            guestsCount         // Number of guests for dine-in orders
        } = req.body;

        if (!userId || !storeId || !branchId || !items || !totalAmount) {
            return res.status(400).json({ error: 'Missing required fields: userId, storeId, branchId, items, totalAmount' });
        }

        // ── Store Status Gate: reject orders for offline/closed stores ──
        const branch = await prisma.merchantBranch.findUnique({
            where: { id: branchId },
            select: { isActive: true, operating_hours: true, prep_time_minutes: true }
        });

        if (!branch) {
            return res.status(404).json({ error: 'Store branch not found.' });
        }

        if (!branch.isActive) {
            return res.status(403).json({ error: 'STORE_OFFLINE', message: 'This store is currently offline and not accepting orders.' });
        }

        // Check operating hours server-side
        const oh = branch.operating_hours as any;
        if (oh && oh.days && oh.open && oh.close) {
            const now = new Date();
            const jsDay = now.getDay();
            const todayIndex = (jsDay + 6) % 7; // Convert JS day (0=Sun) to store day (0=Mon)

            if (!oh.days.includes(todayIndex)) {
                return res.status(403).json({ error: 'STORE_CLOSED_TODAY', message: 'This store is closed today.' });
            }

            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const [openH, openM] = oh.open.split(':').map(Number);
            const [closeH, closeM] = oh.close.split(':').map(Number);
            const openMin = openH * 60 + openM;
            const closeMin = closeH * 60 + closeM;
            const prepBuffer = branch.prep_time_minutes || 15;

            if (currentMinutes < openMin || currentMinutes > (closeMin - prepBuffer)) {
                return res.status(403).json({ error: 'STORE_CLOSED_HOURS', message: 'This store is outside operating hours.' });
            }

            if (oh.hasLunchBreak && oh.lunchStart && oh.lunchEnd) {
                const [lsH, lsM] = oh.lunchStart.split(':').map(Number);
                const [leH, leM] = oh.lunchEnd.split(':').map(Number);
                if (currentMinutes >= (lsH * 60 + lsM) && currentMinutes < (leH * 60 + leM)) {
                    return res.status(403).json({ error: 'STORE_LUNCH_BREAK', message: 'This store is on lunch break.' });
                }
            }
        }

        const orderNumber = `PAS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Logic Gate: If consumer has already paid, mark as CONFIRMED/READY + isPaid
        let orderStatus: 'PENDING' | 'CONFIRMED' | 'READY';
        if (orderType === 'dine-in' && items.length === 0) {
            orderStatus = 'READY'; // Pure table bookings skip to Ready
        } else if (paid) {
            orderStatus = 'CONFIRMED'; // Paid orders (pickup or dine-in) go to Processing
        } else {
            orderStatus = 'PENDING';
        }
        const orderIsPaid = paid ? true : false;
        const orderOtp = otp || Math.floor(1000 + Math.random() * 9000).toString();

        // We will collect low stock alerts during the transaction to fire them after commit
        const lowStockAlerts: { sp: any, title: string, body: string }[] = [];

        // ── Layer 4: Idempotency ──────────────────────────────────────────────
        // If this Razorpay payment already produced an order, return it instead of
        // creating a duplicate. Makes client auto-retries safe (no double order /
        // double charge) after a transient failure.
        if (paymentId) {
            const existingForPayment = await prisma.order.findFirst({
                where: { metadata: { path: ['razorpayPaymentId'], equals: paymentId } },
                include: { items: { include: { storeProduct: { include: { product: true } } } }, store: true },
            });
            if (existingForPayment) {
                console.log(`[POST /orders] Idempotent hit — order already exists for payment ${paymentId}`);
                return res.status(200).json(existingForPayment);
            }
        }

        // Transaction Block: Order Create + Stock Decrement + Notification Create
        const order = await prisma.$transaction(async (tx) => {
            // ── Layer 2: Guarantee the User row exists (FK target of fk_orders_user) ──
            // The signup trigger normally creates it; this is the point-of-use backstop so a
            // missing User row can NEVER fail checkout, regardless of any upstream/DB gap.
            // upsert: if it exists (normal case) → no-op; if missing → create a minimal
            // CONSUMER row with a guaranteed-unique synthetic email.
            await tx.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: `${userId}@auto.pickatstore.app`,
                    role: 'CONSUMER',
                    name: customerName || null,
                    phone: customerPhone || null,
                    passwordHash: 'sso_auth_active',
                },
            });

            const createdOrder = await tx.order.create({
                data: {
                    orderNumber,
                    userId,
                    storeId,
                    branchId,
                    totalAmount,
                    status: orderStatus,
                    isPaid: orderIsPaid,
                    otp: orderOtp,
                    otp_code: orderOtp, // DEPRECATED: Retained temporarily for backward compatibility. Use 'otp' as the canonical field.
                    customer_name: customerName || null,
                    customer_phone: customerPhone || null,
                    store_name: storeName || null,
                    special_instructions: specialInstructions || null,
                    arrival_time: arrivalTime || null,
                    order_type: orderType || 'pickup',
                    guests_count: guestsCount || null,
                    items_count: items.length,
                    amount: totalAmount,
                    // Parse arrival_time text → absolute UTC timestamp for cron-based slot reminders.
                    // Returns null if format unrecognized; order just won't get scheduled reminders.
                    slot_time_at: parseArrivalTime(arrivalTime, new Date()),
                    metadata: paymentId ? { razorpayPaymentId: paymentId, orderRequestId: orderRequestId || null } : undefined,
                    items: {
                        create: items.map((item: any) => ({
                            storeProductId: item.storeProductId || null,
                            product_name: item.name || item.product_name || null,
                            is_veg: item.isVeg ?? true,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                },
                include: {
                    items: { include: { storeProduct: { include: { product: true } } } },
                    store: true
                }
            });

            console.log(`[POST /orders] Created order ${orderNumber} in tx`);

            if (orderRequestId) {
                try {
                    await tx.order_requests.update({
                        where: { id: orderRequestId },
                        data: { status: 'COMPLETED' }
                    });
                    console.log(`[POST /orders] Updated order_request ${orderRequestId} to COMPLETED`);
                } catch (err: any) {
                    console.error(`[POST /orders] Failed to update order_request ${orderRequestId}:`, err.message);
                }
            }

            // 2. Decrement Stock & Check Low Inventory within tx
            // Note: The DB has a CHECK constraint `stock_non_negative` that prevents
            // stock from going below 0. We must check current stock first.
            const stockItems = items.filter((item: any) => item.storeProductId);
            if (stockItems.length > 0) {
                for (const item of stockItems) {
                    // Read current stock before attempting decrement
                    const current = await tx.storeProduct.findUnique({
                        where: { id: item.storeProductId },
                        select: { stock: true }
                    });

                    if (!current || current.stock < item.quantity) {
                        // Fail the transaction entirely - prevents placing order if out of stock
                        const productName = item.name || 'Item';
                        console.error(`[POST /orders] ❌ FAILED: Insufficient stock for ${productName} (${item.storeProductId})`);
                        throw new Error(`Insufficient stock for ${productName}. Please remove it and try again.`);
                    }

                    const sp = await tx.storeProduct.update({
                        where: { id: item.storeProductId },
                        data: { stock: { decrement: item.quantity } },
                        include: { product: true }
                    });

                    if (sp.stock === 0) {
                        lowStockAlerts.push({
                            sp,
                            title: 'Out of Stock Alert',
                            body: `${sp.product.name} is completely out of stock.`
                        });
                    } else if (sp.stock <= 5) {
                        lowStockAlerts.push({
                            sp,
                            title: 'Low Stock Warning',
                            body: `Action Required: Only ${sp.stock} left of ${sp.product.name}.`
                        });
                    }
                }
            } else {
                console.log(`[POST /orders] ⚠️ No storeProductId on items — stock decrement skipped for ${orderNumber}`);
            }

            return createdOrder;
        });

        console.log(`[POST /orders] ✅ Transaction committed for ${orderNumber} | status=${orderStatus} isPaid=${orderIsPaid} paymentId=${paymentId || 'none'}`);

        // --- Post-Commit Operations (Non-blocking) ---

        // Dispatch main order notification outside transaction
        notificationService.sendMerchantNotification({
            storeId,
            title: paid ? '💰 Paid Order Received!' : 'New Order Received!',
            body: `Order #${orderNumber} for ₹${totalAmount}${paid ? ' — Already Paid' : ''}`,
            type: 'NEW_ORDER',
            referenceId: order.id,
            link: '/(main)/orders',
            metadata: {
                orderNumber,
                totalAmount,
                isPaid: paid,
                paymentId: paymentId || null,
            },
        }).catch(e => console.error('[POST /orders] New order notif failed:', e));

        // 2026-06-04 (Option B): backfill User.name from this order's
        // customer_name when the user has never provided a profile name.
        // Fire-and-forget — never block order success on a profile write.
        if (userId && typeof customerName === 'string' && customerName.trim().length >= 2) {
            prisma.user.updateMany({
                where: { id: userId, name: null },
                data: { name: customerName.trim() },
            }).catch(e => console.warn('[POST /orders] User.name backfill failed:', e?.message || e));
        }

        // Customer-side notification: branch on order_type
        // - Dine-in: send DINING_BOOKED (event #12)
        // - Pickup (paid only): send PAYMENT_SUCCESSFUL (event #2)
        const customerUserId = (order as any).userId;
        const createdOrderType = (order as any).order_type;
        if (customerUserId) {
            if (createdOrderType === 'dine-in') {
                notificationService.sendConsumerNotification({
                    userId: customerUserId,
                    title: 'Table booked 🍽️',
                    body: `Your dine-in slot for Order #${orderNumber} is confirmed.`,
                    type: 'DINING_BOOKED',
                    referenceId: order.id,
                    link: `/orders/${order.id}`,
                    storeId,
                    metadata: { orderNumber, totalAmount, isPaid: paid },
                }).catch(e => console.error('[POST /orders] Customer DINING_BOOKED notif failed:', e));
            } else if (paid) {
                notificationService.sendConsumerNotification({
                    userId: customerUserId,
                    title: 'Payment received ✅',
                    body: `Order #${orderNumber} for ₹${totalAmount} is being prepared.`,
                    type: 'PAYMENT_SUCCESSFUL',
                    referenceId: order.id,
                    link: `/orders/${order.id}`,
                    storeId,
                    metadata: { orderNumber, totalAmount, isPaid: true, paymentId: paymentId || null },
                }).catch(e => console.error('[POST /orders] Customer PAYMENT_SUCCESSFUL notif failed:', e));
            }
        }

        // 1. Fire accumulated low-stock alerts
        for (const alert of lowStockAlerts) {
            notificationService.sendMerchantNotification({
                storeId,
                title: alert.title,
                body: alert.body,
                type: 'LOW_STOCK',
                link: '/(main)/inventory',
                metadata: (alert as any).metadata ?? null,
            }).catch(e => console.error('[POST /orders] Low stock notif failed:', e));
        }

        // 2. Broadcast to merchants via Socket.IO
        io.to(`store_${storeId}`).emit('new_order', order);

        res.status(201).json(order);
    } catch (error) {
        // Full detail to server logs only — never leak DB/Prisma internals to the client.
        console.error('Create Order Error:', error);
        const raw = error instanceof Error ? error.message : String(error);
        const isStock = /stock/i.test(raw);
        const wasPaid = !!(req.body?.paid && req.body?.paymentId);

        // ── Layer 4: orphaned-payment safety ──
        // Payment captured but order not created → money taken with nothing to show.
        // Emit a loud, structured ALERT so ops/Sentry can reconcile + refund. (Auto-refund
        // wiring is a fast-follow once Razorpay refunds are enabled/tested.)
        if (wasPaid) {
            console.error(`[POST /orders][ORPHANED-PAYMENT][ALERT] payment=${req.body.paymentId} user=${req.body.userId} amount=${req.body.totalAmount} store=${req.body.storeId} reason="${raw}"`);
        }

        res.status(isStock ? 409 : 500).json({
            error: isStock ? 'OUT_OF_STOCK' : 'ORDER_CREATE_FAILED',
            message: wasPaid
                // Charged but no order → never tell them to "try again & pay"; reassure + reconcile.
                ? "Your payment went through, but we couldn't place the order. Your money is safe — we're reconciling it and you'll be refunded automatically if it can't be completed. Our team has been alerted."
                : isStock
                    ? 'One of your items just went out of stock. Please remove it and try again.'
                    : "We couldn't place your order just now. Please try again.",
            // Non-stock failures are transient + idempotent → safe to auto-retry (Layer 2 makes
            // the FK cause impossible, so a retry succeeds). Stock won't resolve on retry.
            retryable: !isStock,
        });
    }
});
// Create Order Requests (from Consumer App) with Merchant Notification
app.post('/order-requests', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        if (!token) {
            console.warn('[POST /order-requests] 401 — No auth token provided');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            console.warn('[POST /order-requests] 401 — Invalid token:', authError?.message || 'no user');
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { requests } = req.body;
        if (!Array.isArray(requests) || requests.length === 0) {
            console.warn(`[POST /order-requests] 400 — Missing/empty requests array | user=${user.id}`);
            return res.status(400).json({ error: 'Missing or empty requests array' });
        }

        // ── Store Status Gate: reject requests for offline/closed branches ──
        for (const reqRow of requests) {
            const branch = await prisma.merchantBranch.findUnique({
                where: { id: reqRow.branch_id },
                select: { isActive: true }
            });
            if (branch && !branch.isActive) {
                console.warn(`[POST /order-requests] 403 — Store offline | branch=${reqRow.branch_id} store="${reqRow.store_name}" user=${user.id}`);
                return res.status(403).json({
                    error: 'STORE_OFFLINE',
                    message: `${reqRow.store_name || 'This store'} is currently offline and not accepting orders.`
                });
            }
        }

        // Execute sequentially in a transaction to ensure either all succeed or all fail
        const notificationsToDispatch: any[] = [];
        const createdRequests = await prisma.$transaction(async (tx) => {
            const results = [];
            
            for (const reqRow of requests) {
                // 1. Fetch customer name for the notification
                const profile = await tx.profile.findUnique({
                    where: { id: user.id },
                    select: { fullName: true }
                });
                const customerName = profile?.fullName || 'Guest';

                // Compute expires_at server-side to prevent client clock drift
                const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

                // Parse the human-readable arrival_time into an absolute UTC timestamp for cron-based reminders.
                // Returns null if format is unrecognized; that's fine — the order just won't get reminders.
                const slotTimeAt = parseArrivalTime(reqRow.arrival_time, new Date());

                // 2. Insert the order request
                const created = await tx.order_requests.create({
                    data: {
                        consumer_user_id: user.id, // Always trust verified user
                        store_id: reqRow.store_id,
                        branch_id: reqRow.branch_id,
                        store_name: reqRow.store_name,
                        items: reqRow.items, // Prisma correctly converts JS Array to Postgres JSON
                        subtotal: reqRow.subtotal,
                        status: reqRow.status || 'PENDING',
                        arrival_time: reqRow.arrival_time || null,
                        order_type: reqRow.order_type || null,
                        guests_count: reqRow.guests_count || null,
                        expires_at: expiresAt,
                        slot_time_at: slotTimeAt
                        // Do not trust client's created_at/updated_at
                    }
                });

                // 3. Calculate item count for notification
                const itemsList = Array.isArray(reqRow.items) ? reqRow.items : [];
                // Fix 1: Use nullish coalescing to avoid masking real 0-quantity bugs
                const totalItems = itemsList.reduce((sum: number, item: any) => sum + (item.quantity ?? 0), 0);

                // 4. Dispatch notification specific to this branch
                notificationsToDispatch.push({
                    storeId: reqRow.branch_id, // Independent resolution per row
                    title: 'New Order Request',
                    body: `${customerName} · ₹${reqRow.subtotal} · ${totalItems} item${totalItems !== 1 ? 's' : ''} · 2 min to accept`,
                    type: 'NEW_ORDER_REQUEST',
                    referenceId: created.id,
                    link: '/(main)/orders',
                    metadata: {
                        customerName,
                        subtotal: reqRow.subtotal,
                        itemCount: totalItems,
                        orderType: reqRow.order_type || null,
                    },
                });

                results.push(created);
            }
            
            return results;
        });

        // Dispatch all collected notifications safely outside the transaction
        for (const notif of notificationsToDispatch) {
            notificationService.sendMerchantNotification(notif)
                .catch(e => console.error('[POST /order-requests] Notif failed:', e));
        }

        res.status(201).json(createdRequests);
    } catch (error: any) {
        console.error('Create Order Requests Error:', error);
        res.status(500).json({ error: 'Failed to create order requests', details: error.message });
    }
});

// Update Order Request Status (Cancel/Reject)
app.patch('/order-requests/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        const allowedStatuses = ['CANCELLED', 'REJECTED', 'ACCEPTED'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
        }

        const updated = await prisma.order_requests.update({
            where: { id },
            data: {
                status,
                rejection_reason: reason || null,
                updated_at: new Date()
            }
        });

        // Notify merchant if customer cancelled
        if (status === 'CANCELLED') {
            notificationService.sendMerchantNotification({
                storeId: updated.branch_id,
                title: 'Order Cancelled',
                body: `Customer cancelled their order request (₹${updated.subtotal})`,
                type: 'ORDER_CANCELLED',
                referenceId: updated.id,
                link: '/(main)/orders',
                metadata: {
                    subtotal: updated.subtotal,
                    reason: reason || null,
                },
            }).catch(e => console.error('[PATCH /order-requests] Notif failed:', e));
        }

        // Customer-side notification:
        // - ACCEPTED: merchant accepted the request (event #1)
        // - REJECTED: merchant declined the request (subset of event #11)
        // - CANCELLED: customer's own action — skip (no need to notify them of their own cancel)
        const requestCustomerUserId = (updated as any).consumer_user_id;
        if (requestCustomerUserId) {
            if (status === 'ACCEPTED') {
                notificationService.sendConsumerNotification({
                    userId: requestCustomerUserId,
                    title: 'Order accepted 🎉',
                    body: `Your order has been accepted. Tap to complete payment.`,
                    type: 'ORDER_CONFIRMED',
                    referenceId: updated.id,
                    link: `/orders/${updated.id}`,
                    storeId: updated.branch_id,
                    metadata: {
                        subtotal: updated.subtotal,
                    },
                }).catch(e => console.error('[PATCH /order-requests] Customer ORDER_CONFIRMED notif failed:', e));
            } else if (status === 'REJECTED') {
                notificationService.sendConsumerNotification({
                    userId: requestCustomerUserId,
                    title: 'Order request declined',
                    body: reason
                        ? `The merchant declined your request. Reason: ${reason}`
                        : `The merchant declined your request.`,
                    type: 'ORDER_CANCELLED',
                    referenceId: updated.id,
                    link: `/orders/${updated.id}`,
                    storeId: updated.branch_id,
                    metadata: {
                        subtotal: updated.subtotal,
                        reason: reason || null,
                    },
                }).catch(e => console.error('[PATCH /order-requests] Customer ORDER_CANCELLED (REJECTED) notif failed:', e));
            }
        }

        res.json(updated);
    } catch (error: any) {
        console.error('Update Order Request Status Error:', error);
        res.status(500).json({ error: 'Failed to update order request', details: error.message });
    }
});

// Update Order Status (Merchant Side)
app.patch('/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // Accept reason

        // 1. Fetch current order to validate transition
        const currentOrder = await (prisma as any).order.findUnique({
            where: { id },
            include: { user: true, items: { include: { storeProduct: { include: { product: true } } } }, store: { include: { manager: true } } }
        });

        if (!currentOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // 2. Validate Transitions & Safeguards
        if (['COMPLETED', 'REFUNDED', 'RETURN_APPROVED'].includes(currentOrder.status)) {
            // Allow formatting changes if needed, but generally these states are final regarding cancellation
            if (status === 'CANCELLED') {
                return res.status(400).json({ error: 'Cannot cancel a completed or refunded order.' });
            }
        }

        if (status === 'RETURN_APPROVED' && currentOrder.status !== 'RETURN_REQUESTED') {
            return res.status(400).json({ error: 'Order must be in RETURN_REQUESTED state to approve return.' });
        }

        // CRITICAL: Block Manual Completion
        if (status === 'COMPLETED') {
            return res.status(400).json({ error: 'Cannot manually set status to COMPLETED. Use OTP verification endpoint.' });
        }

        const data: any = { status };

        // Save Reason
        if (status === 'CANCELLED' && reason) {
            data.cancelledReason = reason;
        } else if ((status === 'RETURN_APPROVED' || status === 'RETURN_REJECTED') && reason) {
            data.returnReason = reason;
        }

        // Generate 4-digit OTP when moving to READY (REMOVED - OTP must remain stable from checkout)
        // if (status === 'READY') {
        //     data.otp = Math.floor(1000 + Math.random() * 9000).toString();
        // }

        const order = await prisma.order.update({
            where: { id },
            data,
            include: { user: true, items: { include: { storeProduct: { include: { product: true } } } }, store: { include: { manager: true } } }
        });

        if (status === 'READY' && (order as any).user?.phone && order.otp) {
            smsService.sendOtp((order as any).user.phone, order.otp).catch(err => console.error('OTP SMS Failed:', err));
        }

        // --- Notification & Stock Restoration on Cancellation ---
        if (status === 'CANCELLED') {
            // Restore Stock
            for (const item of (order as any).items) {
                await prisma.storeProduct.update({
                    where: { id: item.storeProductId },
                    data: { stock: { increment: item.quantity } }
                }).catch((e: any) => console.error('Failed to restore stock', e));
            }
        }

        // Notify Merchant (service resolves recipient internally via storeId)
        const ordStoreId = (order as any).store?.id || (order as any).storeId;

        if (status === 'CANCELLED') {
            await notificationService.sendMerchantNotification({
                storeId: ordStoreId,
                title: 'Order Cancelled',
                body: `Order #${order.orderNumber} was cancelled by the customer.`,
                type: 'CANCELLED',
                referenceId: id,
                link: '/(main)/orders',
                metadata: {
                    orderNumber: order.orderNumber,
                },
            });
        } else if (status === 'RIDER_ARRIVED') {
            await notificationService.sendMerchantNotification({
                storeId: ordStoreId,
                title: 'Rider Waiting',
                body: `Rider is at the store to pickup Order #${order.orderNumber}.`,
                type: 'RIDER_ARRIVED',
                referenceId: id,
                link: '/(main)/orders',
                metadata: {
                    orderNumber: order.orderNumber,
                },
            });
        } else {
            await notificationService.sendMerchantNotification({
                storeId: ordStoreId,
                title: `Order ${status.replace('_', ' ')}`,
                body: `Order #${order.orderNumber} status updated to ${status}`,
                type: 'ORDER_UPDATE',
                referenceId: id,
                link: '/(main)/orders',
                metadata: {
                    orderNumber: order.orderNumber,
                    newStatus: status,
                },
            });
        }

        // Customer-side notification:
        // - CANCELLED: order cancelled at this stage — notify customer (event #11)
        // - READY pickup: order packed, ready for pickup (event #3)
        // - READY dine-in: customer's food/table ready (event #7)
        const orderCustomerUserId = (order as any).userId;
        const ordOrderType = (order as any).order_type;
        if (orderCustomerUserId) {
            if (status === 'CANCELLED') {
                notificationService.sendConsumerNotification({
                    userId: orderCustomerUserId,
                    title: 'Order cancelled',
                    body: reason
                        ? `Order #${order.orderNumber} was cancelled. Reason: ${reason}`
                        : `Order #${order.orderNumber} was cancelled.`,
                    type: 'ORDER_CANCELLED',
                    referenceId: id,
                    link: `/orders/${id}`,
                    storeId: ordStoreId,
                    metadata: {
                        orderNumber: order.orderNumber,
                        reason: reason || null,
                    },
                }).catch(e => console.error('[PATCH /orders/:id/status] Customer ORDER_CANCELLED notif failed:', e));
            } else if (status === 'READY' && ordOrderType === 'pickup') {
                notificationService.sendConsumerNotification({
                    userId: orderCustomerUserId,
                    title: 'Order ready for pickup 🛍️',
                    body: `Order #${order.orderNumber} is packed. Show your OTP to pick it up.`,
                    type: 'ORDER_READY',
                    referenceId: id,
                    link: `/orders/${id}`,
                    storeId: ordStoreId,
                    metadata: {
                        orderNumber: order.orderNumber,
                    },
                }).catch(e => console.error('[PATCH /orders/:id/status] Customer ORDER_READY notif failed:', e));
            } else if (status === 'READY' && ordOrderType === 'dine-in') {
                notificationService.sendConsumerNotification({
                    userId: orderCustomerUserId,
                    title: 'Your table is ready 🍽️',
                    body: `Order #${order.orderNumber} is ready. Please head to the restaurant.`,
                    type: 'DINING_READY',
                    referenceId: id,
                    link: `/orders/${id}`,
                    storeId: ordStoreId,
                    metadata: {
                        orderNumber: order.orderNumber,
                    },
                }).catch(e => console.error('[PATCH /orders/:id/status] Customer DINING_READY notif failed:', e));
            }
        }

        if ((order as any).user?.phone) {
            const smsStatusMap: Record<string, string> = {
                'CONFIRMED': 'Confirmed',
                'PREPARING': 'Being Prepared',
                'READY': 'Ready for Pickup',
                'COMPLETED': 'Completed',
                'CANCELLED': 'Cancelled',
                'RETURN_APPROVED': 'Return Approved',
                'REFUNDED': 'Refund Processed'
            };
            const smsStatus = smsStatusMap[status];

            if (smsStatus) {
                smsService.sendOrderUpdate((order as any).user.phone, id, smsStatus).catch(err => console.error('SMS Failed:', err));
            }
        }

        io.emit('order_updated', order);
        res.json(order);
    } catch (error: any) {
        console.error('Update Status Error:', error);
        res.status(500).json({ error: 'Failed to update order status', details: error.message, stack: error.stack });
    }
});

// Refund Order Endpoint
app.post('/orders/:id/refund', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, reason } = req.body; // Optional partial refund later

        const order = await prisma.order.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (!order.isPaid) return res.status(400).json({ error: 'Cannot refund an unpaid order' });
        if (order.status === 'REFUNDED') return res.status(400).json({ error: 'Order already refunded' });

        // Initialize Razorpay (Safely)
        let razorpayInstance: any = null;
        try {
            const Razorpay = require('razorpay');
            if (process.env.RAZORPAY_KEY_ID) {
                razorpayInstance = new Razorpay({
                    key_id: process.env.RAZORPAY_KEY_ID,
                    key_secret: process.env.RAZORPAY_KEY_SECRET
                });
            } else {
                console.warn('[Refund] No Razorpay keys found in env. Refund will be SIMULATED.');
            }
        } catch (e) {
            console.warn('[Refund] Failed to load Razorpay library. Refund will be SIMULATED.', e);
        }

        // Attempt Refund via Razorpay if possible
        let refundResult: any = null;
        if (razorpayInstance) {
            try {
                // In production, we'd use paymentId. Here we simulate the call mostly.
                // await razorpayInstance.payments.refund(...) 
                console.log(`[Refund] Initiating Razorpay refund for Order #${order.orderNumber}...`);

                // Simulate a real ID since we don't have a paymentId to refund against in this mock DB
                // In a real flow:
                // refundResult = await razorpayInstance.payments.refund(order.paymentId, { amount: amount * 100 });
                refundResult = { id: `rfnd_test_${Date.now()}`, status: 'processed' };

            } catch (rpError: any) {
                console.error('[Refund] Razorpay API failed:', rpError);
                // Depending on policy, we might want to return here. 
                // But for this test phase, we'll proceed to mark as REFUNDED locally so the flow isn't blocked.
            }
        }

        // Update Status to REFUNDED (Local Database)
        const refundedOrder = await prisma.order.update({
            where: { id },
            data: {
                status: 'REFUNDED',
                isPaid: false,
                returnReason: reason || 'Refund processed',
                metadata: refundResult ? { razorpayRefundId: refundResult.id } : undefined
            },
            include: { user: true }
        });

        if (refundedOrder.user?.phone) {
            smsService.sendOrderUpdate(refundedOrder.user.phone, id, 'Refund Processed').catch(err => console.error('SMS Failed:', err));
        }

        io.emit('order_updated', refundedOrder);

        // IMPORTANT: Always return JSON
        res.json({ success: true, message: 'Refund processed successfully', order: refundedOrder });

    } catch (error: any) {
        console.error('Refund Error:', error);
        // Ensure JSON response even on crash
        res.status(500).json({ error: 'Failed to process refund', details: error.message });
    }
});

// Payment Webhook (Simulation)
app.post('/webhooks/payment', async (req, res) => {
    try {
        const { orderId, status } = req.body;
        if (status === 'success') {
            const order = await prisma.order.update({
                where: { id: orderId },
                data: { isPaid: true },
                include: { user: true, items: { include: { storeProduct: { include: { product: true } } } } }
            });
            io.emit('order_updated', order);
            return res.json({ message: 'Payment captured' });
        }
        res.status(400).json({ error: 'Payment failed' });
    } catch (error) {
        console.error('Webhook processing failed', error);
        res.status(500).json({ error: 'Webhook error' });
    }
});

// Verify OTP for Completion
app.post('/orders/:id/verify-otp', async (req, res) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;

        const order = await prisma.order.findUnique({ where: { id } });
        if (!order || order.otp !== otp) {
            return res.status(400).json({ error: 'Invalid PIN' });
        }

        const updatedOrder = await prisma.order.update({
            where: { id },
            data: { status: 'COMPLETED' },
            include: { user: true, items: { include: { storeProduct: { include: { product: true } } } } }
        });

        io.emit('order_updated', updatedOrder);

        // Dispatch COMPLETED notification to the merchant
        if ((updatedOrder as any).storeId) {
            await notificationService.sendMerchantNotification({
                storeId: (updatedOrder as any).storeId,
                title: 'Order Completed',
                body: `Order #${updatedOrder.orderNumber} has been picked up and verified.`,
                type: 'COMPLETED',
                referenceId: id,
                link: '/(main)/orders',
                metadata: {
                    orderNumber: updatedOrder.orderNumber,
                },
            });
        }

        // Customer-side notification: order picked up (event #6 in user's list)
        const otpVerifyCustomerUserId = (updatedOrder as any).userId;
        if (otpVerifyCustomerUserId) {
            notificationService.sendConsumerNotification({
                userId: otpVerifyCustomerUserId,
                title: 'Enjoy your order! 🎉',
                body: `Order #${updatedOrder.orderNumber} has been picked up. Hope you love it!`,
                type: 'ORDER_COMPLETED',
                referenceId: id,
                link: `/orders/${id}`,
                storeId: (updatedOrder as any).storeId,
                metadata: {
                    orderNumber: updatedOrder.orderNumber,
                },
            }).catch(e => console.error('[OTP verify] Customer ORDER_COMPLETED notif failed:', e));
        }

        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({ error: 'OTP verification failed' });
    }
});

// --- Auto-Reject logic ---

// --- Push Token Routes ---

// Register / Upsert push token (called on app launch / login)
app.post('/push-tokens/register', async (req, res) => {
    try {
        const { userId, expoPushToken, deviceId, platform } = req.body;

        if (!userId || !expoPushToken) {
            return res.status(400).json({ error: 'userId and expoPushToken are required' });
        }

        // Upsert: if (userId, expoPushToken) already exists, just update timestamps and re-activate
        const token = await (prisma as any).merchantPushToken.upsert({
            where: {
                userId_expoPushToken: { userId, expoPushToken }
            },
            update: {
                isActive: true,
                deviceId: deviceId || null,
                platform: platform || null,
                updatedAt: new Date()
            },
            create: {
                userId,
                expoPushToken,
                deviceId: deviceId || null,
                platform: platform || null,
                isActive: true
            }
        });

        console.log(`[PushToken] Registered token for user ${userId}: ${expoPushToken.substring(0, 20)}...`);
        res.json({ success: true, tokenId: token.id });
    } catch (error: any) {
        console.error('[PushToken] Registration failed:', error);
        res.status(500).json({ error: 'Failed to register push token', details: error.message });
    }
});

// Deregister push token (called on logout)
app.delete('/push-tokens/deregister', async (req, res) => {
    try {
        const { userId, expoPushToken } = req.body;

        if (!userId || !expoPushToken) {
            return res.status(400).json({ error: 'userId and expoPushToken are required' });
        }

        await (prisma as any).merchantPushToken.updateMany({
            where: { userId, expoPushToken },
            data: { isActive: false }
        });

        console.log(`[PushToken] Deregistered token for user ${userId}`);
        res.json({ success: true });
    } catch (error: any) {
        console.error('[PushToken] Deregistration failed:', error);
        res.status(500).json({ error: 'Failed to deregister push token', details: error.message });
    }
});

const startAutoRejectTimer = () => {
    setInterval(async () => {
        try {
            const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
            
            // Fix: Bulk update PENDING orders that have timed out
            // Executes in a single network trip and connection
            const result = await prisma.order_requests.updateMany({
                where: {
                    status: 'PENDING',
                    created_at: { lt: twoMinsAgo }
                },
                data: { status: 'CANCELLED' }
            });

            if (result.count > 0) {
                console.log(`[Auto-Reject] Cancelled ${result.count} expired orders.`);
            }
        } catch (error) {
            console.error('Auto-reject check failed', error);
        }
    }, 2 * 60 * 1000); // 2 minutes
};
startAutoRejectTimer();

// --- Merchant Routes ---


// Get Merchant Inventory (Specific Store)
app.get('/merchants/:id/inventory', async (req, res) => {
    try {
        const { id } = req.params;
        const { search, category } = req.query;

        const where: any = { storeId: id };

        if (search) {
            where.product = {
                name: { contains: String(search), mode: 'insensitive' }
            };
        }

        if (category) {
            where.product = {
                ...where.product,
                category: { in: String(category).split(',') }
            };
        }

        const inventory = await prisma.storeProduct.findMany({
            where,
            include: {
                product: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(inventory);
    } catch (error) {
        console.error('Merchant Inventory API Error:', error);
        res.status(500).json({ error: 'Failed to fetch merchant inventory' });
    }
});

// Get Merchant Branches
app.get('/merchants/:id/branches', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get the manager/owner of the current store
        const currentStore = await prisma.store.findUnique({
            where: { id },
            select: { managerId: true }
        });

        if (!currentStore || !currentStore.managerId) {
            return res.json([]);
        }

        // 2. Fetch all stores managed by the same person
        const branches = await prisma.store.findMany({
            where: { managerId: currentStore.managerId },
            select: {
                id: true,
                name: true,
                address: true,
                active: true
            }
        });

        res.json(branches);
    } catch (error) {
        console.error('Merchant Branches API Error:', error);
        res.status(500).json({ error: 'Failed to fetch merchant branches' });
    }
});

// Export Selected Merchants
app.post('/merchants/export-selected', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No merchant IDs provided' });
        }

        // Fetch merchants from Supabase
        const { data: merchants, error } = await supabase
            .from('merchants')
            .select('*')
            .in('id', ids);

        if (error) throw error;

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Merchants');

        // Define Columns
        worksheet.columns = [
            { header: 'Store Name', key: 'store_name', width: 25 },
            { header: 'Owner Name', key: 'owner_name', width: 20 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'City', key: 'city', width: 15 },
            { header: 'Branch', key: 'branch_name', width: 15 },
            { header: 'Status', key: 'status', width: 10 },
            { header: 'Rating', key: 'rating', width: 10 },
            { header: 'Created At', key: 'created_at', width: 20 }
        ];

        // Add Data
        merchants.forEach((m: any) => {
            worksheet.addRow({
                store_name: m.store_name,
                owner_name: m.owner_name,
                phone: m.phone,
                email: m.email,
                city: m.city,
                branch_name: m.branch_name || 'Main',
                status: m.status,
                rating: m.rating,
                createdAt: m.created_at
            });
        });

        // Styling Header
        worksheet.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=merchants_export.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Merchant export failed:', error);
        res.status(500).json({ error: 'Failed to export merchants' });
    }
});

// Update Store Details & Sync to Merchants Table
app.patch('/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, cityId } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Store name is required' });
        }

        const updateData: any = { name };
        if (address !== undefined) updateData.address = address;
        if (cityId !== undefined) updateData.cityId = cityId;

        // 1. Update Postgres (Prisma)
        const updatedStore = await prisma.store.update({
            where: { id },
            data: updateData
        });

        // 2. Fetch Full Details for Sync (Need Manager & City)
        const fullStore = await prisma.store.findUnique({
            where: { id },
            include: {
                manager: true,
                city: true
            }
        });

        if (fullStore && fullStore.manager) {
            // 3. Sync to Supabase 'merchants' table (Used by Admin Dashboard)
            const merchantPayload = {
                id: fullStore.id,
                store_name: fullStore.name,
                owner_name: fullStore.manager.name || 'Unknown',
                email: fullStore.manager.email,
                phone: fullStore.manager.phone || '',
                city: fullStore.city?.name || 'Unknown', // Assuming included city has name
                address: fullStore.address,
                has_branches: false, // Default
                status: fullStore.active ? 'active' : 'inactive',
                updatedAt: new Date().toISOString()
            };

            const { error: syncError } = await supabase
                .from('merchants')
                .upsert(merchantPayload, { onConflict: 'id' });

            if (syncError) {
                console.error('Failed to sync to merchants table:', syncError);
                // Don't fail the request, just log it. 
                // In production, might want a queue or retry mechanism.
            } else {
                console.log('Synced store update to merchants table:', fullStore.name);
            }
        }

        // Audit Log
        logAudit(id, 'UPDATE_STORE', Object.keys(updateData).join(','), null, JSON.stringify(updateData), 'Merchant App').catch(() => { });

        res.json(updatedStore);
    } catch (error) {
        console.error('Update Store Failed:', error);
        res.status(500).json({ error: 'Failed to update store details' });
    }
});

// --- Coupon Routes ---

// List Coupons (with filtering)
app.get('/coupons', async (req, res) => {
    try {
        const caller = await requireAdmin(req, res); if (!caller) return;
        const { storeId, isActive, fundingSource, search } = req.query;

        const where: any = {};
        // Prisma `where` uses model fields (camelCase), not @map column names.
        if (storeId) where.storeId = String(storeId);
        if (isActive !== undefined) where.isActive = isActive === 'true';
        if (fundingSource) where.fundingSource = String(fundingSource).toUpperCase();
        if (search) {
            where.code = { contains: String(search).toUpperCase(), mode: 'insensitive' };
        }

        const coupon = await prisma.coupon.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ data: coupon });
    } catch (error) {
        console.error('List Coupons Error:', error);
        res.status(500).json({ error: 'Failed to fetch coupon' });
    }
});

// Create Coupon
app.post('/coupon', async (req, res) => {
    try {
        const caller = await requireAdmin(req, res); if (!caller) return;
        const {
            code,
            discountType,
            discountValue,
            maxDiscountCap,
            fundingSource,
            targetAudience,
            storeId,
            usageLimit,
            startDate,
            endDate,
            // coupon-engine fields
            minOrder, perCustomerLimit, bogoBuy, bogoGet,
            title, brandName, description, showLogo, logoUrl, autoCode,
            theme
        } = req.body;

        // theme validation — admin must pick one of the curated presets; default classic.
        const ALLOWED_THEMES = ['classic', 'bold', 'modern', 'festive'] as const;
        const themeValue = theme && ALLOWED_THEMES.includes(String(theme) as any)
            ? String(theme)
            : 'classic';

        const type = discountType ? String(discountType).toUpperCase() : '';

        // Validation
        if (!code || !type || !fundingSource || !targetAudience) {
            return res.status(400).json({ error: 'Missing required fields: code, discountType, fundingSource, targetAudience' });
        }
        if (type === 'BOGO') {
            if (!bogoBuy || !bogoGet) return res.status(400).json({ error: 'BOGO coupons require bogoBuy and bogoGet' });
        } else if (!discountValue) {
            return res.status(400).json({ error: 'discountValue is required for PERCENTAGE/FLAT coupons' });
        }

        // Check for duplicate code
        const existing = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
        if (existing) {
            return res.status(409).json({ error: `Coupon code "${code}" already exists.` });
        }

        // If storeId is provided, verify it exists
        if (storeId) {
            const store = await prisma.store.findUnique({ where: { id: storeId } });
            if (!store) {
                return res.status(404).json({ error: 'Store not found' });
            }
        }

        const coupon = await prisma.coupon.create({
            data: {
                code: code.toUpperCase(),
                discountType: type as any,
                discountValue: discountValue != null ? Number(discountValue) : 0,
                maxDiscountCap: maxDiscountCap ? Number(maxDiscountCap) : null,
                fundingSource: String(fundingSource).toUpperCase() as any,
                targetAudience: String(targetAudience).toUpperCase() as any,
                storeId: storeId || null,
                usageLimit: usageLimit ? parseInt(usageLimit) : null,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                minOrder: minOrder != null ? Number(minOrder) : null,
                perCustomerLimit: perCustomerLimit != null ? parseInt(perCustomerLimit) : null,
                bogoBuy: bogoBuy != null ? parseInt(bogoBuy) : null,
                bogoGet: bogoGet != null ? parseInt(bogoGet) : null,
                title: title || null,
                brandName: brandName || null,
                description: description || null,
                showLogo: showLogo != null ? Boolean(showLogo) : true,
                logoUrl: logoUrl || null,
                autoCode: autoCode != null ? Boolean(autoCode) : false,
                theme: themeValue,
                updatedAt: new Date(),
            }
        });

        res.status(201).json(coupon);
    } catch (error) {
        console.error('Create Coupon Error:', error);
        res.status(500).json({ error: 'Failed to create coupon' });
    }
});

// Update Coupon
app.patch('/coupon/:id', async (req, res) => {
    try {
        const caller = await requireAdmin(req, res); if (!caller) return;
        const { id } = req.params;
        const updateData: any = {};

        const allowedFields = ['code', 'discountType', 'discountValue', 'maxDiscountCap',
            'fundingSource', 'targetAudience', 'storeId', 'isActive', 'usageLimit', 'startDate', 'endDate',
            // coupon-engine fields
            'minOrder', 'perCustomerLimit', 'bogoBuy', 'bogoGet', 'title', 'brandName', 'description', 'showLogo', 'logoUrl', 'autoCode',
            'theme'];
        const ALLOWED_THEMES_PATCH = ['classic', 'bold', 'modern', 'festive'];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                let value = req.body[field];
                let prismaField = field; // Use camelCase directly for Prisma

                if (['discountType', 'fundingSource', 'targetAudience'].includes(field)) {
                    value = String(value).toUpperCase();
                }
                if (field === 'code') value = String(value).toUpperCase();
                if (['discountValue', 'maxDiscountCap', 'minOrder'].includes(field)) {
                    value = value === null ? null : parseFloat(value);
                }
                if (['usageLimit', 'perCustomerLimit', 'bogoBuy', 'bogoGet'].includes(field)) {
                    value = value === null ? null : parseInt(value);
                }
                if (['showLogo', 'autoCode'].includes(field)) {
                    value = Boolean(value);
                }
                if (['startDate', 'endDate'].includes(field)) {
                    value = value === null ? null : new Date(value);
                }
                if (field === 'theme') {
                    // silently fall back to 'classic' if an unknown theme id sneaks through
                    value = ALLOWED_THEMES_PATCH.includes(String(value)) ? String(value) : 'classic';
                }
                updateData[prismaField] = value;
            }
        }

        const coupon = await prisma.coupon.update({
            where: { id },
            data: updateData
        });

        res.json(coupon);
    } catch (error) {
        console.error('Update Coupon Error:', error);
        res.status(500).json({ error: 'Failed to update coupon' });
    }
});

// Delete Coupon
app.delete('/coupon/:id', async (req, res) => {
    try {
        const caller = await requireAdmin(req, res); if (!caller) return;
        const { id } = req.params;
        await prisma.coupon.delete({ where: { id } });
        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Delete Coupon Error:', error);
        res.status(500).json({ error: 'Failed to delete coupon' });
    }
});

// List coupons the logged-in customer is eligible to see on checkout.
// Filters: active + within validity window + audience matches + store-scope respected.
// Audience math is done once per request (1 aggregate query for the user) and applied in-memory.
app.get('/coupons/available', async (req, res) => {
    try {
        const u = await requireUser(req, res); if (!u) return;
        const storeId = typeof req.query.storeId === 'string' && req.query.storeId.length > 0 ? req.query.storeId : null;
        const now = new Date();

        // Pull every coupon currently in its validity window. Audience filter applied below.
        const candidates = await prisma.coupon.findMany({
            where: {
                isActive: true,
                startDate: { lte: now },
                AND: [
                    { OR: [{ endDate: null }, { endDate: { gt: now } }] },
                    storeId
                        ? { OR: [{ storeId: null }, { storeId }] }
                        : { storeId: null },
                ],
            },
            orderBy: { createdAt: 'desc' },
        });

        // Determine the caller's audience-eligibility ONCE (avoids N+1 per coupon).
        const stats = await prisma.order.aggregate({
            where: { userId: u.id },
            _count: { _all: true },
            _max: { createdAt: true },
        });
        const orderCount = stats._count._all;
        const lastOrderAt = stats._max.createdAt;
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const isNew = orderCount === 0;
        const isInactive = orderCount > 0 && !!lastOrderAt && lastOrderAt < thirtyDaysAgo;

        // Also respect usageLimit at list-time so we don't show "Sold out" coupons.
        const eligible = candidates.filter((c) => {
            if (c.usageLimit !== null && c.usageLimit !== undefined && c.usedCount >= c.usageLimit) return false;
            if (c.targetAudience === 'ALL') return true;
            if (c.targetAudience === 'NEW_USERS') return isNew;
            if (c.targetAudience === 'INACTIVE_USERS') return isInactive;
            return false;
        });

        res.json({ data: eligible });
    } catch (error) {
        console.error('List Available Coupons Error:', error);
        res.status(500).json({ error: 'Failed to fetch available coupons' });
    }
});

// Validate Coupon (for Consumer Checkout)
app.post('/checkout/validate-coupon', async (req, res) => {
    try {
        const u = await requireUser(req, res); if (!u) return;
        const { code, cartTotal, storeId } = req.body;
        const userId = u.id; // derived from verified token, NOT trusted from body

        if (!code || !cartTotal) {
            return res.status(400).json({ error: 'code and cartTotal are required' });
        }

        const coupon = await prisma.coupon.findUnique({ where: { code: String(code).toUpperCase() } });

        if (!coupon) {
            return res.status(404).json({ valid: false, error: 'Invalid coupon code' });
        }

        // Check active
        if (!coupon.isActive) {
            return res.status(400).json({ valid: false, error: 'This coupon is no longer active' });
        }

        // Check expiration
        if (coupon.endDate && new Date() > coupon.endDate) {
            return res.status(400).json({ valid: false, error: 'This coupon has expired' });
        }

        // Check start date
        if (new Date() < coupon.startDate) {
            return res.status(400).json({ valid: false, error: 'This coupon is not yet active' });
        }

        // Check usage limit
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ valid: false, error: 'This coupon has reached its usage limit' });
        }

        // Check store-specific restriction
        if (coupon.storeId && storeId && coupon.storeId !== storeId) {
            return res.status(400).json({ valid: false, error: 'This coupon is not valid for this store' });
        }

        // Check audience (requires userId for NEW_USERS check)
        if (coupon.targetAudience === 'NEW_USERS' && userId) {
            const orderCount = await prisma.order.count({ where: { userId: userId } });
            if (orderCount > 0) {
                return res.status(400).json({ valid: false, error: 'This coupon is only for new users' });
            }
        }

        // Check minimum order value
        if (coupon.minOrder && Number(cartTotal) < coupon.minOrder) {
            return res.status(400).json({ valid: false, error: `Minimum order of ₹${coupon.minOrder} required to use this coupon` });
        }

        // Check per-customer limit (counts this user's prior redemptions)
        if (coupon.perCustomerLimit && userId) {
            const usedByUser = await prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } });
            if (usedByUser >= coupon.perCustomerLimit) {
                return res.status(400).json({ valid: false, error: 'You have already used this coupon the maximum number of times' });
            }
        }

        // Calculate discount
        let discount = 0;
        let bogo: { buy: number; get: number } | null = null;
        if (coupon.discountType === 'PERCENTAGE') {
            discount = (Number(cartTotal) * coupon.discountValue) / 100;
            if (coupon.maxDiscountCap) {
                discount = Math.min(discount, coupon.maxDiscountCap);
            }
        } else if (coupon.discountType === 'BOGO') {
            // BOGO applies at the line-item level (cheapest-free etc.) — surface the rule,
            // not a flat ₹ off. The cart computes the actual saving from buy/get.
            bogo = { buy: coupon.bogoBuy ?? 1, get: coupon.bogoGet ?? 1 };
        } else {
            discount = coupon.discountValue; // FLAT
        }

        // Don't let discount exceed cart total
        discount = Math.min(discount, Number(cartTotal));

        res.json({
            valid: true,
            couponId: coupon.id,
            code: coupon.code,
            discount: Math.round(discount * 100) / 100,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscountCap: coupon.maxDiscountCap,
            bogo,
            minOrder: coupon.minOrder ?? null,
        });
    } catch (error) {
        console.error('Validate Coupon Error:', error);
        res.status(500).json({ error: 'Failed to validate coupon' });
    }
});

// Redeem a coupon — records the usage atomically. Call this at order placement.
// Idempotent on orderId so retries (or the webhook backstop) can't double-count.
app.post('/coupons/redeem', async (req, res) => {
    try {
        const u = await requireUser(req, res); if (!u) return;
        const { code, orderId, issuedCode } = req.body;
        const userId = u.id; // derived from verified token, NOT trusted from body
        if (!code) {
            return res.status(400).json({ error: 'code is required' });
        }

        const coupon = await prisma.coupon.findUnique({ where: { code: String(code).toUpperCase() } });
        if (!coupon) return res.status(404).json({ error: 'Invalid coupon code' });

        // Idempotency: if this order already redeemed this coupon, return the existing record.
        if (orderId) {
            const existing = await prisma.couponRedemption.findFirst({ where: { couponId: coupon.id, orderId } });
            if (existing) return res.status(200).json({ redemptionId: existing.id, alreadyRedeemed: true });
        }

        // Record redemption + bump usedCount in one transaction.
        const redemption = await prisma.$transaction(async (tx) => {
            const r = await tx.couponRedemption.create({
                data: { couponId: coupon.id, userId, orderId: orderId || null, issuedCode: issuedCode || null },
            });
            await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
            return r;
        });

        res.status(201).json({ redemptionId: redemption.id, couponId: coupon.id });
    } catch (error) {
        console.error('Redeem Coupon Error:', error);
        res.status(500).json({ error: 'Failed to redeem coupon' });
    }
});

// --- DEBUG: Fix DB Route ---
// --- DEBUG: Fix DB Route ---
app.post('/debug/fix-db', async (req, res) => {
    // Disabled for security - manual activation bypassed kyc-decision approval flow
    res.status(403).json({ error: 'This debug route is disabled in production.' });
});

// --- DEBUG: List Merchants Route ---
app.get('/debug/list-merchants', async (req, res) => {
    try {
        const merchants: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM merchants`);
        // sanitize sensitive data if any
        res.json(merchants);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/debug/list-users', async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.json(users);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// --- WhatsApp OTP Authentication Routes ---
// ==========================================

/**
 * POST /auth/send-otp
 * Generate a 6-digit OTP and send via WhatsApp (Wati)
 * Body: { phone: "91XXXXXXXXXX" }
 */
app.post('/auth/send-otp', async (req, res) => {
    // [INJECT: Send OTP Reviewer Bypass]
    console.log('>>> [DEBUG] INCOMING BODY:', JSON.stringify(req.body));
    const rawInput = req.body.phone || req.body.phoneNumber || '';
    const incomingPhone = String(rawInput).replace(/\D/g, '');
    console.log('>>> [DEBUG] PARSED PHONE:', incomingPhone);
    
    if (incomingPhone.endsWith('9959777027')) {
        console.log('[Reviewer Bypass] Intercepted Send OTP request. Bypassing WhatsApp API.');
        return res.status(200).json({ success: true, message: 'Mock OTP sent successfully.' });
    }

    try {
        const { phone, isSignup, isLogin } = req.body;
        const purpose = req.body.purpose;

        if (!phone || !/^91\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid Indian phone number required (format: 91XXXXXXXXXX)' });
        }

        // Admin login: only allowlisted phones may request an admin OTP.
        // Merchant / consumer flows (no `purpose`) are unaffected.
        if (purpose === 'admin') {
            const allow = await prisma.adminAllowlist.findFirst({ where: { phone, isActive: true } });
            if (!allow) {
                return res.status(403).json({ error: 'This number is not authorized for admin access.' });
            }
        }

        // Early duplicate/lookup checks to save WATI costs
        const barePhone = phone.replace(/^91/, '');
        
        if (isSignup || isLogin) {
            const { data: existingMerchants } = await supabaseAdmin
                .from('merchants')
                .select('id')
                .eq('phone', barePhone)
                .limit(1);

            const existingMerchant = existingMerchants && existingMerchants.length > 0 ? existingMerchants[0] : null;

            if (isSignup && existingMerchant) {
                return res.status(409).json({ error: 'This phone number is already registered. Please login instead.' });
            }

            if (isLogin && !existingMerchant) {
                return res.status(404).json({ error: 'No merchant account found for this number. Please apply as partner first.' });
            }
        }

        // [2026-05-30] 10-min/3-OTP per-phone ban REMOVED — was blocking founder/legitimate testing.
        // Per-OTP attempt limit (5 wrong tries on a single record, in /auth/verify-otp) is retained.
        // TODO (forlater.md): replace with a cheaper per-IP throttle + Wati-cost cap before scale.

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

        // Store OTP in database
        await prisma.otpVerification.create({
            data: { phone, otp, expiresAt: expiresAt }
        });

        // Send via Wati WhatsApp
        let sent = false;
        try {
            sent = await watiService.sendOtp(phone, otp);
        } catch (watiErr: any) {
            console.error(`[Auth] Wati Service Exception:`, watiErr.message);
        }

        if (!sent) {
            console.error(`[Auth] Failed to send OTP to ${phone} via Wati. Invalidating record.`);
            // Mandate 2: Invalidate the record immediately for audit purposes
            await prisma.otpVerification.updateMany({
                where: { phone, otp, verified: false },
                data: { expiresAt: new Date(0) }
            });
            return res.status(502).json({ error: 'WhatsApp delivery failed. Please try again.' });
        }

        console.log(`[Auth] OTP sent to ${phone}`);
        res.json({ success: true, message: 'OTP sent via WhatsApp' });
    } catch (error: any) {
        console.error('[Auth] Send OTP Error:', error?.message, '\nStack:', error?.stack, '\nFull:', error);
        // Temporary verbose-error response to diagnose iOS Send OTP 500 — strip after fix
        res.status(500).json({
            error: 'Internal Server Error',
            detail: (error?.message || String(error) || 'unknown').slice(0, 500),
            code: error?.code,
            meta: error?.meta,
        });
    }
});

/**
 * POST /auth/verify-otp
 * Validate OTP → create or find Supabase user → return session
 * Body: { phone: "91XXXXXXXXXX", otp: "123456" }
 */
app.post('/auth/verify-otp', async (req, res) => {


    try {
        console.log(`[Auth] POST /auth/verify-otp hit`);
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }

        const isReviewer = phone.endsWith('9959777027') && otp === '123456';
        let record = null;

        if (!isReviewer) {
            console.log(`[Auth] Looking for unverified OTP for phone: ${phone}`);
            // Find the latest unverified OTP for this phone
            record = await prisma.otpVerification.findFirst({
                where: {
                    phone,
                    verified: false,
                    expiresAt: { gte: new Date() }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!record) {
                return res.status(410).json({ error: 'OTP expired or not found. Please request a new one.' });
            }

            // Check max attempts
            if ((record.attempts ?? 0) >= 5) {
                return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
            }

            // Increment attempts
            await prisma.otpVerification.update({
                where: { id: record.id },
                data: { attempts: { increment: 1 } }
            });

            // Validate OTP
            if (record.otp !== otp) {
                return res.status(401).json({ error: 'Incorrect OTP', attemptsRemaining: 5 - ((record.attempts ?? 0) + 1) });
            }

            // Mark OTP as verified
            await prisma.otpVerification.update({
                where: { id: record.id },
                data: { verified: true }
            });
        } else {
            console.log(`[Auth] Reviewer bypass active for phone: ${phone}`);
        }

        // Admin login gate: only allowlisted phones may complete an admin verify.
        // (Defense in depth — send-otp already gates admin OTP requests.)
        const isAdminLogin = req.body.purpose === 'admin';
        if (isAdminLogin) {
            const allow = await prisma.adminAllowlist.findFirst({ where: { phone, isActive: true } });
            if (!allow) {
                return res.status(403).json({ error: 'This number is not authorized for admin access.' });
            }
        }

        // Format phone for Supabase (needs +91 prefix)
        const formattedPhone = `+${phone}`;
        const syntheticEmail = `${phone}@phone.pickatstore.app`;
        let isNewUser = false;

        console.log(`[Auth] Querying Supabase auth.users for ${formattedPhone} OR ${syntheticEmail}`);
        // Check if user already exists in Supabase Auth via direct SQL (bypasses listUsers pagination)
        const authUsers: any[] = await prisma.$queryRaw`SELECT id, email, phone FROM auth.users WHERE phone = ${formattedPhone} OR phone = ${phone} OR email = ${syntheticEmail}`;
        let existingUser = authUsers.length > 0 ? authUsers[0] : null;
        let tempPassword = '';
        let signInEmail = syntheticEmail;

        console.log(`[Auth] Existing user:`, existingUser?.id || 'None');

        if (!existingUser) {
            // 2. RECOVERY CHECK: Does this phone exist in Prisma but is missing from Supabase Auth?
            const barePhoneRaw = phone.replace(/^91/, '');
            const phoneFormats = [barePhoneRaw, phone, formattedPhone];
            const prismaUser = await prisma.user.findFirst({
                where: { phone: { in: phoneFormats } }
            });

            // Create new user with email and password to bypass disabled Phone provider
            tempPassword = `PAS_OTP_${phone}_${Date.now()}_${Math.random().toString(36)}`;
            
            const createPayload: any = {
                phone: formattedPhone,
                phone_confirm: true,
                email: signInEmail,
                email_confirm: true,
                password: tempPassword,
                user_metadata: { phone: formattedPhone }
            };

            // If Prisma user exists, FORCE Supabase to use the exact same ID
            if (prismaUser) {
                createPayload.id = prismaUser.id;
                console.log(`[Auth Recovery] Restoring Supabase Auth row for existing Prisma ID: ${prismaUser.id}`);
            }

            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser(createPayload);

            if (createError) {
                console.error('[Auth] Create user error:', createError);
                return res.status(500).json({ error: 'Failed to create user account' });
            }
            existingUser = newUser.user;
            isNewUser = true;

            // Create empty profile row
            await supabase.from('profiles').upsert({
                id: existingUser.id,
                updatedAt: new Date().toISOString()
            }).select();

            console.log(`[Auth] New user created: ${existingUser.id}`);
        } else {
            // For existing users, update with a temporary password to mint session
            tempPassword = `PAS_OTP_${phone}_${Date.now()}_${Math.random().toString(36)}`;
            signInEmail = existingUser.email || `${phone}@phone.pickatstore.app`;

            const updatePayload: any = { password: tempPassword, email_confirm: true };
            if (!existingUser.email) {
                updatePayload.email = signInEmail;
            }

            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, updatePayload);

            if (updateError) {
                console.error('[Auth] User password update failed:', updateError);
            }
        }

        // --- JIT BRANCH MANAGER PROVISIONING ---
        const barePhoneRaw = phone.replace(/^91/, '');
        const branchPhoneFormats = [barePhoneRaw, phone, formattedPhone];

        const assignedBranch = await prisma.merchantBranch.findFirst({
            where: { phone: { in: branchPhoneFormats } },
            select: { id: true, merchantId: true, managerName: true }
        });

        if (assignedBranch) {
            console.log(`[Auth] JIT Provisioning: Phone matched to Branch ${assignedBranch.id}`);
            // Ensure the user exists in Prisma with the STAFF role
            await prisma.user.upsert({
                where: { id: existingUser.id },
                update: { role: 'MERCHANT', name: assignedBranch.managerName || undefined },
                create: {
                    id: existingUser.id,
                    phone: formattedPhone,
                    email: existingUser.email || syntheticEmail,
                    role: 'MERCHANT',
                    name: assignedBranch.managerName || 'Branch Manager'
                }
            });
            // Force frontend to skip "Create Store" onboarding
            isNewUser = false;
        }
        // ---------------------------------------

        // 1. Force a small buffer to let Supabase GoTrue database sync the new password
        await new Promise(resolve => setTimeout(resolve, 500));

        // 2. ALWAYS sign in with the email (synthetic or real), NEVER the phone
        const loginEmail = signInEmail || syntheticEmail;

        console.log(`[Auth] Attempting sign-in for: ${loginEmail}`);

        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: tempPassword,
        });

        if (signInError || !sessionData.session) {
            console.error('[Auth] Supabase signInWithPassword failed:', signInError);
            return res.status(500).json({ error: 'Failed to create session. Please try again.' });
        }

        console.log(`[Auth] User ${existingUser.id} authenticated (isNew: ${isNewUser})`);

        // Admin login: stamp the durable isAdmin flag (survives the JIT role
        // overwrite above). Upsert because non-merchant admins have no User row yet.
        // 2026-06-03: also promote AdminAllowlist.role onto User.role if the
        // invitee was given a role at invite time, AND keep their existing User.role
        // if they already have one of the new admin-tier roles.
        if (isAdminLogin) {
            const allow = await prisma.adminAllowlist.findFirst({ where: { phone, isActive: true } });
            const allowRole = allow?.role && ['SUPER_ADMIN','OPERATIONS','FINANCE','SUPPORT'].includes(String(allow.role).toUpperCase())
                ? String(allow.role).toUpperCase()
                : null;

            const existingProfile = await prisma.user.findUnique({
                where: { id: existingUser.id },
                select: { role: true },
            });
            const existingRole = existingProfile?.role;
            // Don't override an existing admin-tier role on each login — that would
            // wipe Super Admin's manual demotion. Only promote when the user has no
            // admin role yet (or is still tagged as CONSUMER/MERCHANT).
            const shouldApplyAllowRole = allowRole && (!existingRole || existingRole === 'CONSUMER' || existingRole === 'MERCHANT');
            const targetRole = shouldApplyAllowRole ? allowRole : null;

            await prisma.user.upsert({
                where: { id: existingUser.id },
                update: {
                    isAdmin: true,
                    ...(targetRole ? { role: targetRole as any } : {}),
                },
                create: {
                    id: existingUser.id,
                    email: existingUser.email || syntheticEmail,
                    phone: formattedPhone,
                    role: (targetRole ?? 'CONSUMER') as any,
                    isAdmin: true,
                    name: allow?.name ?? null,
                },
            });
            console.log(`[Auth] Admin isAdmin set for ${existingUser.id}${targetRole ? ` (role=${targetRole} from allowlist)` : ''}`);
        }

        res.json({
            success: true,
            session: {
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
                expires_in: sessionData.session.expires_in,
                expiresAt: sessionData.session.expires_at
            },
            user: {
                id: existingUser.id,
                phone: formattedPhone,
                email: existingUser.email
            },
            isNewUser
        });
        console.log(`[Auth] verify-otp response sent successfully.`);
    } catch (error: any) {
        console.error('[Auth] Verify OTP Error:', error);
        res.status(500).json({ error: 'OTP verification failed' });
    }
});

/**
 * POST /admin/allowlist
 * Add (or re-activate) an authorized admin phone. Admin-only.
 * Body: { phone: "9XXXXXXXXX" | "91XXXXXXXXXX", name?: string }
 */
app.post('/admin/allowlist', async (req, res) => {
    try {
        const caller = await getAuthUser(req);
        const callerProfile = await prisma.user.findUnique({
            where: { id: caller.id },
            select: { isAdmin: true, role: true },
        });
        const callerIsAdmin = !!callerProfile && (callerProfile.isAdmin === true || callerProfile.role === 'SUPER_ADMIN');
        if (!callerIsAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const digits = String(req.body?.phone || '').replace(/\D/g, '');
        const normalized = digits.length === 10 ? `91${digits}` : digits;
        if (!/^91\d{10}$/.test(normalized)) {
            return res.status(400).json({ error: 'A valid 10-digit Indian phone number is required' });
        }
        const name = req.body?.name ? String(req.body.name).trim() : null;

        const created = await prisma.adminAllowlist.upsert({
            where: { phone: normalized },
            update: { isActive: true, ...(name ? { name } : {}) },
            create: { phone: normalized, name, isActive: true },
        });
        return res.json({ success: true, admin: { phone: created.phone, name: created.name } });
    } catch (e: any) {
        if (e?.message === 'Missing or invalid token' || e?.message === 'Unauthorized') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        console.error('[Admin] add allowlist error:', e);
        return res.status(500).json({ error: 'Failed to add admin' });
    }
});

// =====================================================================
// DELETE /auth/delete-account
// Apple Guideline 5.1.1(v): Users must be able to delete their account.
// Anonymizes order data (keeps financial records for merchant reconciliation)
// then deletes profile, addresses, and the Supabase auth record.
// =====================================================================
app.delete('/auth/delete-account', async (req, res) => {
    try {
        // 1. Authenticate the user via JWT
        const user = await getAuthUser(req);
        const userId = user.id;

        console.log(`[Account Deletion] Initiated for user: ${userId}`);

        // 2. Anonymize orders — keep financial data, strip PII
        const { error: orderError } = await supabaseAdmin
            .from('orders')
            .update({
                user_id: null,
                delivery_address: null,
                customer_phone: null,
                customer_name: '[Deleted User]',
            })
            .eq('user_id', userId);

        if (orderError) {
            console.warn(`[Account Deletion] Order anonymization warning:`, orderError.message);
            // Non-fatal: continue with deletion even if no orders exist
        }

        // 3. Delete consumer addresses
        const { error: addressError } = await supabaseAdmin
            .from('consumer_addresses')
            .delete()
            .eq('user_id', userId);

        if (addressError) {
            console.warn(`[Account Deletion] Address cleanup warning:`, addressError.message);
        }

        // 4. Delete profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) {
            console.warn(`[Account Deletion] Profile cleanup warning:`, profileError.message);
        }

        // 5. Delete favorites
        const { error: favError } = await supabaseAdmin
            .from('product_favorites')
            .delete()
            .eq('user_id', userId);

        if (favError) {
            console.warn(`[Account Deletion] Favorites cleanup warning:`, favError.message);
        }

        // 6. Delete Prisma user record (if exists)
        try {
            await prisma.user.delete({ where: { id: userId } });
        } catch (prismaErr: any) {
            // P2025 = Record not found — safe to ignore
            if (prismaErr.code !== 'P2025') {
                console.warn(`[Account Deletion] Prisma user cleanup warning:`, prismaErr.message);
            }
        }

        // 7. Delete Supabase Auth record (FINAL — point of no return)
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            console.error(`[Account Deletion] CRITICAL: Auth deletion failed for ${userId}:`, authDeleteError);
            return res.status(500).json({ error: 'Failed to delete authentication record. Please contact support.' });
        }

        console.log(`[Account Deletion] Successfully deleted user: ${userId}`);
        res.json({ success: true, message: 'Account deleted successfully.' });

    } catch (error: any) {
        console.error('[Account Deletion] Error:', error.message);
        if (error.message === 'Missing or invalid token' || error.message === 'Unauthorized') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        res.status(500).json({ error: 'Account deletion failed. Please try again.' });
    }
});

/**
 * GET /auth/merchant/draft
 * Fetches the current remote state for a merchant, used for pre-flight idempotency checks.
 */
app.get('/auth/merchant/draft', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing token' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

        const userId = user.id;

        const merchant = await prisma.merchant.findUnique({
            where: { id: userId }
        });

        if (!merchant) {
            return res.status(404).json({ error: 'Merchant draft not found' });
        }

        // Fetch the latest successful subscription for this merchant
        const subscription = await prisma.subscription.findFirst({
            where: { merchantId: userId, status: 'success' },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            merchant: {
                status: merchant.status,
                kycStatus: merchant.kycStatus,
                storeName: merchant.storeName
            },
            subscription: subscription ? {
                status: 'success',
                transactionId: subscription.transactionId,
                orderId: subscription.id,
                amount: subscription.amount
            } : null
        });
    } catch (e: any) {
        console.error('[Draft] GET Error:', e);
        res.status(500).json({ error: 'Failed to fetch draft', details: e.message });
    }
});

/**
 * POST /auth/merchant/draft
 * Fired at Step 1 to create the initial draft record.
 */
app.post('/auth/merchant/draft', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing token' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

        const { ownerName, email, phone, verticalId } = req.body;
        const userId = user.id;

        if (verticalId !== undefined) {
            const verticalExists = await prisma.vertical.findUnique({
                where: { id: verticalId }
            });
            if (!verticalExists) {
                return res.status(400).json({ error: 'Invalid verticalId provided' });
            }
        }

        await prisma.$transaction(async (tx) => {
            const existingUser = await tx.user.findUnique({ where: { id: userId } });
            if (existingUser) {
                await tx.user.update({
                    where: { id: userId },
                    data: { role: 'MERCHANT', name: ownerName, phone: phone }
                });
            } else {
                await tx.user.create({
                    data: { id: userId, email: email || `${phone}@phone.pickatstore.app`, name: ownerName, role: 'MERCHANT', passwordHash: 'sso_auth_active', phone: phone, updatedAt: new Date() }
                });
            }

            const existingMerchant = await tx.merchant.findUnique({ where: { id: userId } });
            if (existingMerchant) {
                await tx.merchant.update({
                    where: { id: userId },
                    data: { ownerName, email, phone, status: 'inactive' }
                });
            } else {
                await tx.merchant.create({
                    data: {
                        id: userId,
                        ownerName,
                        email,
                        phone,
                        status: 'inactive',
                        kycStatus: 'pending',
                        storeName: null as any,
                        ...(verticalId ? { verticalId } : {})
                    }
                });
            }
        });

        res.json({ success: true, message: 'Draft created' });
    } catch (e: any) {
        console.error('[Draft] POST Error:', e);
        res.status(500).json({ error: 'Failed to create draft', details: e.message });
    }
});

/**
 * PATCH /auth/merchant/draft
 * Incremental updates for subsequent signup steps.
 */
app.patch('/auth/merchant/draft', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

        const userId = user.id;
        const payload = req.body;

        if (payload.verticalId !== undefined) {
            const verticalExists = await prisma.vertical.findUnique({
                where: { id: payload.verticalId }
            });
            if (!verticalExists) {
                return res.status(400).json({ error: 'Invalid verticalId provided' });
            }
        }

        await prisma.$transaction(async (tx) => {
            const updateData: any = {};
            if (payload.ownerName !== undefined) updateData.ownerName = payload.ownerName;
            // 2026-06-04 (Phase 2.A2, spec blocker B2): designation captured at
            // Step 1; populates the signatory block on the partner-agreement PDF.
            if (payload.designation !== undefined) updateData.designation = payload.designation;
            if (payload.email !== undefined) updateData.email = payload.email;
            if (payload.phone !== undefined) updateData.phone = payload.phone;

            if (payload.storeName !== undefined) updateData.storeName = payload.storeName;
            if (payload.verticalId !== undefined) updateData.verticalId = payload.verticalId;
            if (payload.city !== undefined) updateData.city = payload.city;
            if (payload.address !== undefined) updateData.address = payload.address;
            if (payload.latitude !== undefined) updateData.latitude = payload.latitude;
            if (payload.longitude !== undefined) updateData.longitude = payload.longitude;
            if (payload.hasBranches !== undefined) updateData.hasBranches = payload.hasBranches;
            if (payload.kycStatus !== undefined) updateData.kycStatus = payload.kycStatus;
            if (payload.panNumber !== undefined) updateData.panNumber = payload.panNumber;
            if (payload.aadharNumber !== undefined) updateData.aadharNumber = payload.aadharNumber;
            if (payload.msmeNumber !== undefined) updateData.msmeNumber = payload.msmeNumber;
            if (payload.bankAccount !== undefined) updateData.bankAccountNumber = payload.bankAccount;
            if (payload.ifsc !== undefined) updateData.ifscCode = payload.ifsc;
            if (payload.beneficiaryName !== undefined) updateData.bankBeneficiaryName = payload.beneficiaryName;
            if (payload.turnoverRange !== undefined) updateData.turnoverRange = payload.turnoverRange;
            if (payload.gstNumber !== undefined) updateData.gstNumber = payload.gstNumber;
            if (payload.fssaiNumber !== undefined) updateData.fssaiNumber = payload.fssaiNumber;
            if (payload.docUrls) {
                if (payload.docUrls.pan) updateData.panDocUrl = payload.docUrls.pan;
                if (payload.docUrls.aadharFront) updateData.aadharFrontUrl = payload.docUrls.aadharFront;
                if (payload.docUrls.aadharBack) updateData.aadharBackUrl = payload.docUrls.aadharBack;
                if (payload.docUrls.msme) updateData.msmeCertificateUrl = payload.docUrls.msme;
                if (payload.docUrls.gst) updateData.gstCertificateUrl = payload.docUrls.gst;
                if (payload.docUrls.fssai) updateData.fssaiCertificateUrl = payload.docUrls.fssai;
            }
            if (payload.storePhotos) updateData.storePhotos = payload.storePhotos;
            if (payload.cuisines !== undefined) updateData.cuisines = payload.cuisines;
            if (payload.isVeg !== undefined) updateData.isVeg = payload.isVeg;
            if (payload.restaurantType !== undefined) updateData.restaurantType = payload.restaurantType;

            if (payload.finalize) {
                updateData.status = 'inactive';
                updateData.kycStatus = 'pending';
            }

            const existingMerchant = await tx.merchant.findUnique({ where: { id: userId } });
            if (existingMerchant) {
                await tx.merchant.update({
                    where: { id: userId },
                    data: updateData
                });
            } else {
                await tx.merchant.create({
                    data: {
                        id: userId,
                        phone: updateData.phone || user.phone || '0000000000',
                        status: updateData.status || 'inactive',
                        kycStatus: updateData.kycStatus || 'pending',
                        ...updateData
                    }
                });
            }

            // 2026-06-04 (Phase 2.C.3): v2 stores[] path. When the frontend sends
            // the consolidated stores array (Phase 2.C.2+), each Store becomes
            // a UUID-keyed MerchantBranch row. The Store row (singular, the
            // anchor row) uses the FIRST store's data for backward-compat with
            // legacy merchant-id lookups. NO main-branch convention is applied
            // for new merchants; existing merchants' main branch (id == merchant_id)
            // remains in place until a dedicated migration retires it.
            if (Array.isArray(payload.stores) && payload.stores.length > 0 && payload.stores[0]?.city) {
                const firstStore = payload.stores[0];
                const cityRecord = await tx.city.upsert({
                    where: { name: firstStore.city },
                    update: {},
                    create: { id: crypto.randomUUID(), name: firstStore.city, active: true, updatedAt: new Date() }
                });

                const existingStoreRow = await tx.store.findUnique({ where: { id: userId } });
                const anchorImage = firstStore.photos && firstStore.photos.length > 0 ? firstStore.photos[0] : null;

                if (existingStoreRow) {
                    await tx.store.update({
                        where: { id: userId },
                        data: {
                            name: firstStore.name || 'Main Store',
                            cityId: cityRecord.id,
                            address: firstStore.address,
                            latitude: firstStore.latitude ?? null,
                            longitude: firstStore.longitude ?? null,
                            image: anchorImage,
                            active: false,
                            updatedAt: new Date()
                        }
                    });
                } else {
                    await tx.store.create({
                        data: { id: userId, managerId: userId, name: firstStore.name || 'Main Store', cityId: cityRecord.id, address: firstStore.address, latitude: firstStore.latitude ?? null, longitude: firstStore.longitude ?? null, active: false, image: anchorImage, updatedAt: new Date() }
                    });
                }

                // Upsert each Store as a UUID-keyed MerchantBranch row. The
                // frontend's Store.id is reused as MerchantBranch.id (text PK,
                // accepts any UUID-shaped string).
                for (const s of payload.stores) {
                    const branchData = {
                        merchantId: userId,
                        branchName: s.name || 'Store',
                        managerName: s.manager_name,
                        phone: s.phone,
                        address: s.address,
                        city: s.city ?? null,
                        latitude: s.latitude ?? null,
                        longitude: s.longitude ?? null,
                        isActive: true,
                        cuisines: s.cuisines || [],
                        isVeg: s.is_veg ?? null,
                        restaurantType: s.restaurant_type || null,
                        branchPhotos: s.photos || [],
                    };
                    await tx.merchantBranch.upsert({
                        where: { id: s.id },
                        update: branchData,
                        create: { id: s.id, ...branchData },
                    });
                }

                // Delete any branches owned by this merchant that are NOT in the
                // submitted stores[] list — handles store removal. Preserves the
                // existing main-branch row (id == merchant_id) ONLY if it's not
                // in the submitted list (so old merchants keep their main row).
                const submittedIds = payload.stores.map((s: any) => s.id);
                await tx.merchantBranch.deleteMany({
                    where: {
                        merchantId: userId,
                        id: { notIn: submittedIds.concat([userId]) }
                    }
                });
            }
            // 2026-06-04 (Phase 2.C.3): legacy v1 path retained as a fallback
            // for clients still sending the flat storeName/branches payload
            // (older app builds before Phase 2.C.2 ships). Removed in Phase 2.G
            // once the v2 build is universal.
            else if (payload.storeName && payload.city && payload.address) {
                const cityRecord = await tx.city.upsert({
                    where: { name: payload.city },
                    update: {},
                    create: { id: crypto.randomUUID(), name: payload.city, active: true, updatedAt: new Date() }
                });
                
                const existingStore = await tx.store.findUnique({ where: { id: userId } });
                const storeImage = payload.storePhotos && payload.storePhotos.length > 0 ? payload.storePhotos[0] : null;

                if (existingStore) {
                    await tx.store.update({
                        where: { id: userId },
                        data: {
                            name: payload.storeName,
                            cityId: cityRecord.id,
                            address: payload.address,
                            latitude: payload.latitude ?? null,
                            longitude: payload.longitude ?? null,
                            image: storeImage,
                            active: false, // Ensure it stays inactive during updates until re-approved
                            updatedAt: new Date()
                        }
                    });
                } else {
                    await tx.store.create({
                        data: { id: userId, managerId: userId, name: payload.storeName, cityId: cityRecord.id, address: payload.address, latitude: payload.latitude ?? null, longitude: payload.longitude ?? null, active: false, image: storeImage, updatedAt: new Date() }
                    });
                }

                // ALWAYS (re)create the merchant's MAIN branch (id == merchant_id) carrying the
                // store's coordinates. This is what customer discovery (get_nearby_stores) reads,
                // and it's the FK target for StoreProduct.branch_id. Mirrors the legacy
                // /auth/merchant/signup behaviour. Runs regardless of hasBranches so single-store
                // merchants are still geo-located and findable. (Fix: stores were invisible because
                // the old code only created added branches and deleted the main one.)
                const mainBranchData = {
                    branchName: payload.storeName || 'Main Branch',
                    managerName: payload.ownerName,
                    phone: payload.phone,
                    address: payload.address,
                    city: payload.city ?? null,
                    latitude: payload.latitude ?? null,
                    longitude: payload.longitude ?? null,
                    isActive: true,
                    cuisines: payload.cuisines || [],
                    isVeg: payload.isVeg ?? null,
                    restaurantType: payload.restaurantType || null,
                    branchPhotos: payload.storePhotos || [],
                };
                await tx.merchantBranch.upsert({
                    where: { id: userId },
                    update: mainBranchData,
                    create: { id: userId, merchantId: userId, ...mainBranchData },
                });

                // Additional branches: replace only the NON-main branches (never the main),
                // and persist each branch's own coordinates (sent by the signup form).
                await tx.merchantBranch.deleteMany({ where: { merchantId: userId, id: { not: userId } } });
                if (payload.hasBranches && payload.branches && payload.branches.length > 0) {
                    await tx.merchantBranch.createMany({
                        data: payload.branches
                            // guard against a duplicate of the main branch's name (unique merchantId+branchName)
                            .filter((b: any) => (b.name || 'Branch') !== (payload.storeName || 'Main Branch'))
                            .map((b: any) => ({
                                merchantId: userId,
                                branchName: b.name || 'Branch',
                                managerName: b.manager_name,
                                phone: b.phone,
                                address: b.address,
                                city: b.city ?? payload.city ?? null,
                                latitude: b.latitude ?? null,
                                longitude: b.longitude ?? null,
                                isActive: true,
                                cuisines: b.cuisines || [],
                                isVeg: b.is_veg ?? null,
                                restaurantType: b.restaurant_type || null,
                                branchPhotos: b.branch_photos || [],
                            }))
                    });
                }
            }

            if (payload.subscription) {
                await tx.subscription.create({
                    data: {
                        merchantId: userId,
                        amount: payload.subscription.amount,
                        currency: 'INR',
                        status: 'success',
                        provider: 'razorpay',
                        transactionId: payload.subscription.paymentId
                    }
                });
            }
        });

        // Fire application-received email on finalize (non-blocking)
        if (payload.finalize) {
            const merchantRecord = await prisma.merchant.findUnique({ where: { id: userId } });
            const targetEmail = merchantRecord?.email || user.email;
            const targetName = merchantRecord?.ownerName || 'Partner';
            if (targetEmail) {
                sendApplicationReceivedEmail(targetEmail, targetName)
                    .catch(err => console.error('[Email] Application received email failed:', err));
            }
        }

        res.json({ success: true, message: 'Draft updated' });
    } catch (e: any) {
        console.error('[Draft] PATCH Error:', e);
        res.status(500).json({ error: `Backend Error: ${e.message}`, details: e.message });
    }
});

/**
 * POST /merchants/:id/kyc-decision
 * Admin endpoint: Approve or Reject a merchant's KYC application.
 * Sends branded email notification to the merchant.
 */
app.post('/merchants/:id/kyc-decision', async (req, res) => {
    // RBAC: OPERATIONS owns KYC review per the 2026-06-02 doc. SUPER_ADMIN
    // always allowed by requireRole's wildcard.
    const caller = await requireRole(req, res, ['OPERATIONS']); if (!caller) return;
    try {
        const { id } = req.params;
        // `needsInfoDetails` is the per-merchant message the admin types when picking 'needs_info'
        // (e.g. "Please re-upload PAN; the file you sent was unreadable.").
        const { decision, rejectionReason, needsInfoDetails } = req.body;

        if (!decision || !['approve', 'reject', 'needs_info'].includes(decision)) {
            return res.status(400).json({ error: 'Invalid decision. Must be "approve", "reject", or "needs_info".' });
        }

        const merchant = await prisma.merchant.findUnique({ where: { id } });
        if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

        if (decision === 'approve') {
            await prisma.merchant.update({
                where: { id },
                data: { kycStatus: 'approved', status: 'active' }
            });

            // Activate the associated store
            const storeUpdate = await prisma.store.update({
                where: { id },
                data: { active: true }
            });
            console.log(`[KYC] Activated store ${id} for merchant ${merchant.storeName}. Result:`, storeUpdate.active);

            if (merchant.email) {
                sendStoreApprovedEmail(merchant.email, merchant.ownerName || 'Partner', merchant.storeName || 'Your Store')
                    .catch(err => console.error('[Email] Approval email failed:', err));
            }
            console.log(`[KYC] Approved merchant ${id} (${merchant.storeName})`);
        } else if (decision === 'needs_info') {
            // KYC stays in 'pending' / 'needs_info' state — store stays inactive.
            // The merchant fixes whatever's flagged and the admin re-reviews.
            await prisma.merchant.update({
                where: { id },
                data: { kycStatus: 'needs_info', kycRejectionReason: needsInfoDetails || null }
            });

            if (merchant.email) {
                sendStoreNeedsInfoEmail(merchant.email, merchant.ownerName || 'Partner', needsInfoDetails || '')
                    .catch(err => console.error('[Email] Needs-info email failed:', err));
            }
            console.log(`[KYC] Needs more info on merchant ${id} (${merchant.storeName})`);
        } else {
            await prisma.merchant.update({
                where: { id },
                data: { kycStatus: 'rejected', kycRejectionReason: rejectionReason || null }
            });

            if (merchant.email) {
                sendStoreRejectedEmail(merchant.email, merchant.ownerName || 'Partner', rejectionReason || '')
                    .catch(err => console.error('[Email] Rejection email failed:', err));
            }
            console.log(`[KYC] Rejected merchant ${id} (${merchant.storeName})`);
        }

        res.json({ success: true, decision });
    } catch (e: any) {
        console.error('[KYC Decision] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /auth/merchant/signup
 * Securely creates a User, Store, and merchant lookup record via a single Prisma transaction.
 * Header: Authorization: Bearer <token>
 */
const merchantSignupSchema = z.object({
    ownerName: z.string().min(2, "Owner name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(10, "Valid phone is required"),
    storeName: z.string().min(2, "Store name is required"),
    verticalId: z.string().uuid("Valid vertical ID is required"),
    city: z.string().min(2, "City is required"),
    address: z.string().min(5, "Address is required"),
    latitude: z.number(),
    longitude: z.number(),
    cuisines: z.array(z.string()).optional().default([]),
    isVeg: z.boolean().optional().default(false),
    restaurantType: z.string().optional().nullable(),
    hasBranches: z.boolean().default(false),
    status: z.string().default('inactive'),
    kycStatus: z.string().default('pending'),
    panNumber: z.string().min(10, "Valid PAN is required"),
    aadharNumber: z.string().min(12, "Valid Aadhaar is required"),
    msmeNumber: z.string().optional().nullable(),
    bankAccount: z.string().min(9, "Valid bank account is required"),
    ifsc: z.string().min(4, "Valid IFSC is required"),
    beneficiaryName: z.string().min(2, "Beneficiary name is required"),
    turnoverRange: z.string(),
    gstNumber: z.string().min(15, "Valid GST is required"),
    fssaiNumber: z.string().optional().nullable(),
    docUrls: z.object({
        pan: z.string().min(1, "Valid PAN doc required"),
        aadharFront: z.string().min(1, "Valid Aadhaar front required"),
        aadharBack: z.string().min(1, "Valid Aadhaar back required"),
        msme: z.string().nullable().optional(),
        gst: z.string().min(1, "Valid GST doc required"),
        fssai: z.string().nullable().optional(),
    }),
    storePhotos: z.array(z.string()),
    branches: z.array(z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        manager_name: z.string().optional(),
        phone: z.string().optional()
    })).optional(),
    subscription: z.object({
        amount: z.number(),
        paymentId: z.string(),
        orderId: z.string(),
        signature: z.string()
    }).optional()
});

app.post('/auth/merchant/signup', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid token' });
        }
        const token = authHeader.split(' ')[1];

        // 1. Authenticate user from Supabase token
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        // 2. Validate payload
        const parsed = merchantSignupSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        }
        const payload = parsed.data;

        const userId = user.id;

        // 3. Prevent duplicate creation
        const existingMerchant = await prisma.user.findUnique({ where: { id: userId } });
        if (existingMerchant && existingMerchant.role === 'MERCHANT') {
            return res.status(409).json({ error: 'Merchant already registered' });
        }

        // 4. Resolve City (Atomic resolution to prevent race condition)
        const cityRecord = await prisma.city.upsert({
            where: { name: payload.city },
            update: {}, // No updates needed if it exists
            create: {
                id: crypto.randomUUID(),
                name: payload.city,
                active: true,
                updatedAt: new Date()
            }
        });
        const cityId = cityRecord.id;

        // Validate the vertical exists
        const GROCERY_FALLBACK = 'c307b78e-b924-47a1-a5a7-4405777fa50c';
        let verticalId = payload.verticalId;
        if (verticalId) {
            const verticalExists = await prisma.vertical.findUnique({ where: { id: verticalId } });
            if (!verticalExists) {
                console.warn(`[Signup] Invalid verticalId ${verticalId}, falling back to Grocery`);
                verticalId = GROCERY_FALLBACK;
            }
        } else {
            verticalId = GROCERY_FALLBACK;
        }

        // 5. ACID Transaction
        try {
            await prisma.$transaction(async (tx) => {
                // 5a. Create/Update Prisma User (Role: MERCHANT) - user might exist as consumer
                await tx.user.upsert({
                    where: { email: payload.email },
                    update: {
                        id: userId,
                        role: 'MERCHANT',
                        name: payload.ownerName,
                        phone: payload.phone
                    },
                    create: {
                        id: userId,
                        email: payload.email,
                        name: payload.ownerName,
                        role: 'MERCHANT',
                        passwordHash: 'sso_auth_active',
                        phone: payload.phone,
                        updatedAt: new Date()
                    }
                });

                // 5b. Create Prisma Store
                await tx.store.create({
                    data: {
                        id: userId,
                        name: payload.storeName,
                        cityId: cityId,
                        managerId: userId,
                        address: payload.address,
                        active: false,
                        image: payload.storePhotos.length > 0 ? payload.storePhotos[0] : null,
                        updatedAt: new Date()
                    }
                });

                // 5c. Create merchant record for Admin Dashboard (formal model managed by Prisma)
                await tx.merchant.create({
                    data: {
                        id: userId,
                        storeName: payload.storeName,
                        ownerName: payload.ownerName,
                        email: payload.email,
                        phone: payload.phone,
                        city: payload.city,
                        address: payload.address,
                        latitude: payload.latitude,
                        longitude: payload.longitude,
                        hasBranches: payload.hasBranches,
                        status: payload.status,
                        kycStatus: payload.kycStatus,
                        panNumber: payload.panNumber,
                        aadharNumber: payload.aadharNumber,
                        msmeNumber: payload.msmeNumber || '',
                        bankAccountNumber: payload.bankAccount,
                        ifscCode: payload.ifsc,
                        bankBeneficiaryName: payload.beneficiaryName,
                        turnoverRange: payload.turnoverRange,
                        panDocUrl: payload.docUrls.pan || null,
                        aadharFrontUrl: payload.docUrls.aadharFront || null,
                        aadharBackUrl: payload.docUrls.aadharBack || null,
                        msmeCertificateUrl: payload.docUrls.msme || null,
                        gstNumber: payload.gstNumber,
                        gstCertificateUrl: payload.docUrls.gst || null,
                        fssaiNumber: payload.fssaiNumber || '',
                        fssaiCertificateUrl: payload.docUrls.fssai || null,
                        storePhotos: payload.storePhotos,
                        cuisines: payload.cuisines || [],
                        isVeg: payload.isVeg ?? false,
                        restaurantType: payload.restaurantType || null,
                        verticalId: verticalId
                    }
                });

                // 5d. ALWAYS create a default branch for the merchant's primary location.
                // Uses merchant_id as branch_id so single-store merchants have a valid
                // FK target for StoreProduct.branch_id, and the StoreContext fallback
                // (activeStoreId = merchant_id) resolves correctly. Without this, new
                // merchants who don't toggle "multi-branch" can't add products because
                // fk_storeproduct_branch fails on first save. (Bug fixed May 20, 2026.)
                await tx.merchantBranch.create({
                    data: {
                        id: userId, // critical: same UUID as merchant_id
                        merchantId: userId,
                        branchName: payload.storeName || 'Main Branch',
                        managerName: payload.ownerName,
                        phone: payload.phone,
                        address: payload.address,
                        city: payload.city,
                        latitude: payload.latitude,
                        longitude: payload.longitude,
                        isActive: true,
                        cuisines: payload.cuisines || [],
                        isVeg: payload.isVeg ?? null,
                        restaurantType: payload.restaurantType || null,
                        branchPhotos: payload.storePhotos || [],
                    }
                });

                // 5e. Insert ADDITIONAL branches if the merchant declared multi-store.
                // (Atomic, relying on Prisma to generate UUID keys for these.)
                if (payload.hasBranches && payload.branches && payload.branches.length > 0) {
                    await tx.merchantBranch.createMany({
                        data: payload.branches.map((b: any) => ({
                            merchantId: userId,
                            branchName: b.name || 'Branch',
                            managerName: b.manager_name,
                            phone: b.phone,
                            address: b.address,
                            isActive: true,
                            cuisines: b.cuisines || [],
                            isVeg: b.is_veg ?? null,
                            restaurantType: b.restaurant_type || null,
                            branchPhotos: b.branch_photos || [],
                        }))
                    });
                }

                // 5e. Insert Secure Subscription Record
                if (payload.subscription) {
                    await tx.subscription.create({
                        data: {
                            merchantId: userId,
                            amount: payload.subscription.amount,
                            currency: 'INR',
                            status: 'success',
                            provider: 'razorpay',
                            transactionId: payload.subscription.paymentId
                        }
                    });
                }
            });
        } catch (txnError: any) {
            console.error('[Signup Transaction Error]', txnError);
            if (txnError.code === 'P2002') {
                const target = txnError.meta?.target || 'field';
                return res.status(400).json({ error: `Registration failed: The ${target} is already in use by another merchant.` });
            }
            throw txnError; // let the outer catch block handle it
        }

        res.json({ success: true, message: 'Merchant successfully registered' });

    } catch (error: any) {
        console.error('[Auth] Merchant Signup Error:', error);
        res.status(500).json({ error: 'Internal Server Error during registration', details: error?.message || String(error) });
    }
});

/**
 * GET /auth/me
 * Fetch the authenticated user's profile using their Supabase JWT.
 * Header: Authorization: Bearer <token>
 */
app.get('/auth/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid token' });
        }

        const token = authHeader.split(' ')[1];

        // Verify token with Supabase
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            console.error('[Auth] Token verification failed:', authError);
            return res.status(401).json({ error: 'Unauthorized', details: authError?.message });
        }

        // Fetch profile from Prisma (Primary source of truth for user data)
        const profile = await prisma.profile.findUnique({
            where: { id: user.id }
        });

        // Return unified user/profile object
        res.json({
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone || (user.user_metadata?.phone)
            },
            profile: profile || { tier: 'Member', credits: 0 } // Fallback if profile row is missing
        });
    } catch (error: any) {
        console.error('[Auth] /auth/me Error:', error);
        res.status(500).json({ error: 'Failed to fetch user context' });
    }
});

// --- Sentry test endpoint (admin-gated) ---
// Throws on purpose. Useful to verify Sentry receives + that source maps are
// resolving (after the 2026-06-02 wizard pass, stack traces should show real
// function names). Locked behind requireAdmin so randos can't trigger alerts.
app.get('/debug-sentry', async (req, res) => {
    const caller = await requireAdmin(req, res); if (!caller) return;
    throw new Error(`[Sentry verification] Triggered by admin ${caller.id}`);
});

// --- Resend test endpoint (admin-gated) ---
// Sends one of the 4 template emails to a target address. Admin-locked so we
// can't spam customers + nobody else can fire test sends. Usage:
//   POST /debug-resend
//   { to: "you@example.com", template: "received" | "approved" | "rejected" | "needs_info" }
app.post('/debug-resend', async (req, res) => {
    const caller = await requireAdmin(req, res); if (!caller) return;
    const { to, template = 'received' } = req.body || {};
    if (!to || typeof to !== 'string') {
        return res.status(400).json({ error: 'Provide { to: "email@domain.com" }' });
    }
    try {
        const name = 'Test Partner';
        if (template === 'approved') {
            await sendStoreApprovedEmail(to, name, 'Test Store');
        } else if (template === 'rejected') {
            await sendStoreRejectedEmail(to, name, 'Test rejection reason (verification only).');
        } else if (template === 'needs_info') {
            await sendStoreNeedsInfoEmail(to, name, 'Please re-upload your GST certificate.\nThis is a test send.');
        } else {
            await sendApplicationReceivedEmail(to, name);
        }
        res.json({ success: true, to, template, triggeredBy: caller.id });
    } catch (e: any) {
        console.error('[debug-resend] Error:', e);
        res.status(500).json({ error: e?.message || 'Email send failed' });
    }
});

// --- Admin: invite a new admin-tier user (Super Admin only) ---
// Per the 2026-06-02 RBAC doc, only SUPER_ADMIN can create/edit admin accounts.
//
// Two paths:
//   - method: 'email' (default) — server generates a temp password, creates the
//     Supabase auth user via admin API, inserts User row, emails via Resend.
//     Invitee logs in with email/password and is force-prompted to change it.
//   - method: 'phone' — server inserts into AdminAllowlist with the chosen role.
//     Invitee opens admin.pickatstore.io, switches to phone-OTP login, gets OTP
//     via Wati (existing flow). On first verify-otp, the User row is JIT-created
//     and the role is promoted from AdminAllowlist. No template needed.
app.post('/admin/users/invite', async (req, res) => {
    const caller = await requireAdmin(req, res); if (!caller) return;
    try {
        const { method = 'email', email, phone, name, role } = req.body || {};
        if (!name || !role) {
            return res.status(400).json({ error: 'name and role are required' });
        }
        const allowedRoles = ['OPERATIONS', 'FINANCE', 'SUPPORT', 'SUPER_ADMIN'];
        if (!allowedRoles.includes(String(role).toUpperCase())) {
            return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(', ')}` });
        }
        const targetRole = String(role).toUpperCase();
        const inviterName = (caller as any).email?.split('@')[0] || 'A team member';
        const labels: Record<string, string> = {
            SUPER_ADMIN: 'Super Admin',
            OPERATIONS:  'Operations',
            FINANCE:     'Finance',
            SUPPORT:     'Customer Support',
        };

        // ─── Phone path ──────────────────────────────────────────────────
        if (method === 'phone') {
            if (!phone) {
                return res.status(400).json({ error: 'phone is required when method=phone' });
            }
            // Normalize: strip non-digits; require 10 digits; prepend 91 for India.
            const digits = String(phone).replace(/\D/g, '');
            if (digits.length < 10) {
                return res.status(400).json({ error: 'phone must be a 10-digit Indian number' });
            }
            const normPhone = digits.length === 10 ? `91${digits}` : digits;

            // Reject if already invited / allowlisted.
            const existingAllow = await prisma.adminAllowlist.findUnique({ where: { phone: normPhone } });
            if (existingAllow && existingAllow.isActive) {
                return res.status(409).json({ error: 'This phone is already in the admin allowlist' });
            }
            // Upsert allowlist row carrying the chosen role.
            await prisma.adminAllowlist.upsert({
                where: { phone: normPhone },
                update: { name, role: targetRole, isActive: true },
                create: { phone: normPhone, name, role: targetRole, isActive: true },
            });
            console.log(`[InviteAdmin] Phone allowlist ${normPhone} (role=${targetRole}) (invited by ${caller.id})`);
            return res.json({
                success: true,
                method: 'phone',
                phone: normPhone,
                role: targetRole,
                hint: `Tell ${name} to open admin.pickatstore.io, switch to phone-OTP login, and enter +${normPhone}.`,
            });
        }

        // ─── Email path (existing) ───────────────────────────────────────
        if (!email) {
            return res.status(400).json({ error: 'email is required when method=email' });
        }
        const targetEmail = String(email).trim().toLowerCase();
        const existing = await prisma.user.findFirst({ where: { email: targetEmail } });
        if (existing) {
            return res.status(409).json({ error: 'A user with this email already exists' });
        }

        const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let tempPassword = '';
        for (let i = 0; i < 16; i++) tempPassword += ALPHA[Math.floor(Math.random() * ALPHA.length)];

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: targetEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name, mustChangePassword: true, invitedBy: caller.id },
        });
        if (createErr || !created?.user) {
            console.error('[InviteAdmin] createUser failed:', createErr);
            return res.status(500).json({ error: createErr?.message || 'Failed to create auth user' });
        }
        try {
            await prisma.user.create({
                data: {
                    id: created.user.id,
                    email: targetEmail,
                    name,
                    role: targetRole as any,
                    passwordHash: 'managed-by-supabase-auth',
                    updatedAt: new Date(),
                },
            });
        } catch (profileErr: any) {
            console.error('[InviteAdmin] User row insert failed, rolling back auth user:', profileErr);
            await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
            return res.status(500).json({ error: profileErr?.message || 'Failed to create user profile' });
        }
        try {
            await sendAdminInviteEmail(targetEmail, name, labels[targetRole] ?? targetRole, tempPassword, inviterName);
        } catch (mailErr: any) {
            console.warn('[InviteAdmin] Email send failed (user was still created):', mailErr?.message);
        }
        console.log(`[InviteAdmin] Email-created ${targetRole} ${targetEmail} (invited by ${caller.id})`);
        res.json({ success: true, method: 'email', id: created.user.id, email: targetEmail, role: targetRole });
    } catch (e: any) {
        console.error('[InviteAdmin] error:', e);
        res.status(500).json({ error: e?.message || 'Invite failed' });
    }
});

// --- Admin: edit role / status of an existing user (Super Admin only) ---
//
// Body: { role?: string, status?: 'active'|'suspended', suspendedReason?: string }
//
// Safeguards:
//   - Self-suspend blocked (can't lock yourself out).
//   - Last-Super-Admin safeguard: demoting or suspending the only remaining
//     Super Admin is blocked. "Super Admin" here = role==='SUPER_ADMIN' OR
//     isAdmin===true (legacy). Counts only active users.
app.patch('/admin/users/:id', async (req, res) => {
    const caller = await requireAdmin(req, res); if (!caller) return;
    try {
        const { id } = req.params;
        const { role, status, suspendedReason } = req.body || {};

        if (!role && !status) {
            return res.status(400).json({ error: 'Provide at least one of: role, status' });
        }

        const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isAdmin: true, email: true } });
        if (!target) return res.status(404).json({ error: 'User not found' });

        // Self-suspend block.
        if (status === 'suspended' && id === caller.id) {
            return res.status(400).json({ error: "You can't suspend your own account." });
        }

        // Last-Super-Admin safeguard.
        const targetIsCurrentlySuperAdmin = target.role === 'SUPER_ADMIN' || target.isAdmin === true;
        const isDemoteOrSuspend =
            (role && String(role).toUpperCase() !== 'SUPER_ADMIN') ||
            status === 'suspended';
        if (targetIsCurrentlySuperAdmin && isDemoteOrSuspend) {
            const otherSuperAdmins = await prisma.user.count({
                where: {
                    id: { not: id },
                    status: { not: 'suspended' },
                    OR: [{ role: 'SUPER_ADMIN' }, { isAdmin: true }],
                },
            });
            if (otherSuperAdmins === 0) {
                return res.status(400).json({
                    error: 'Cannot demote or suspend the only remaining Super Admin. Promote another user first.',
                });
            }
        }

        // Validate role if provided.
        const allowedRoles = ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT'];
        const updates: any = { updatedAt: new Date() };
        if (role) {
            const normRole = String(role).toUpperCase();
            if (!allowedRoles.includes(normRole)) {
                return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(', ')}` });
            }
            updates.role = normRole;
            // If they're being demoted to non-SUPER_ADMIN, also drop the legacy isAdmin flag
            // so requireAdmin doesn't keep treating them as Super Admin.
            if (normRole !== 'SUPER_ADMIN') {
                updates.isAdmin = false;
            } else {
                updates.isAdmin = true;
            }
        }
        if (status) {
            if (status !== 'active' && status !== 'suspended') {
                return res.status(400).json({ error: "status must be 'active' or 'suspended'" });
            }
            updates.status = status;
            if (status === 'suspended') {
                updates.suspendedAt = new Date();
                updates.suspendedReason = suspendedReason ?? null;
            } else {
                updates.suspendedAt = null;
                updates.suspendedReason = null;
            }
        }

        const updated = await prisma.user.update({
            where: { id },
            data: updates,
            select: { id: true, email: true, role: true, isAdmin: true, status: true, suspendedAt: true, suspendedReason: true },
        });
        console.log(`[AdminEdit] ${target.email}: ${JSON.stringify(updates)} (by ${caller.id})`);
        res.json({ success: true, user: updated });
    } catch (e: any) {
        console.error('[AdminEdit] error:', e);
        res.status(500).json({ error: e?.message || 'Edit failed' });
    }
});

// --- Wati inbound webhook ---
// Wati sends a POST here every time a customer messages the business number.
// Activate by setting the webhook URL in Wati dashboard → Settings → Webhooks
// to: https://api.pickatstore.io/webhooks/wati
//
// Wati payload shape varies by message type — we capture the raw payload AND
// best-effort extract common fields. Admin Customer Support inbox reads from
// the wati_inbox table downstream.
//
// Security: the route is open by design (Wati can't sign requests with our
// secret), but we de-dup on Wati's own message_id so replay is harmless.
app.post('/webhooks/wati', async (req, res) => {
    try {
        const payload = req.body || {};
        // Wati v3 webhook common fields — fall back gracefully if shape differs.
        const watiMessageId = payload.id || payload.messageId || payload.whatsappMessageId || null;
        const waPhone = String(payload.waId || payload.from || payload.whatsappNumber || '').replace(/^\+/, '');
        const contactName = payload.senderName || payload.contactName || null;
        const messageType = payload.type || payload.eventType || 'text';
        const body =
            payload.text?.body ??
            payload.text ??
            payload.message ??
            payload.button?.text ??
            payload.interactive?.button_reply?.title ??
            null;

        if (!waPhone) {
            // Not a usable inbound — acknowledge so Wati doesn't retry.
            console.warn('[wati-webhook] payload missing wa phone; storing raw only', payload);
        }

        await prisma.watiInbox.create({
            data: {
                watiMessageId,
                waPhone: waPhone || 'unknown',
                contactName,
                messageType,
                body,
                rawPayload: payload,
            },
        }).catch((e: any) => {
            // Unique-constraint conflict on watiMessageId = duplicate webhook; that's fine.
            if (e?.code !== 'P2002') {
                console.error('[wati-webhook] persist error:', e?.message || e);
            }
        });

        // Always 200 — never block Wati.
        res.json({ ok: true });
    } catch (e: any) {
        console.error('[wati-webhook] error:', e?.message || e);
        // Still 200 — we don't want Wati's retry storm even on our errors.
        res.json({ ok: true, captured: false });
    }
});

// --- Wati inbox list ---
// RBAC: OPERATIONS / FINANCE / SUPPORT all read; SUPER_ADMIN via wildcard.
// Customer support team is the primary consumer.
app.get('/wati/inbox', async (req, res) => {
    const caller = await requireRole(req, res, ['OPERATIONS', 'FINANCE', 'SUPPORT']); if (!caller) return;
    try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 200);
        const rows = await prisma.watiInbox.findMany({
            where: status ? { status } : undefined,
            orderBy: { receivedAt: 'desc' },
            take: limit,
        });
        res.json({ data: rows, count: rows.length });
    } catch (e: any) {
        console.error('[wati-inbox] list error:', e?.message || e);
        res.status(500).json({ error: 'Failed to fetch inbox' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// Admin reads — proper architecture (added 2026-06-03 night)
//
// Why these exist:
//   admin-web's Customers + Orders pages were reading directly from Supabase
//   via PostgREST (.from('orders'), .from('User'), etc.). That repeatedly
//   hit "table not in schema cache" / RLS-blocked-row issues — admin-tier
//   users have no implicit read access to the production tables, and adding
//   table-by-table RLS policies for the admin UI is fragile.
//
//   These endpoints use Prisma (direct PG connection, service_role-equivalent)
//   gated by requireRole. Clean: auth at the API layer, RBAC enforced, no
//   PostgREST cache surprises, no RLS policy management for admin UIs.
//
// Roles allowed: SUPER_ADMIN + OPERATIONS + FINANCE + SUPPORT (all admin tiers).
//   Routes do not return raw passwords or sensitive auth fields.
// ────────────────────────────────────────────────────────────────────────────

const ANY_ADMIN_TIER = ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT'] as const;

/**
 * recordAdminAudit — best-effort audit-trail writer.
 *
 * Writes to `public.admin_audit_log` (see docs/migrations-pending-2026-06-04.sql
 * for the schema). Wrapped in try/catch so it NEVER fails the user-facing
 * action — if the table doesn't exist yet (founder hasn't applied the
 * migration), the audit attempt silently no-ops and the response still
 * returns 200. Once the migration is applied, entries land without further
 * code changes.
 *
 * Uses $executeRaw with parameter binding (not template substitution) so
 * this works without adding the table to schema.prisma.
 */
async function recordAdminAudit(req: express.Request, opts: {
    actorId: string;
    action: string;
    targetTable: string;
    targetId: string;
    before?: any;
    after?: any;
    reason?: string;
}) {
    try {
        await prisma.$executeRaw`
            INSERT INTO public.admin_audit_log (
                actor_id, action, target_table, target_id,
                before_value, after_value, reason,
                ip_address, user_agent
            ) VALUES (
                ${opts.actorId}::uuid,
                ${opts.action},
                ${opts.targetTable},
                ${opts.targetId},
                ${opts.before ? JSON.stringify(opts.before) : null}::jsonb,
                ${opts.after  ? JSON.stringify(opts.after)  : null}::jsonb,
                ${opts.reason ?? null},
                ${(req.headers['x-forwarded-for'] as string) || req.ip || null},
                ${(req.headers['user-agent'] as string) || null}
            )
        `;
    } catch (e: any) {
        // Common case before migration applied: relation "admin_audit_log" does not exist.
        console.warn('[audit] entry not written:', e?.message || String(e));
    }
}

/**
 * GET /admin/customers
 *
 * Returns every consumer + their orders (aggregated client-side for
 * LTV / AOV / recency) + a branch→city map so the UI can derive the
 * customer's location from their most recent order's branch.
 *
 * Shape (kept stable with the prior useCustomers hook so the client
 * mapping logic stays unchanged):
 *   {
 *     customers: [
 *       { id, name, email, phone, status, createdAt,
 *         orders: [{ total_amount, created_at, branch_id, status }] }
 *     ],
 *     branchCityMap: { [branchId]: city }
 *   }
 */
app.get('/admin/customers', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        // 2026-06-04: paginated. Default page = 500 customers, cap = 2000.
        // Client doesn't yet have a load-more UI; this is server-side hardening
        // so the endpoint can't be made to return 100k rows + their order arrays
        // in one shot as the consumer base grows.
        const limit  = Math.min(parseInt((req.query.limit  as string) || '500', 10) || 500, 2000);
        const offset = Math.max(parseInt((req.query.offset as string) || '0',   10) || 0,   0);

        // 2026-06-04 (Q2/Q3 fix): widened from `role: 'CONSUMER'` to "anyone who
        // signed up as a consumer OR has placed at least one order, regardless of
        // role". Pranav's audit showed 35/48 test orders (73%) were sitting under
        // MERCHANT-role users (phone matched a branch → JIT promoted to MERCHANT
        // at OTP-verify) so the prior filter hid them entirely.
        const customersWhere = {
            OR: [
                { role: 'CONSUMER' as const },
                { orders: { some: {} } },
            ],
        };

        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                where: customersWhere,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    status: true,
                    role: true,
                    createdAt: true,
                    orders: {
                        select: {
                            totalAmount: true,
                            createdAt:   true,
                            branchId:    true,
                            status:      true,
                        },
                    },
                },
            }),
            prisma.user.count({ where: customersWhere }),
        ]);

        // Name fallback: for users with NULL User.name, look up profiles.full_name
        // (the consumer app's ProfileSetupScreen writes to public.profiles.full_name,
        // not User.name — that's the architectural split we're patching at the read
        // layer for now; Option A below writes User.name on future setups).
        const userIdsWithNullName = users.filter(u => !u.name).map(u => u.id);
        const profileNameMap: Record<string, string> = {};
        if (userIdsWithNullName.length > 0) {
            const profiles = await prisma.profile.findMany({
                where: { id: { in: userIdsWithNullName } },
                select: { id: true, fullName: true },
            });
            profiles.forEach(p => { if (p.fullName) profileNameMap[p.id] = p.fullName; });
        }

        // Collect unique branch IDs across every customer's orders → look up city.
        const branchIds = new Set<string>();
        users.forEach(u => u.orders.forEach(o => { if (o.branchId) branchIds.add(o.branchId); }));

        let branchCityMap: Record<string, string> = {};
        if (branchIds.size > 0) {
            const branches = await prisma.merchantBranch.findMany({
                where: { id: { in: Array.from(branchIds) } },
                select: { id: true, city: true },
            });
            branches.forEach(b => { if (b?.id && b?.city) branchCityMap[b.id] = b.city; });
        }

        // 2026-06-04 (Q1-A): pull consumer_addresses for the location column.
        // We return the DEFAULT address per user + a count of all addresses;
        // the full list ships via GET /admin/customers/:id/addresses for the drawer.
        const userIds = users.map(u => u.id);
        const addressCountByUser: Record<string, number> = {};
        const defaultAddressByUser: Record<string, {
            id: string; type: string | null; address: string | null;
            latitude: number | null; longitude: number | null;
        }> = {};
        if (userIds.length > 0) {
            try {
                const allAddrs = await prisma.consumer_addresses.findMany({
                    where: { user_id: { in: userIds } },
                    select: {
                        id: true, user_id: true, type: true, address: true,
                        latitude: true, longitude: true, is_default: true, created_at: true,
                    },
                });
                allAddrs.forEach(a => {
                    if (!a.user_id) return;
                    addressCountByUser[a.user_id] = (addressCountByUser[a.user_id] ?? 0) + 1;
                });
                // Default = is_default true; tie-break = most recent
                allAddrs.forEach(a => {
                    if (!a.user_id) return;
                    const cur = defaultAddressByUser[a.user_id];
                    const isBetter =
                        !cur ||
                        (a.is_default === true) ||
                        (a.created_at && cur && (a as any).created_at > (cur as any).created_at);
                    if (isBetter) {
                        defaultAddressByUser[a.user_id] = {
                            id:        a.id,
                            type:      a.type,
                            address:   a.address,
                            latitude:  a.latitude,
                            longitude: a.longitude,
                        };
                    }
                });
            } catch (e: any) {
                console.warn('[admin/customers] consumer_addresses lookup failed:', e?.message || e);
            }
        }

        // 2026-06-04 (Q2-C): fuzzy-detect likely duplicate accounts among the loaded
        // customers — phones within Levenshtein distance ≤ 1. Catches test typos
        // (e.g. 917842687373 ↔ 917842287373). Requires the `fuzzystrmatch` extension;
        // wrapped in try/catch so if it's not enabled, we silently return no hints.
        const phoneToIds: Record<string, string[]> = {};
        users.forEach(u => {
            if (u.phone) {
                if (!phoneToIds[u.phone]) phoneToIds[u.phone] = [];
                phoneToIds[u.phone].push(u.id);
            }
        });
        const possibleDupesByUser: Record<string, string[]> = {};
        try {
            const phones = Object.keys(phoneToIds);
            if (phones.length >= 2) {
                // Self-join only the phones we've actually loaded — bounded work.
                const rows = await prisma.$queryRaw<Array<{ a_phone: string; b_phone: string }>>`
                    SELECT a.phone AS a_phone, b.phone AS b_phone
                    FROM (SELECT unnest(${phones}::text[]) AS phone) a
                    JOIN (SELECT unnest(${phones}::text[]) AS phone) b
                      ON a.phone < b.phone
                     AND LENGTH(a.phone) = LENGTH(b.phone)
                     AND levenshtein(a.phone, b.phone) <= 1
                `;
                rows.forEach(({ a_phone, b_phone }) => {
                    const aIds = phoneToIds[a_phone] ?? [];
                    const bIds = phoneToIds[b_phone] ?? [];
                    aIds.forEach(aId => {
                        bIds.forEach(bId => {
                            if (!possibleDupesByUser[aId]) possibleDupesByUser[aId] = [];
                            if (!possibleDupesByUser[bId]) possibleDupesByUser[bId] = [];
                            possibleDupesByUser[aId].push(bId);
                            possibleDupesByUser[bId].push(aId);
                        });
                    });
                });
            }
        } catch (e: any) {
            // Most common cause: `levenshtein` function not available (fuzzystrmatch
            // extension not enabled). Apply the SQL doc to enable. Until then, the
            // duplicate-hint column is silently empty.
            console.warn('[admin/customers] fuzzy-dupe check skipped:', e?.message || e);
        }

        // Reshape to snake_case for the client (matches the previous PostgREST shape).
        const customers = users.map(u => ({
            id:        u.id,
            name:      u.name ?? profileNameMap[u.id] ?? null,
            email:     u.email,
            phone:     u.phone,
            status:    u.status,
            role:      u.role,
            createdAt: u.createdAt,
            orders: u.orders.map(o => ({
                total_amount: o.totalAmount,
                created_at:   o.createdAt,
                branch_id:    o.branchId,
                status:       o.status,
            })),
            default_address:      defaultAddressByUser[u.id] ?? null,
            address_count:        addressCountByUser[u.id] ?? 0,
            potential_duplicates: possibleDupesByUser[u.id] ?? [],
        }));

        res.json({
            customers, branchCityMap,
            total:    totalCount,
            limit, offset,
            hasMore:  offset + customers.length < totalCount,
        });
    } catch (e: any) {
        console.error('[admin/customers] list error:', e?.message || e);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

/**
 * GET /admin/orders
 *
 * Returns recent orders for the /orders Admin page. Optional `userId`
 * query param filters to a single customer's orders — used by the
 * "View orders" deep link from the Customers page.
 *
 * Shape mirrors the previous Supabase .from('orders') columns so the
 * OrderManager UI doesn't have to change beyond switching its data
 * source.
 */
app.get('/admin/orders', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const userId    = typeof req.query.userId    === 'string' ? req.query.userId    : undefined;
        const limit     = Math.min(parseInt((req.query.limit as string) || '500', 10) || 500, 1000);

        const rows = await prisma.order.findMany({
            where: userId ? { userId } : undefined,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id:              true,
                orderNumber:     true,
                customer_name:   true,
                customer_phone:  true,
                storeId:         true,
                store_name:      true,
                userId:          true,
                branchId:        true,
                status:          true,
                totalAmount:     true,
                items_count:     true,
                order_type:      true,
                cancelledReason: true,
                createdAt:       true,
            },
        });

        // Reshape to snake_case for the client.
        const orders = rows.map(o => ({
            id:               o.id,
            order_number:     o.orderNumber,
            customer_name:    o.customer_name,
            customer_phone:   o.customer_phone,
            store_id:         o.storeId,
            store_name:       o.store_name,
            user_id:          o.userId,
            branch_id:        o.branchId,
            status:           o.status,
            total_amount:     o.totalAmount,
            items_count:      o.items_count,
            order_type:       o.order_type,
            cancelled_reason: o.cancelledReason,
            created_at:       o.createdAt,
        }));

        res.json({ orders, count: orders.length });
    } catch (e: any) {
        console.error('[admin/orders] list error:', e?.message || e);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

/**
 * PATCH /admin/orders/:id
 *
 * Used by OrderManager's "Force complete" / "Force cancel" actions.
 * Status must be a valid OrderStatus enum value (uppercase).
 *
 * Restricted to SUPER_ADMIN + OPERATIONS (FINANCE/SUPPORT are view-only
 * for order status — they go through /refunds-disputes for refunds).
 */
app.patch('/admin/orders/:id', async (req, res) => {
    const caller = await requireRole(req, res, ['SUPER_ADMIN', 'OPERATIONS']); if (!caller) return;
    try {
        const { id } = req.params;
        const { status, cancelledReason } = req.body ?? {};
        // 2026-06-04: full 10-value OrderStatus enum. Was missing PREPARING +
        // RETURN_REQUESTED + RETURN_APPROVED + RETURN_REJECTED — admin
        // overrides to those states would 400 even though they're valid.
        const VALID: ReadonlyArray<string> = [
            'PENDING','CONFIRMED','PREPARING','READY','COMPLETED','CANCELLED',
            'RETURN_REQUESTED','RETURN_APPROVED','RETURN_REJECTED','REFUNDED',
        ];
        if (!status || !VALID.includes(status)) {
            return res.status(400).json({ error: `status must be one of ${VALID.join(', ')}` });
        }
        // Snapshot before-state for the audit log.
        const before = await prisma.order.findUnique({
            where: { id },
            select: { status: true, cancelledReason: true },
        });
        const updated = await prisma.order.update({
            where: { id },
            data: {
                status,
                ...(cancelledReason ? { cancelledReason } : {}),
            },
            select: { id: true, status: true },
        });
        // Best-effort audit — fire-and-forget pattern, but awaited so any
        // db connection errors get logged on this turn rather than orphaned.
        await recordAdminAudit(req, {
            actorId:     caller.id,
            action:      'order.status_change',
            targetTable: 'orders',
            targetId:    id,
            before:      before ? { status: before.status, cancelledReason: before.cancelledReason } : null,
            after:       { status: updated.status, cancelledReason: cancelledReason ?? null },
            reason:      cancelledReason,
        });
        res.json({ ok: true, order: updated });
    } catch (e: any) {
        console.error('[admin/orders] patch error:', e?.message || e);
        if (e?.code === 'P2025') return res.status(404).json({ error: 'Order not found' });
        res.status(500).json({ error: 'Failed to update order' });
    }
});

/**
 * GET /admin/customers/:id/orders
 *
 * Order history for the CustomerDetailsSheet drawer. Same role gate
 * as /admin/customers.
 */
app.get('/admin/customers/:id/orders', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const { id } = req.params;
        const rows = await prisma.order.findMany({
            where: { userId: id },
            orderBy: { createdAt: 'desc' },
            take: 200,
            select: {
                id: true, orderNumber: true, store_name: true,
                totalAmount: true, status: true, createdAt: true,
            },
        });
        const orders = rows.map(o => ({
            id:           o.id,
            order_number: o.orderNumber,
            store_name:   o.store_name,
            total_amount: o.totalAmount,
            status:       o.status,
            created_at:   o.createdAt,
        }));
        res.json({ orders });
    } catch (e: any) {
        console.error('[admin/customers/:id/orders] error:', e?.message || e);
        res.status(500).json({ error: 'Failed to fetch customer orders' });
    }
});

/**
 * GET /admin/merchants/:id/orders
 *
 * Recent orders for a merchant — powers the Recent Orders tab in
 * MerchantDetailsSheet. Migrated from supabase.from('orders') direct
 * read (RLS-blocked for the authenticated JWT) to API + Prisma per the
 * "admin reads via API" architectural rule.
 */
app.get('/admin/merchants/:id/orders', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const { id } = req.params;
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 500);
        const rows = await prisma.order.findMany({
            where: { storeId: id },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true, orderNumber: true, customer_name: true,
                totalAmount: true, status: true, createdAt: true,
                items_count: true, order_type: true,
            },
        });
        res.json({
            orders: rows.map(o => ({
                id:           o.id,
                order_number: o.orderNumber,
                customer_name:o.customer_name,
                total_amount: o.totalAmount,
                status:       o.status,
                created_at:   o.createdAt,
                items_count:  o.items_count,
                order_type:   o.order_type,
            })),
        });
    } catch (e: any) {
        console.error('[admin/merchants/:id/orders] error:', e?.message || e);
        res.status(500).json({ error: 'Failed to fetch merchant orders' });
    }
});

/**
 * GET /admin/customers/:id/addresses
 *
 * All addresses for one customer — used by the CustomerDetailsSheet "Addresses"
 * section. Returned ordered by is_default DESC, created_at DESC so the default
 * shows first.
 */
app.get('/admin/customers/:id/addresses', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const { id } = req.params;
        const rows = await prisma.consumer_addresses.findMany({
            where: { user_id: id },
            orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
            select: {
                id: true, type: true, address: true,
                latitude: true, longitude: true,
                is_default: true, created_at: true,
            },
        });
        res.json({
            addresses: rows.map(a => ({
                id:         a.id,
                type:       a.type,
                address:    a.address,
                latitude:   a.latitude,
                longitude:  a.longitude,
                is_default: a.is_default ?? false,
                created_at: a.created_at,
            })),
        });
    } catch (e: any) {
        console.error('[admin/customers/:id/addresses] error:', e?.message || e);
        res.status(500).json({ error: 'Failed to fetch customer addresses' });
    }
});

/**
 * PATCH /admin/customers/:id/name
 *
 * Lets any admin-tier user manually set / correct a customer's display name.
 * Use case: incomplete signups where User.name stayed NULL and ProfileSetup
 * was abandoned; admin can patch what they know from support context.
 *
 * Audited via recordAdminAudit. Failure to audit doesn't block the update.
 */
app.patch('/admin/customers/:id/name', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const { id } = req.params;
        const { name } = req.body ?? {};
        if (typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({ error: 'name must be a string with at least 2 characters' });
        }
        const cleanName = name.trim();

        const before = await prisma.user.findUnique({
            where: { id },
            select: { id: true, name: true },
        });
        if (!before) return res.status(404).json({ error: 'User not found' });

        const updated = await prisma.user.update({
            where: { id },
            data:  { name: cleanName },
            select: { id: true, name: true },
        });

        // Best-effort audit.
        await recordAdminAudit(req, {
            actorId:     caller.id,
            action:      'customer.name_change',
            targetTable: 'User',
            targetId:    id,
            before:      { name: before.name },
            after:       { name: updated.name },
        });

        res.json({ ok: true, user: updated });
    } catch (e: any) {
        console.error('[admin/customers/:id/name] error:', e?.message || e);
        if (e?.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        res.status(500).json({ error: 'Failed to update customer name' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// Admin home dashboards — one endpoint per role-home (added 2026-06-04)
//
// The home dashboards under apps/admin-web/src/components/home/ were still
// reading via supabase.from() directly for KPI counts. RLS blocks those for
// admin-tier JWTs, so the tiles silently returned 0. Per the "admin reads
// go through API" architectural rule, each home now has a dedicated
// endpoint that aggregates everything it needs server-side via Prisma.
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/home/super-admin
 *   Platform-wide overview tiles + Recent Activity feed.
 *   Range: 24h | 7d | 30d (default 30d) — for the "new customers in range" tile.
 */
app.get('/admin/home/super-admin', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const range = (typeof req.query.range === 'string' ? req.query.range : '30d') as '24h' | '7d' | '30d';
        const days  = range === '24h' ? 1 : range === '7d' ? 7 : 30;
        const since = new Date(); since.setDate(since.getDate() - days);

        const [newCustomers, activeBranches, recentOrders, recentMerchants] = await Promise.all([
            prisma.user.count({ where: { role: 'CONSUMER', createdAt: { gte: since } } }),
            prisma.merchantBranch.count({ where: { isActive: true } }),
            prisma.order.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true, orderNumber: true, customer_name: true,
                    totalAmount: true, status: true, createdAt: true,
                },
            }),
            prisma.merchant.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, storeName: true, status: true, createdAt: true },
            }),
        ]);

        res.json({
            newCustomers,
            activeBranches,
            recentOrders: recentOrders.map(o => ({
                id: o.id, order_number: o.orderNumber, customer_name: o.customer_name,
                total_amount: o.totalAmount, status: o.status, created_at: o.createdAt,
            })),
            recentMerchants: recentMerchants.map(m => ({
                id: m.id, store_name: m.storeName, status: m.status, created_at: m.createdAt,
            })),
        });
    } catch (e: any) {
        console.error('[admin/home/super-admin] error:', e?.message || e);
        res.status(500).json({ error: 'Failed to load super-admin home' });
    }
});

/**
 * GET /admin/home/operations
 *   Queue depths + today's order momentum (hourly buckets) + KYC + inbox feeds.
 */
app.get('/admin/home/operations', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const sinceMidnight = new Date(); sinceMidnight.setHours(0, 0, 0, 0);

        // Include the new PREPARING status in the "active queue" count (was missing
        // pre-2026-06-04). Cast to any so we don't need to import the Prisma enum here.
        const ACTIVE_FOR_QUEUE = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] as any[];

        const [
            pendingOrders, kycPending, inboxUnread, activeBranches,
            pendingKycList, recentInboxRows, todaysOrders,
        ] = await Promise.all([
            prisma.order.count({ where: { status: { in: ACTIVE_FOR_QUEUE } } }),
            prisma.merchant.count({ where: { kycStatus: 'pending' } }),
            prisma.watiInbox.count({ where: { isRead: false } }),
            prisma.merchantBranch.count({ where: { isActive: true } }),
            prisma.merchant.findMany({
                where: { kycStatus: 'pending' },
                orderBy: { createdAt: 'desc' },
                take: 8,
                select: { id: true, storeName: true, kycStatus: true, createdAt: true },
            }),
            prisma.watiInbox.findMany({
                orderBy: { receivedAt: 'desc' },
                take: 8,
                select: {
                    id: true, contactName: true, waPhone: true, body: true,
                    receivedAt: true, isRead: true,
                },
            }),
            prisma.order.findMany({
                where: { createdAt: { gte: sinceMidnight } },
                select: { createdAt: true },
            }),
        ]);

        // Bucket today's orders into hours (server-side — was client-side before).
        const buckets: Record<number, number> = {};
        todaysOrders.forEach(o => {
            const h = new Date(o.createdAt).getHours();
            buckets[h] = (buckets[h] ?? 0) + 1;
        });
        const todaysOrdersHourly: { hour: string; orders: number }[] = [];
        const nowHour = new Date().getHours();
        for (let h = 0; h <= nowHour; h++) {
            todaysOrdersHourly.push({
                hour: `${h.toString().padStart(2, '0')}:00`,
                orders: buckets[h] ?? 0,
            });
        }

        res.json({
            pendingOrders, kycPending, inboxUnread, activeBranches,
            pendingKycList: pendingKycList.map(m => ({
                id: m.id, store_name: m.storeName,
                kyc_status: m.kycStatus, created_at: m.createdAt,
            })),
            recentInboxMessages: recentInboxRows.map(r => ({
                id: r.id, contact_name: r.contactName, wa_phone: r.waPhone,
                body: r.body, received_at: r.receivedAt, is_read: r.isRead,
            })),
            todaysOrdersHourly,
        });
    } catch (e: any) {
        console.error('[admin/home/operations] error:', e?.message || e);
        res.status(500).json({ error: 'Failed to load operations home' });
    }
});

/**
 * GET /admin/home/support
 *   Inbox + cancellation tiles + recent inbox/cancellations.
 */
app.get('/admin/home/support', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const sinceMidnight = new Date(); sinceMidnight.setHours(0, 0, 0, 0);

        const [
            inboxUnread, inboxTotal, cancelledToday,
            recentMessages, recentCancellations,
        ] = await Promise.all([
            prisma.watiInbox.count({ where: { isRead: false } }),
            prisma.watiInbox.count(),
            prisma.order.count({
                where: { status: 'CANCELLED', createdAt: { gte: sinceMidnight } },
            }),
            prisma.watiInbox.findMany({
                orderBy: { receivedAt: 'desc' },
                take: 12,
                select: {
                    id: true, contactName: true, waPhone: true, body: true,
                    receivedAt: true, isRead: true, status: true,
                },
            }),
            prisma.order.findMany({
                where: { status: 'CANCELLED' },
                orderBy: { createdAt: 'desc' },
                take: 8,
                select: {
                    id: true, orderNumber: true, customer_name: true,
                    customer_phone: true, totalAmount: true,
                    createdAt: true, cancelledReason: true,
                },
            }),
        ]);

        res.json({
            inboxUnread, inboxTotal, cancelledToday,
            recentMessages: recentMessages.map(r => ({
                id: r.id, contact_name: r.contactName, wa_phone: r.waPhone,
                body: r.body, received_at: r.receivedAt, is_read: r.isRead, status: r.status,
            })),
            recentCancellations: recentCancellations.map(o => ({
                id: o.id, order_number: o.orderNumber, customer_name: o.customer_name,
                customer_phone: o.customer_phone, total_amount: o.totalAmount,
                created_at: o.createdAt, cancelled_reason: o.cancelledReason,
            })),
        });
    } catch (e: any) {
        console.error('[admin/home/support] error:', e?.message || e);
        res.status(500).json({ error: 'Failed to load support home' });
    }
});

/**
 * GET /admin/home/finance
 *   Refund-pressure count. The rest of the Finance home uses
 *   get_super_admin_stats_in_range RPC which already works.
 */
app.get('/admin/home/finance', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const refundLike = await prisma.order.count({
            where: { status: { in: ['CANCELLED', 'REFUNDED'] } },
        });
        res.json({ refundLike });
    } catch (e: any) {
        console.error('[admin/home/finance] error:', e?.message || e);
        res.status(500).json({ error: 'Failed to load finance home' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// Self-profile update — consumer-side (added 2026-06-04, Option A)
//
// The consumer app's ProfileSetupScreen currently writes the user's name to
// public.profiles.full_name only. Our admin UI reads from public."User".name.
// Result: every user who completed profile-setup still showed "(no name)"
// in admin because the two columns were never synced.
//
// This endpoint accepts the same payload the screen already builds and
// writes to BOTH tables in a single Prisma transaction. The consumer app
// is being updated to call this instead of the direct supabase.from()
// upsert; the existing screen code path stays around as a fallback during
// the OTA rollout window.
// ────────────────────────────────────────────────────────────────────────────

app.post('/me/profile', async (req, res) => {
    const caller = await requireUser(req, res); if (!caller) return;
    try {
        const { name, email, dateOfBirth, avatarUrl } = req.body ?? {};

        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({ error: 'name must be a string with at least 2 characters' });
        }
        const cleanName = name.trim();

        // Resolve a phone if we already have one on the User row — needed only
        // when we create a fresh User (consumer JIT case).
        const existing = await prisma.user.findUnique({
            where: { id: caller.id },
            select: { id: true, phone: true, email: true },
        });
        const fallbackEmail = caller.email
            || existing?.email
            || `${caller.id}@user.pickatstore.app`;

        await prisma.$transaction([
            prisma.user.upsert({
                where: { id: caller.id },
                update: { name: cleanName },
                create: {
                    id:    caller.id,
                    email: fallbackEmail,
                    phone: existing?.phone ?? null,
                    name:  cleanName,
                    role:  'CONSUMER',
                },
            }),
            prisma.profile.upsert({
                where: { id: caller.id },
                update: {
                    fullName:         cleanName,
                    ...(email      ? { email }                                  : {}),
                    ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) }    : {}),
                    ...(avatarUrl  ? { avatarUrl }                              : {}),
                    profileCompleted: true,
                    updatedAt:        new Date(),
                },
                create: {
                    id:               caller.id,
                    fullName:         cleanName,
                    email:            email      ?? null,
                    dateOfBirth:      dateOfBirth ? new Date(dateOfBirth) : null,
                    avatarUrl:        avatarUrl  ?? null,
                    profileCompleted: true,
                    updatedAt:        new Date(),
                },
            }),
        ]);

        res.json({ ok: true, name: cleanName });
    } catch (e: any) {
        console.error('[me/profile] update error:', e?.message || e);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// --- 404 Handler ---
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// --- Sentry Express error handler ---
// Per Sentry's Express SDK guidance, this MUST be registered after all
// controllers + the 404 handler, and BEFORE any other error-handling middleware.
// It does NOT swallow the error — control flows on to the global error handler
// below, which still returns the JSON response to the client.
Sentry.setupExpressErrorHandler(app);

// --- Global Error Handler ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Error Handler]', err);
    if (res.headersSent) {
        return next(err);
    }
    // Force JSON response
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred',
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
});

// --- Socket.io Setup ---
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH"]
    }
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('join_store', (storeId) => {
        socket.join(`store_${storeId}`);
    });
});

/**
 * GET /auth/merchant/profile
 * Securely fetches the complete merchant profile with signed URLs for private documents.
 * Header: Authorization: Bearer <token>
 */
app.get('/auth/merchant/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid token' });
        }
        const token = authHeader.split(' ')[1];

        // 1. Authenticate user from Supabase token (Zero-Trust)
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        const userId = user.id;

        // 2. Fetch comprehensive merchant data via Prisma
        const merchantData = await prisma.merchant.findUnique({
            where: { id: userId },
            include: {
                branches: true,
                subscriptions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!merchantData) {
            return res.status(404).json({ error: 'Merchant profile not found' });
        }

        // Fetch associated store (aligned with signup ID mapping)
        const storeData = await prisma.store.findUnique({
            where: { id: userId },
            include: {
                city: true
            }
        });

        // 3. Generate Signed URLs for private document storage (1-hour expiry)
        const signUrl = async (path: string | null) => {
            if (!path) return null;
            // Use supabaseAdmin to bypass public access requirements
            const { data, error } = await supabaseAdmin.storage
                .from('merchant-docs')
                .createSignedUrl(path, 3600);
            return error ? null : data?.signedUrl;
        };

        const [
            panUrl, 
            aadharFrontUrl, 
            aadharBackUrl, 
            msmeUrl, 
            gstUrl, 
            fssaiUrl
        ] = await Promise.all([
            signUrl(merchantData.panDocUrl),
            signUrl(merchantData.aadharFrontUrl),
            signUrl(merchantData.aadharBackUrl),
            signUrl(merchantData.msmeCertificateUrl),
            signUrl(merchantData.gstCertificateUrl),
            signUrl(merchantData.fssaiCertificateUrl)
        ]);

        // 4. Clean, Flattened Response (Data Sanitization)
        const profileResponse = {
            id: merchantData.id,
            ownerName: merchantData.ownerName,
            email: merchantData.email,
            phone: merchantData.phone,
            status: merchantData.status,
            kycStatus: merchantData.kycStatus,
            store: storeData ? {
                name: storeData.name,
                address: storeData.address,
                city: storeData.city?.name,
                image: storeData.image,
                active: storeData.active
            } : null,
            kyc: {
                panNumber: merchantData.panNumber,
                aadharNumber: merchantData.aadharNumber,
                msmeNumber: merchantData.msmeNumber,
                gstNumber: merchantData.gstNumber,
                fssaiNumber: merchantData.fssaiNumber,
                bankAccount: merchantData.bankAccountNumber,
                ifsc: merchantData.ifscCode,
                beneficiaryName: merchantData.bankBeneficiaryName,
                docUrls: {
                    pan: panUrl,
                    aadharFront: aadharFrontUrl,
                    aadharBack: aadharBackUrl,
                    msme: msmeUrl,
                    gst: gstUrl,
                    fssai: fssaiUrl
                }
            },
            branches: merchantData.branches.map(b => ({
                id: b.id,
                name: b.branchName,
                manager: b.managerName,
                phone: b.phone,
                isActive: b.isActive
            })),
            subscription: merchantData.subscriptions[0] ? {
                status: merchantData.subscriptions[0].status,
                amount: merchantData.subscriptions[0].amount,
                createdAt: merchantData.subscriptions[0].createdAt
            } : null
        };

        res.json(profileResponse);

    } catch (error: any) {
        console.error('[Auth] Merchant Profile Fetch Error:', error);
        res.status(500).json({ error: 'Internal Server Error while fetching profile' });
    }
});

// --- Server Start ---
server.listen(Number(port), '0.0.0.0', () => {
    console.log(`[API] Server running on http://0.0.0.0:${port}`);
    console.log(`[API] Socket.io ready`);
});
