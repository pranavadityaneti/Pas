const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string from run_migration.js
const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function runSQL(client, filePath) {
    try {
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`Executing ${filePath}...`);
        await client.query(sql);
        console.log(`✅ ${filePath} executed successfully.`);
    } catch (err) {
        console.error(`❌ Error executing ${filePath}:`, err.message);
    }
}

async function runFixes() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // 1. Notification Table (Retry)
        await runSQL(client, 'migrations/create_notification_table.sql');

        // 2. RLS Fixes
        await runSQL(client, 'fix_product_rls.sql');
        await runSQL(client, 'fix_store_staff_rls.sql');

        // 3. Activate Stores & Inspect
        await runSQL(client, 'activate_stores.sql');

        // 4. Inspect Store Triggers & Policies
        await runSQL(client, 'inspect_store_db.sql');

        console.log('All DB operations completed.');
    } catch (err) {
        console.error('Connection Error:', err);
    } finally {
        await client.end();
    }
}

runFixes();
