const { Client } = require('pg');
const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('--- Triggers on Store ---');
        const triggers = await client.query(`
            SELECT trigger_name, action_statement, action_timing
            FROM information_schema.triggers
            WHERE event_object_table = 'Store';
        `);
        console.table(triggers.rows);

        console.log('\n--- RLS Policies on Store ---');
        const policies = await client.query(`
            SELECT policyname, permissive, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'Store';
        `);
        console.table(policies.rows);

        console.log('\n--- Sample Store Data (First 5) ---');
        const stores = await client.query(`
            SELECT id, name, active, "managerId" FROM "Store" LIMIT 5;
        `);
        console.table(stores.rows);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
