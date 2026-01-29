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

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json());

// --- Helper Functions ---
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
        category: 'Dairy',
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
            brand,
            minPrice,
            maxPrice,
            gstRate,
            missingData
        } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // Build Filter Conditions
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { ean: { contains: String(search) } }
            ];
        }

        if (category) {
            where.category = { in: String(category).split(',') };
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

        const categories = ['Dairy', 'Bakery', 'Snacks', 'Staples', 'Condiments', 'Confectionery', 'Grocery'];
        const unitTypes = ['ml', 'L', 'kg', 'g', 'pc'];
        const gstRates = [0, 5, 12, 18, 28];

        // Populate RefData: Column A = Categories, B = Unit Types, C = GST Rates
        categories.forEach((c, i) => refSheet.getCell(`A${i + 1}`).value = c);
        unitTypes.forEach((u, i) => refSheet.getCell(`B${i + 1}`).value = u);
        gstRates.forEach((g, i) => refSheet.getCell(`C${i + 1}`).value = g);

        // 3. Apply Data Validations (Rows 2-1000)
        for (let i = 2; i <= 1000; i++) {
            // Category (Column C)
            worksheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$A$1:$A$${categories.length}`]
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
            category: 'Dairy',
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
            category: p.category,
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
                category: p.category,
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
            if (!row.name || !row.mrp || !row.category) {
                skipped.push({
                    row: rowNumber,
                    name: row.name || 'Unknown',
                    reason: `Missing mandatory fields: ${!row.name ? 'Name ' : ''}${!row.mrp ? 'MRP ' : ''}${!row.category ? 'Category' : ''}`
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
                        mrp: mrp,
                        category: row.category,
                        brand: row.brand || null,
                        ean: row.ean ? String(row.ean) : null,
                        image: row.image || null,
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
        if (updates.category !== undefined) updateData.category = updates.category;
        if (updates.gstRate !== undefined) updateData.gstRate = parseFloat(updates.gstRate);
        if (updates.unitType !== undefined) updateData.unitType = updates.unitType;
        if (updates.brand !== undefined) updateData.brand = updates.brand;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        // Log audit for each product (fire-and-forget)
        const changedFields = Object.keys(updateData).join(', ');
        for (const id of ids) {
            logAudit(id, 'BULK_UPDATE', changedFields, null, JSON.stringify(updateData)).catch(() => { });
        }

        // Update all products in a single transaction
        const result = await prisma.product.updateMany({
            where: { id: { in: ids } },
            data: updateData
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

// --- Merchant Routes ---

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
                created_at: m.created_at
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

// --- Socket.io Setup ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
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

// --- Server Start ---
httpServer.listen(port, () => {
    console.log(`[API] Server running on http://localhost:${port}`);
    console.log(`[API] Socket.io ready`);
});
