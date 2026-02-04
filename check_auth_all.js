const { Client } = require('pg');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function checkAuth() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const email = 'netipranavaditya@gmail.com';
        console.log(`Checking all auth.users for email: ${email}`);

        const res = await client.query('SELECT id, email, created_at, last_sign_in_at FROM auth.users WHERE email = $1', [email]);
        console.log(`Found ${res.rows.length} records in auth.users.`);
        res.rows.forEach(r => console.log(r));

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await client.end();
    }
}

checkAuth();
