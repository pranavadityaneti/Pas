const { Client } = require('pg');
const fs = require('fs');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function runMigration() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const sql = fs.readFileSync('add_gst_photos.sql', 'utf8');
        console.log('Running migration...');
        await client.query(sql);
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration Error:', err);
    } finally {
        await client.end();
    }
}

runMigration();
