const { Client } = require('pg');

const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function cleanupAndSync() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const email = 'pranav.n@ideaye.in';
        const correctId = '902fcb8a-e397-4197-b58e-a8be786ff690';
        const merchantIdToKeep = '2ee29040-7246-44cf-b43f-c999aa39a6ef';
        const merchantIdToDelete = '67497a8c-6bf0-48ae-b69b-dd3d0a4192a4';

        console.log(`Syncing and cleaning up for ${email}...`);

        // Update the one we want to keep
        await client.query('UPDATE merchants SET id = $1 WHERE id = $2', [correctId, merchantIdToKeep]);
        console.log(`Updated ${merchantIdToKeep} to ${correctId}`);

        // Delete the redundant one
        await client.query('DELETE FROM merchants WHERE id = $1', [merchantIdToDelete]);
        console.log(`Deleted redundant record ${merchantIdToDelete}`);

        console.log('Done!');

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await client.end();
    }
}

cleanupAndSync();
