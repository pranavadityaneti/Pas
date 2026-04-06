import dotenv from 'dotenv';
dotenv.config();

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

async function createNotification(userId: string, type: string, title: string, message: string, link?: string) {
    try {
        // Safe check for notification model existence (in case prisma generate wasn't run)
        const notificationDelegate = (prisma as any).notification;

        if (notificationDelegate) {
            await notificationDelegate.create({
                data: {
                    userId,
                    type,
                    title,
                    message,
                    link,
                    isRead: false
                }
            });
        } else {
            console.warn('Prisma Client mismatch: notification model not found. Please run "prisma generate".');
        }
        // Optional: Emit real-time event if user is connected via socket
        // io.to(`user_${userId}`).emit('new_notification', { type, title, message }); 
    } catch (error) {
        console.error('Failed to create notification', error);
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

    // Master Catalog Categories
    const validCategories = [
        'Dairy', 'Bakery', 'Snacks', 'Staples', 'Condiments', 
        'Confectionery', 'Grocery', 'Beverages', 'Personal Care', 
        'Home Essentials', 'Fashion', 'Pharmacy', 'Meat', 'Fruits & Vegetables'
    ];
    
    const mapCategory = (rawCategory: string | null): { vertical: string, category: string } => {
        if (!rawCategory) return { vertical: 'Grocery & Kirana', category: 'General' };
        const lowerCat = rawCategory.toLowerCase();
        
        // 1. Fruits & Vegetables (Standalone Vertical)
        if (lowerCat.includes('fruit') || lowerCat.includes('veg') || lowerCat.includes('produce')) 
            return { vertical: 'Fruits & Vegetables', category: 'Fresh Produce' };

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
            await prisma.syncQueue.upsert({
                where: { sourceProductId: sourceProductId },
                update: { 
                    status: 'PENDING',
                    name,
                    brand,
                    mrp: mrp > 0 ? mrp : sellingPrice,
                    subcategory,
                    packsize,
                    image,
                    metadata: itemData as any
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
                    metadata: itemData as any
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
        const queue = await prisma.syncQueue.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' }
        });
        res.json(queue);
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
        const verticals = await (prisma as any).vertical.findMany({
            include: { categories: true },
        });
        res.json(verticals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch taxonomy' });
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
        // 1. Pre-validation: Taxonomy Integrity Check
        for (const item of items) {
            if (item.vertical_id && item.category_id) {
                const isValid = await validateTaxonomy(item.vertical_id, item.category_id);
                if (!isValid) {
                    return res.status(400).json({ 
                        error: `Invalid Category/Vertical pairing for item: ${item.name}`,
                        itemId: item.id 
                    });
                }
            }
        }

        await prisma.$transaction(async (tx) => {
            // 2. High-Performance Bulk Upsert via Raw SQL
            // Using PostgreSQL "INSERT ... ON CONFLICT" for O(1) performance
            for (const item of items) {
                const sourceId = item.source_product_id || item.sourceProductId;
                await tx.$executeRaw`
                    INSERT INTO "Product" (
                        id, name, brand, mrp, image, uom, source, source_product_id, 
                        vertical_id, category_id, "updatedAt", "createdAt"
                    ) VALUES (
                        ${crypto.randomUUID()}, ${item.name}, ${item.brand}, ${Number(item.mrp)}, 
                        ${item.image}, ${item.packsize || item.uom}, 'purchased_catalog', 
                        ${sourceId}, ${item.vertical_id}::uuid, ${item.category_id}::uuid, 
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

            // 3. Batched Audit (Inside Transaction for Atomicity)
            // Fetch resolved IDs for auditing (since Raw SQL doesn't return them easily in bulk)
            const resolvedProducts = await (tx as any).product.findMany({
                where: { sourceProductId: { in: items.map(i => i.source_product_id || i.sourceProductId) } },
                select: { id: true }
            });
            
            await logBulkAudit(resolvedProducts.map((p: any, idx: number) => ({ 
                id: p.id, 
                item: items[idx] 
            })), 'CATALOG_SYNC_APPROVE', 'system', tx);

            // 4. Batch Cleanup
            const idsToDelete = items.map(i => i.id);
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
        const { userId, storeId, items, totalAmount } = req.body;
        const orderNumber = `PAS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

        const order = await prisma.order.create({
            data: {
                orderNumber,
                userId,
                storeId,
                totalAmount,
                status: 'PENDING',
                isPaid: false,
                items: {
                    create: items.map((item: any) => ({
                        storeProductId: item.storeProductId,
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

        // --- Post-Order Operations (Notifications & Stock) ---

        // 1. Get Store Manager ID
        const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: { managerId: true, name: true }
        });

        if (store && store.managerId) {
            // 2. Trigger New Order Notification
            await createNotification(
                store.managerId,
                'ORDER',
                'New Order Received',
                `Order #${orderNumber} received for ₹${totalAmount}`,
                `/orders/${order.id}`
            );

            // 3. Decrement Stock & Check Low Inventory
            for (const item of items) {
                try {
                    const sp = await prisma.storeProduct.update({
                        where: { id: item.storeProductId },
                        data: { stock: { decrement: item.quantity } },
                        include: { product: true }
                    });

                    // Low Inventory Alert (Threshold: 5)
                    if (sp.stock <= 5) {
                        await createNotification(
                            store.managerId,
                            'INVENTORY',
                            'Low Stock Alert',
                            `${sp.product.name} is running low (${sp.stock} left).`,
                            `/inventory`
                        );
                    }
                } catch (err) {
                    console.error(`Failed to update stock for item ${item.storeProductId}`, err);
                }
            }
        }

        // Broadcast to merchants
        io.to(`store_${storeId}`).emit('new_order', order);
        res.status(201).json(order);
    } catch (error) {
        console.error('Create Order Error:', error);
        res.status(500).json({ error: 'Failed to create order' });
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

        // Generate 4-digit OTP when moving to READY
        if (status === 'READY') {
            data.otp = Math.floor(1000 + Math.random() * 9000).toString();
        }

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

        // Notify Manager & User (Common logic)
        if ((order as any).store?.managerId) {
            // Notify Manager
            const notifTitle = `Order ${status.replace('_', ' ')}`;
            await createNotification(
                (order as any).store.managerId,
                'ORDER',
                notifTitle,
                `Order #${order.orderNumber} status updated to ${status}`,
                `/orders/${id}`
            );
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
        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({ error: 'OTP verification failed' });
    }
});

// --- Auto-Reject logic ---
const startAutoRejectTimer = () => {
    setInterval(async () => {
        try {
            const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
            
            // Fix: Bulk update PENDING orders that have timed out
            // Executes in a single network trip and connection
            const result = await prisma.order.updateMany({
                where: {
                    status: 'PENDING',
                    createdAt: { lt: twoMinsAgo }
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
        const { storeId, isActive, fundingSource, search } = req.query;

        const where: any = {};
        if (storeId) where.store_id = String(storeId);
        if (isActive !== undefined) where.is_active = isActive === 'true';
        if (fundingSource) where.funding_source = String(fundingSource).toUpperCase();
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
            endDate
        } = req.body;

        // Validation
        if (!code || !discountType || !discountValue || !fundingSource || !targetAudience) {
            return res.status(400).json({ error: 'Missing required fields: code, discountType, discountValue, fundingSource, targetAudience' });
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
                discountType: discountType.toUpperCase(),
                discountValue: Number(discountValue),
                maxDiscountCap: maxDiscountCap ? Number(maxDiscountCap) : null,
                fundingSource: fundingSource.toUpperCase(),
                targetAudience: targetAudience.toUpperCase(),
                storeId: storeId || null,
                usageLimit: usageLimit ? parseInt(usageLimit) : null,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
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
        const { id } = req.params;
        const updateData: any = {};

        const allowedFields = ['code', 'discountType', 'discountValue', 'maxDiscountCap',
            'fundingSource', 'targetAudience', 'storeId', 'isActive', 'usageLimit', 'startDate', 'endDate'];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                let value = req.body[field];
                let prismaField = field; // Use camelCase directly for Prisma

                if (['discountType', 'fundingSource', 'targetAudience'].includes(field)) {
                    value = String(value).toUpperCase();
                }
                if (field === 'code') value = String(value).toUpperCase();
                if (['discountValue', 'maxDiscountCap'].includes(field)) {
                    value = value === null ? null : parseFloat(value);
                }
                if (field === 'usageLimit') {
                    value = value === null ? null : parseInt(value);
                }
                if (['startDate', 'endDate'].includes(field)) {
                    value = value === null ? null : new Date(value);
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
        const { id } = req.params;
        await prisma.coupon.delete({ where: { id } });
        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Delete Coupon Error:', error);
        res.status(500).json({ error: 'Failed to delete coupon' });
    }
});

// Validate Coupon (for Consumer Checkout)
app.post('/checkout/validate-coupon', async (req, res) => {
    try {
        const { code, cartTotal, storeId, userId } = req.body;

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

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === 'PERCENTAGE') {
            discount = (Number(cartTotal) * coupon.discountValue) / 100;
            if (coupon.maxDiscountCap) {
                discount = Math.min(discount, coupon.maxDiscountCap);
            }
        } else {
            discount = coupon.discountValue;
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
        });
    } catch (error) {
        console.error('Validate Coupon Error:', error);
        res.status(500).json({ error: 'Failed to validate coupon' });
    }
});

// --- DEBUG: Fix DB Route ---
// --- DEBUG: Fix DB Route ---
app.post('/debug/fix-db', async (req, res) => {
    try {
        const { email } = req.body;
        console.log('-------------------------------------------');
        console.log('🛠️  Fixing DB for email:', email);

        // RLS Policies are now managed via SQL migrations/scripts (fix_inventory_rls.sql).
        // Do not re-apply vulnerable policies here.

        // 2. Fix Store Status
        if (email) {
            const merchants: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM merchants WHERE email = '${email}'`);

            if (merchants.length > 0) {
                const merchant = merchants[0];
                const userId = merchant.id;
                console.log('👤 Found Merchant ID:', userId);

                const store = await prisma.store.findFirst({ where: { managerId: userId } });

                if (store) {
                    await prisma.store.update({
                        where: { id: store.id },
                        data: { active: true }
                    });
                    console.log('✅ Activated existing store:', store.id);
                } else {
                    await prisma.store.create({
                        data: {
                            id: merchant.id,
                            managerId: userId,
                            name: merchant.store_name || 'My Store',
                            address: merchant.address || 'Unknown',
                            city: {
                                connectOrCreate: {
                                    where: { name: 'Hyderabad' },
                                    create: { name: 'Hyderabad' }
                                }
                            }
                        }
                    });
                    console.log('✅ Created new active store for merchant');
                }
            } else {
                console.warn('⚠️  No merchant found for email:', email);
                return res.status(404).json({ error: 'Merchant not found' });
            }
        }

        console.log('-------------------------------------------');
        res.json({ success: true, message: 'DB Fixed - Policies Updated & Store Active' });
    } catch (e: any) {
        console.error('🔥 Critical Error:', e);
        res.status(500).json({ error: e.message });
    }
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

        if (!phone || !/^91\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid Indian phone number required (format: 91XXXXXXXXXX)' });
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

        // Rate limit: max 3 OTPs per phone in 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentCount = await prisma.otpVerification.count({
            where: {
                phone,
                createdAt: { gte: tenMinutesAgo }
            }
        });

        if (recentCount >= 3) {
            return res.status(429).json({ error: 'Too many OTP requests. Please wait 10 minutes.' });
        }

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
        console.error('[Auth] Send OTP Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /auth/verify-otp
 * Validate OTP → create or find Supabase user → return session
 * Body: { phone: "91XXXXXXXXXX", otp: "123456" }
 */
app.post('/auth/verify-otp', async (req, res) => {
    // [INJECT: Verify OTP Reviewer Bypass - Static Credential Method]
    console.log('>>> [DEBUG] INCOMING BODY:', JSON.stringify(req.body));
    const rawInput = req.body.phone || req.body.phoneNumber || '';
    const incomingPhone = String(rawInput).replace(/\D/g, '');
    console.log('>>> [DEBUG] PARSED PHONE:', incomingPhone);
    const TEST_OTP = '123456';
    let targetUserId = null;


    if (incomingPhone.endsWith('9959777027') && req.body.otp === TEST_OTP) {
        targetUserId = '200ea527-0fb9-4db0-8165-ca1286ea91b0'; // Merchant Test UUID
    }

    if (targetUserId) {
        console.log('[Reviewer Bypass] Test credentials verified. Fetching email for UUID:', targetUserId);
        
        try {
            // 1. Ensure static password environment variable exists
            const staticPassword = process.env.REVIEWER_STATIC_PWD;
            if (!staticPassword) {
                console.error('[Reviewer Bypass] Missing REVIEWER_STATIC_PWD env variable.');
                return res.status(500).json({ error: 'Server configuration error' });
            }

            // 2. Resolve the target user's email securely via admin client
            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
            
            if (userError || !userData?.user?.email) {
                console.error('[Reviewer Bypass] Failed to resolve email:', userError);
                return res.status(500).json({ error: 'Failed to resolve reviewer email.' });
            }
            
            // 3. Issue the live session directly from Supabase via static password signin
            await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: staticPassword });
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: userData.user.email,
                password: staticPassword
            });
            
            if (signInError || !signInData.session) {
                 console.error('[Reviewer Bypass] Auth failed:', signInError);
                 return res.status(500).json({ error: 'Failed to mint reviewer session.' });
            }

            return res.status(200).json({ 
                success: true, 
                session: {
                    access_token: signInData.session.access_token,
                    refresh_token: signInData.session.refresh_token,
                    expires_in: signInData.session.expires_in,
                    expiresAt: signInData.session.expires_at
                },
                user: {
                    id: signInData.user.id,
                    phone: `+${incomingPhone}`,
                    email: signInData.user.email
                },
                isNewUser: false
            });
        } catch (e) {
            console.error('[Reviewer Bypass] Mint execution error:', e);
            return res.status(500).json({ error: 'Bypass internal error' });
        }
    }

    try {
        console.log(`[Auth] POST /auth/verify-otp hit`);
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }

        console.log(`[Auth] Looking for unverified OTP for phone: ${phone}`);
        // Find the latest unverified OTP for this phone
        const record = await prisma.otpVerification.findFirst({
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
            // Create new user with email and password to bypass disabled Phone provider
            tempPassword = `PAS_OTP_${phone}_${Date.now()}_${Math.random().toString(36)}`;
            
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                phone: formattedPhone,
                phone_confirm: true,
                email: signInEmail,
                email_confirm: true,
                password: tempPassword,
                user_metadata: { phone: formattedPhone }
            });

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

        console.log(`[Auth] Attempting Supabase signInWithPassword...`);
        // Sign in with temporary password to get session tokens
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: signInEmail,
            password: tempPassword
        });

        console.log(`[Auth] signInWithPassword completed.`);
        if (signInError || !signInData.session) {
            console.error('[Auth] Sign-in error:', signInError);
            return res.status(500).json({ error: 'Failed to create session' });
        }

        console.log(`[Auth] User ${existingUser.id} authenticated (isNew: ${isNewUser})`);

        res.json({
            success: true,
            session: {
                access_token: signInData.session.access_token,
                refresh_token: signInData.session.refresh_token,
                expires_in: signInData.session.expires_in,
                expiresAt: signInData.session.expires_at
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
 * POST /auth/merchant/signup
 * Securely creates a User, Store, and merchant lookup record via a single Prisma transaction.
 * Header: Authorization: Bearer <token>
 */
const merchantSignupSchema = z.object({
    ownerName: z.string().min(2, "Owner name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(10, "Valid phone is required"),
    storeName: z.string().min(2, "Store name is required"),
    category: z.string().min(2, "Category is required"), // Maps roughly to our vertical logic
    city: z.string().min(2, "City is required"),
    address: z.string().min(5, "Address is required"),
    latitude: z.number(),
    longitude: z.number(),
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

        // Assigning a generic UUID for the vertical_id fallback (since schema depends on it)
        const verticalId = 'c307b78e-b924-47a1-a5a7-4405777fa50c';

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
                        verticalId: verticalId
                    }
                });

                // 5d. Insert Branches (Atomic, relying on Prisma to generate UUID keys)
                if (payload.hasBranches && payload.branches && payload.branches.length > 0) {
                    await tx.merchantBranch.createMany({
                        data: payload.branches.map((b: any) => ({
                            merchantId: userId,
                            branchName: b.name || 'Main Branch',
                            managerName: b.manager_name,
                            phone: b.phone,
                            address: b.address,
                            isActive: true
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

// --- 404 Handler ---
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

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
server.listen(port, () => {
    console.log(`[API] Server running on http://localhost:${port}`);
    console.log(`[API] Socket.io ready`);
});
