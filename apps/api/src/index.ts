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

// --- Routes ---

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), service: 'pick-at-store-api' });
});

// Get Products
app.get('/products', async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                images: true
            }
        });
        res.json(products);
    } catch (error) {
        console.error('Products API Error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
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
            { header: 'image', key: 'image', width: 40 }
        ];

        // 2. Create Reference Sheet (Hidden)
        const refSheet = workbook.addWorksheet('RefData');
        refSheet.state = 'hidden';
        const categories = [
            'Dairy',
            'Bakery',
            'Snacks',
            'Staples',
            'Condiments',
            'Confectionery',
            'Grocery'
        ];
        // Write categories to column A of RefData
        categories.forEach((cat, index) => {
            refSheet.getCell(`A${index + 1}`).value = cat;
        });

        // 3. Add Data Validation to "Category" Column (Column C is index 3)
        // We apply it to rows 2-1000 to cover reasonable usage
        for (let i = 2; i <= 1000; i++) {
            const cell = worksheet.getCell(`C${i}`);
            cell.dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$A$1:$A$${categories.length}`],
                showErrorMessage: true,
                errorStyle: 'stop',
                errorTitle: 'Invalid Category',
                error: 'Please select a valid category from the list.'
            };
        }

        // 4. Add Sample Row
        worksheet.addRow({
            name: 'Sample Product',
            mrp: 100,
            category: 'Snacks',
            brand: 'Generic',
            ean: '123456789',
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
            if (isNaN(mrp)) {
                skipped.push({ row: rowNumber, name: row.name, reason: 'Invalid MRP (Not a number)' });
                continue;
            }

            // 3. Check Duplicate EAN (if provided)
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
                    }
                });
                await logAudit(product.id, 'CREATE', null, null, null, 'Bulk Import');
                created.push(product);
            } catch (dbError) {
                console.error('Row Import Error:', dbError);
                skipped.push({ row: rowNumber, name: row.name, reason: 'Database Error' });
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
            await logAudit(id, 'DELETE', null, JSON.stringify(product), null);
            await prisma.product.delete({ where: { id } });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Patch Product (with Audit)
app.patch('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Fetch existing for audit
        const oldProduct = await prisma.product.findUnique({ where: { id } });
        if (!oldProduct) return res.status(404).json({ error: 'Product not found' });

        const updateData: any = {};
        if (updates.mrp !== undefined) updateData.mrp = parseFloat(updates.mrp);
        if (updates.category !== undefined) updateData.category = updates.category;
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.brand !== undefined) updateData.brand = updates.brand;
        if (updates.ean !== undefined) updateData.ean = updates.ean;
        if (updates.image !== undefined) updateData.image = updates.image;

        const newProduct = await prisma.product.update({
            where: { id },
            data: updateData,
            include: { images: true }
        });

        // Audit Logs
        for (const [key, value] of Object.entries(updateData)) {
            const oldValue = (oldProduct as any)[key];
            if (oldValue != value) {
                await logAudit(id, 'UPDATE', key, oldValue, value);
            }
        }

        res.json(newProduct);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Add Image to Product
app.post('/products/:id/images', async (req, res) => {
    try {
        const { id } = req.params;
        const { url, name, isPrimary } = req.body;

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
        res.status(500).json({ error: 'Failed to add image' });
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
