const { Client } = require('pg');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function checkMerchants() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Searching for netipranavaditya@gmail.com in merchants table...');

        const res = await client.query('SELECT id, email, status, store_name FROM merchants WHERE email = $1', ['netipranavaditya@gmail.com']);
        console.log(`Found ${res.rows.length} records.`);
        res.rows.forEach(r => console.log(r));

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await client.end();
    }
}

checkMerchants();
