
import { Client } from 'pg';

const connectionString = 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function dropIndex() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();

        console.log('--- Dropping Index ---');
        await client.query(`
            DROP INDEX IF EXISTS "StoreProduct_storeId_productId_key";
        `);
        console.log('Dropped index.');

    } catch (err: any) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

dropIndex();
