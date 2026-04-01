const { Client } = require('pg');

async function fixRLS() {
  const client = new Client({
    connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" // From the earlier .env read
  });

  await client.connect();

  console.log("Dropping permissive policy...");
  await client.query(`DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;`);

  console.log("Creating strict indexed isolation policy...");
  await client.query(`
    CREATE POLICY "Users can view own profile" 
    ON public.profiles 
    FOR SELECT 
    USING (auth.uid() = id);
  `);

  console.log("Verifying new SELECT policies...");
  const policies = await client.query(`
    SELECT polname, pg_get_expr(polqual, polrelid) as qual
    FROM pg_policy
    WHERE polrelid = 'public.profiles'::regclass AND polcmd = 'r';
  `);
  console.log(policies.rows);

  await client.end();
}

fixRLS().catch(console.error);
