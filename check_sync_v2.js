const { Client } = require('pg');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function checkSync() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const email = 'pranav.n@ideaye.in';

        console.log(`Checking sync for ${email}...`);

        const authRes = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
        const merchantRes = await client.query('SELECT id FROM merchants WHERE email = $1', [email]);

        console.log('Auth IDs:', authRes.rows.map(r => r.id));
        console.log('Merchant IDs:', merchantRes.rows.map(r => r.id));

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await client.end();
    }
}

checkSync();
