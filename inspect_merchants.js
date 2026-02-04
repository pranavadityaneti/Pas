const { Client } = require('pg');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function inspectMerchants() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('--- INSPECTING merchants TABLE ---');
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'merchants'
            ORDER BY ordinal_position;
        `);
        console.table(res.rows);

        console.log('\n--- INSPECTING store_photos TABLE (if it exists) ---');
        const res2 = await client.query("SELECT count(*) FROM information_schema.tables WHERE table_name = 'store_photos'");
        if (parseInt(res2.rows[0].count) > 0) {
            const res3 = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'store_photos'
                ORDER BY ordinal_position;
            `);
            console.table(res3.rows);
        } else {
            console.log('store_photos table does not exist.');
        }

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await client.end();
    }
}

inspectMerchants();
