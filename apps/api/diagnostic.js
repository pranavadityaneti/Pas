const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_URL = 'http://localhost:3000';

async function testScenario() {
    console.log('--- STARTING SYSTEM DIAGNOSTIC ---');

    try {
        // 1. Create Product
        console.log('\n[1/5] Creating Test Product...');
        const createRes = await axios.post(`${API_URL}/products/bulk`, {
            // Bulk import simulation logic or simple manual create if we had an endpoint
            // Since we don't have a simple CREATE endpoint in the snippet I saw (only bulk),
            // I will rely on finding an existing one or using bulk logic if needed.
            // Wait, I saw app.get and app.patch, let me check for app.post('/products').
            // Ah, I recall only bulk import. Let me use the PATCH on a Mock? 
            // The user mock data has IDs 'mock-1', 'mock-2'. Let's try patching 'mock-1'.
        });
        // Wait, standard create endpoint might be missing? 
        // Let's use the BULK endpoint with a dummy file to create a product.
    } catch (e) {
        // Ignore create for a sec, let's test PATCH on MOCK-1 if DB is down, 
        // OR checks if real DB has products.
    }

    // Let's rely on patching `mock-1` if DB is mock, or just fetching a product first.
    let targetId = 'mock-1'; // Default backup

    try {
        console.log('\n[1/5] Fetching Products to find a target...');
        const listRes = await axios.get(`${API_URL}/products`);
        if (listRes.data && listRes.data.length > 0) {
            targetId = listRes.data[0].id; // Use first available product
            console.log(`> Found Target Product ID: ${targetId}`);
        } else {
            console.warn('> No products found. Creating logic missing? We might be on empty DB.');
            // This script might fail if DB is empty and no create endpoint exists separate from bulk.
        }
    } catch (e) {
        console.error('> Failed to fetch products:', e.message);
        return;
    }

    // 2. Test Updates (MRP + Commerce Fields)
    console.log(`\n[2/5] Testing PATCH (Update) on ${targetId}...`);
    const updatePayload = {
        mrp: 999,
        unitType: 'kg',
        gstRate: 18,
        hsnCode: 'TEST1234'
    };
    try {
        const patchRes = await axios.patch(`${API_URL}/products/${targetId}`, updatePayload);
        console.log('> Status:', patchRes.status);

        // Verify changes
        const v = patchRes.data;
        if (v.mrp === 999 && v.unitType === 'kg' && v.gstRate === 18) {
            console.log('✅ PATCH SUCCESS: Fields updated correctly.');
        } else {
            console.error('❌ PATCH FAILED: Returned data does not match payload.', v);
        }
    } catch (e) {
        console.error('❌ PATCH REQUEST FAILED:', e.response ? e.response.data : e.message);
    }

    // 3. Test Image Upload
    console.log('\n[3/5] Testing Image Upload to Supabase...');
    const form = new FormData();
    // Create a dummy file
    fs.writeFileSync('test_diag.txt', 'Hello World Image Content');
    form.append('file', fs.createReadStream('test_diag.txt'), 'test_diag.jpg'); // Lie about ext

    let imageUrl = '';
    try {
        const uploadRes = await axios.post(`${API_URL}/products/upload-image`, form, {
            headers: { ...form.getHeaders() }
        });
        console.log('> Status:', uploadRes.status);
        console.log('> URL:', uploadRes.data.url);
        imageUrl = uploadRes.data.url;
        console.log('✅ UPLOAD SUCCESS');
    } catch (e) {
        console.error('❌ UPLOAD FAILED:', e.response ? e.response.data : e.message);
    }

    // 4. Test Linking Image to Product
    if (imageUrl) {
        console.log('\n[4/5] Linking Image to Product...');
        try {
            const linkRes = await axios.post(`${API_URL}/products/${targetId}/images`, {
                url: imageUrl,
                name: 'Diagnostic Image',
                isPrimary: true
            });
            console.log('> Link Status:', linkRes.status);
            console.log('✅ LINK SUCCESS');
        } catch (e) {
            console.error('❌ LINK FAILED:', e.response ? e.response.data : e.message);
        }
    }

    console.log('\n--- DIAGNOSTIC COMPLETE ---');
}

testScenario();
