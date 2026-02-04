const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function verify() {
    try {
        await client.connect();
        console.log('Connected to database');

        const testMerchantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Valid example UUID

        console.log(`Simulating insert for merchant: ${testMerchantId}`);

        // 1. Insert into merchants
        await client.query(`
            INSERT INTO merchants (id, owner_name, email, phone, store_name, city, address, kyc_status, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [testMerchantId, 'Test Owner', `test-${testMerchantId}@example.com`, '1234567890', 'Test Store', 'Mumbai', 'Test Address', 'pending', 'active']);

        console.log('Insert successful! (No FK violation)');

        // 2. Check User table
        const userRes = await client.query('SELECT * FROM "User" WHERE id = $1', [testMerchantId]);
        if (userRes.rows.length > 0) {
            console.log('✅ User record exists');
        } else {
            console.error('❌ User record MISSING');
        }

        // 3. Check Store table
        const storeRes = await client.query('SELECT * FROM "Store" WHERE id = $1', [testMerchantId]);
        if (storeRes.rows.length > 0) {
            console.log('✅ Store record exists');
        } else {
            console.error('❌ Store record MISSING');
        }

        // Cleanup
        await client.query('DELETE FROM "Store" WHERE id = $1', [testMerchantId]);
        await client.query('DELETE FROM "User" WHERE id = $1', [testMerchantId]);
        await client.query('DELETE FROM merchants WHERE id = $1', [testMerchantId]);
        console.log('Cleanup successful');

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await client.end();
    }
}

verify();
