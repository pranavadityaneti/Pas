
import { Client } from 'pg';

const connectionString = 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function checkStoreProduct() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();

        console.log('--- Columns in StoreProduct ---');
        const cols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'StoreProduct';
        `);
        console.table(cols.rows);

        console.log('--- Constraints on StoreProduct ---');
        const constraints = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c 
            JOIN pg_class t ON c.conrelid = t.oid 
            WHERE t.relname = 'StoreProduct';
        `);
        console.table(constraints.rows);

    } catch (err: any) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkStoreProduct();
