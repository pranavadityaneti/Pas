const { Client } = require('pg');

async function main() {
  const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to Supabase Postgres.");

    // Clean up if they exist
    await client.query(`DROP POLICY IF EXISTS "Merchants can view their store orders" ON "public"."orders";`);
    await client.query(`DROP POLICY IF EXISTS "Merchants can update their store orders" ON "public"."orders";`);

    console.log("Creating Merchant SELECT policy...");
    await client.query(`
      CREATE POLICY "Merchants can view their store orders" 
      ON "public"."orders" 
      FOR SELECT 
      TO authenticated 
      USING (
        store_id IN (
          SELECT id FROM "public"."Store" WHERE merchant_id = auth.uid()::text
        )
      );
    `);
    console.log("✅ SELECT policy created.");

    console.log("Creating Merchant UPDATE policy...");
    await client.query(`
      CREATE POLICY "Merchants can update their store orders" 
      ON "public"."orders" 
      FOR UPDATE 
      TO authenticated 
      USING (
        store_id IN (
          SELECT id FROM "public"."Store" WHERE merchant_id = auth.uid()::text
        )
      );
    `);
    console.log("✅ UPDATE policy created.");

  } catch (error) {
    console.error("❌ SQL Execution Error:", error.message || error);
  } finally {
    await client.end();
    console.log("Connection closed.");
  }
}

main();
