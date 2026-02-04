const { Client } = require('pg');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function inspectBranches() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('--- INSPECTING merchant_branches TABLE ---');
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'merchant_branches'
            ORDER BY ordinal_position;
        `);
        console.table(res.rows);

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await client.end();
    }
}

inspectBranches();
