const { Client } = require('pg');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function syncId() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const correctId = '8c36d2ad-52da-42f5-90e8-fcd05a8808b9';
        const oldId = '90742c6d-6c5a-4aaf-bcce-6d91e9bc052e';
        const email = 'netipranavaditya@gmail.com';

        console.log(`Syncing merchant record for ${email}...`);
        console.log(`Correct ID: ${correctId}`);
        console.log(`Current ID in merchants: ${oldId}`);

        // Update the ID
        const res = await client.query('UPDATE merchants SET id = $1 WHERE id = $2 AND email = $3', [correctId, oldId, email]);

        if (res.rowCount > 0) {
            console.log('Update successful! Merchant record is now synced with Auth ID.');
        } else {
            console.log('Update failed. Record not found or ID already synced.');
        }

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await client.end();
    }
}

syncId();
