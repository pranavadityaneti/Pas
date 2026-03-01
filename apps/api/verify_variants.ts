
import { Client } from 'pg';

const connectionString = 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function verifyVariants() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();

        // 1. Get a valid store and product
        const res = await client.query(`
            SELECT s.id as store_id, p.id as product_id 
            FROM "Store" s, "Product" p 
            LIMIT 1;
        `);

        if (res.rows.length === 0) {
            console.log('No store or product found to test.');
            return;
        }

        const { store_id, product_id } = res.rows[0];
        console.log(`Testing with Store: ${store_id}, Product: ${product_id}`);

        // 2. Clean up any existing entries for this product to start fresh (optional, or just use new variants)
        // We'll just try to insert new distinctive variants
        const v1 = 'TestVariant_A';
        const v2 = 'TestVariant_B';

        // 3. Insert Variant A
        console.log(`Inserting variant: ${v1}`);
        await client.query(`
            INSERT INTO "StoreProduct" ("id", "storeId", "productId", "variant", "price", "stock", "active", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, 10, 100, true, now())
            ON CONFLICT ("storeId", "productId", "variant") DO UPDATE SET price = 10;
        `, [store_id, product_id, v1]);

        // 4. Insert Variant B
        console.log(`Inserting variant: ${v2}`);
        await client.query(`
            INSERT INTO "StoreProduct" ("id", "storeId", "productId", "variant", "price", "stock", "active", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, 20, 200, true, now())
            ON CONFLICT ("storeId", "productId", "variant") DO UPDATE SET price = 20;
        `, [store_id, product_id, v2]);

        // 5. Verify count
        const countRes = await client.query(`
            SELECT variant, price FROM "StoreProduct" 
            WHERE "storeId" = $1 AND "productId" = $2 AND variant IN ($3, $4);
        `, [store_id, product_id, v1, v2]);

        console.table(countRes.rows);

        if (countRes.rows.length === 2) {
            console.log('SUCCESS: Both variants saved successfully.');
        } else {
            console.error('FAILURE: Expected 2 variants, found ' + countRes.rows.length);
        }

        // 6. Cleanup
        await client.query(`
             DELETE FROM "StoreProduct" 
             WHERE "storeId" = $1 AND "productId" = $2 AND variant IN ($3, $4);
        `, [store_id, product_id, v1, v2]);
        console.log('Cleaned up test data.');

    } catch (err: any) {
        console.error('Error executing query', err);
    } finally {
        await client.end();
    }
}

verifyVariants();
