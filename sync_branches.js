const { Client } = require('pg');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function syncBranches() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const correctId = '8c36d2ad-52da-42f5-90e8-fcd05a8808b9';
        const oldId = '90742c6d-6c5a-4aaf-bcce-6d91e9bc052e';

        console.log('Checking for branches linked to old merchant ID...');
        const res = await client.query('SELECT count(*) FROM merchant_branches WHERE merchant_id = $1', [oldId]);
        const count = parseInt(res.rows[0].count);

        if (count > 0) {
            console.log(`Found ${count} branches. Updating to correct merchant ID...`);
            await client.query('UPDATE merchant_branches SET merchant_id = $1 WHERE merchant_id = $2', [correctId, oldId]);
            console.log('Branches updated successfully.');
        } else {
            console.log('No branches found for old ID.');
        }

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await client.end();
    }
}

syncBranches();
