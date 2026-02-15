
import { Client } from 'pg';

const connectionString = 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function migrateStoreProduct() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();

        console.log('--- Adding variant column ---');
        // 1. Add column with default 'Standard' to backfill existing rows
        await client.query(`
            ALTER TABLE "StoreProduct" 
            ADD COLUMN IF NOT EXISTS "variant" TEXT NOT NULL DEFAULT 'Standard';
        `);
        console.log('Added variant column.');

        console.log('--- Dropping old constraint ---');
        // 2. Drop old unique constraint
        await client.query(`
            ALTER TABLE "StoreProduct" 
            DROP CONSTRAINT IF EXISTS "StoreProduct_storeId_productId_key";
        `);
        console.log('Dropped old constraint.');

        console.log('--- Adding new constraint ---');
        // 3. Add new unique constraint (storeId, productId, variant)
        await client.query(`
            ALTER TABLE "StoreProduct" 
            ADD CONSTRAINT "StoreProduct_storeId_productId_variant_key" 
            UNIQUE ("storeId", "productId", "variant");
        `);
        console.log('Added new constraint.');

    } catch (err: any) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

migrateStoreProduct();
