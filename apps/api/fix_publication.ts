
import { Client } from 'pg';

const connectionString = 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function fixPublication() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();

        console.log('--- Adding Store to supabase_realtime publication ---');
        try {
            await client.query(`alter publication supabase_realtime add table "Store";`);
            console.log('Success: Added Store to publication.');
        } catch (e: any) {
            console.log('Note: ' + e.message);
        }

        console.log('--- Verifying Publication ---');
        const pubRes = await client.query(`
            SELECT * FROM pg_publication_tables WHERE tablename = 'Store';
        `);
        console.table(pubRes.rows);

    } catch (err: any) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

fixPublication();
