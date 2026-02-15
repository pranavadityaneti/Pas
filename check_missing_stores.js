const { Client } = require('pg');
const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('--- Merchants without Stores ---');
        // Find merchants whose ID is NOT present in Store table as managerId (or id, since they map 1:1)
        const res = await client.query(`
            SELECT m.id, m.store_name, m.email 
            FROM merchants m
            LEFT JOIN "Store" s ON m.id::text = s."managerId"
            WHERE s.id IS NULL;
        `);

        if (res.rows.length === 0) {
            console.log('✅ All merchants have stores.');
        } else {
            console.log(`❌ Found ${res.rows.length} merchants without stores:`);
            console.table(res.rows);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
