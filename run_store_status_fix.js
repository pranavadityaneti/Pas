const { Client } = require('pg');
const fs = require('fs');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const sql = fs.readFileSync('fix_store_rls.sql', 'utf8');
        console.log('Executing fix_store_rls.sql...');
        await client.query(sql);
        console.log('✅ Store RLS policies updated successfully.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
