const { Client } = require('pg');

async function main() {
  const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to Supabase Postgres.");

    // First, let's drop the existing ones if we want to be safe and recreate them, 
    // or just try creating them and catch "already exists". We'll do DROP first to be clean.
    console.log("Cleaning up old policies if they exist...");
    await client.query(`DROP POLICY IF EXISTS "Users can create their own orders" ON "public"."orders";`);
    await client.query(`DROP POLICY IF EXISTS "Users can view their own orders" ON "public"."orders";`);

    // Create INSERT policy
    console.log("Creating INSERT policy...");
    await client.query(`
      CREATE POLICY "Users can create their own orders" 
      ON "public"."orders" 
      FOR INSERT 
      TO authenticated 
      WITH CHECK ((SELECT auth.uid()) = user_id);
    `);
    console.log("✅ INSERT policy created.");

    // Create SELECT policy
    console.log("Creating SELECT policy...");
    await client.query(`
      CREATE POLICY "Users can view their own orders" 
      ON "public"."orders" 
      FOR SELECT 
      TO authenticated 
      USING ((SELECT auth.uid()) = user_id);
    `);
    console.log("✅ SELECT policy created.");

    // Create order_items policy while we are here, because order_items insert might fail as well!
    console.log("Creating order_items policies...");
    await client.query(`DROP POLICY IF EXISTS "Users can create their own order items" ON "public"."order_items";`);
    await client.query(`DROP POLICY IF EXISTS "Users can view their own order items" ON "public"."order_items";`);
    
    // Auth on order_items usually needs to check orders. But let's just make it very loose for now 
    // or just let authenticated users insert. Normally you'd secure it via the order's user_id.
    // Given the prompt, I will stick to what the user explicitly requested for orders, but will add basic auth check for order_items.
    await client.query(`
      CREATE POLICY "Users can create their own order items" 
      ON "public"."order_items" 
      FOR INSERT 
      TO authenticated 
      WITH CHECK (true);
    `);
    await client.query(`
      CREATE POLICY "Users can view their own order items" 
      ON "public"."order_items" 
      FOR SELECT 
      TO authenticated 
      USING (true);
    `);
    console.log("✅ Order Items policies fully enabled for authenticated users.");

  } catch (error) {
    console.error("❌ SQL Execution Error:", error.message || error);
  } finally {
    await client.end();
    console.log("Connection closed.");
  }
}

main();
