const { Client } = require('pg');
const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const email = 'netipranavaditya@gmail.com';

        console.log(`--- Checking for ${email} ---`);

        const mRes = await client.query('SELECT id, store_name, email FROM merchants WHERE email = $1', [email]);
        if (mRes.rows.length === 0) {
            console.log('No merchant found with this email.');
        } else {
            console.log('Merchant Row:', mRes.rows[0]);
            const mId = mRes.rows[0].id;

            const sRes = await client.query('SELECT id, name, active, "managerId" FROM "Store" WHERE "managerId" = $1', [mId]);
            if (sRes.rows.length === 0) {
                console.log('No Store found for this merchant ID.');

                // Try finding by name?
                const sRes2 = await client.query('SELECT id, name, active, "managerId" FROM "Store" WHERE name = $1', [mRes.rows[0].store_name]);
                if (sRes2.rows.length > 0) {
                    console.log('Found store by NAME but ID mismatch:', sRes2.rows[0]);
                }
            } else {
                console.log('Store Row found via ID:', sRes.rows[0]);
            }
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
