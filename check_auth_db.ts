import pkg from 'pg';
const { Client } = pkg;

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function checkAuth() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const targetId = '8c36d2ad-52da-42f5-90e8-fcd05a8808b9';
        console.log(`Checking auth.users for ID: ${targetId}`);

        const res = await client.query('SELECT id, email FROM auth.users WHERE id = $1', [targetId]);
        if (res.rows.length > 0) {
            console.log('Found in auth.users:', res.rows[0]);
        } else {
            console.log('Not found in auth.users.');
        }

        console.log('\nChecking all users with email netipranavaditya@gmail.com:');
        const res2 = await client.query('SELECT id, email, created_at FROM auth.users WHERE email = $1', ['netipranavaditya@gmail.com']);
        res2.rows.forEach(r => console.log(` - ID: ${r.id}, Created: ${r.created_at}`));

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await client.end();
    }
}

checkAuth();
