const { Client } = require('pg');

async function audit() {
  const client = new Client({
    connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
  });

  await client.connect();

  console.log("--- CONSTRAINTS ---");
  const pk = await client.query(`
    select conname, pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'profiles';
  `);
  console.log(pk.rows);

  console.log("--- INDEXES ---");
  const indexes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'profiles' AND schemaname = 'public';
  `);
  console.log(indexes.rows);

  console.log("--- RLS POLICIES ---");
  const policies = await client.query(`
    SELECT polname, polcmd, polroles, polpermissive, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as with_check
    FROM pg_policy
    WHERE polrelid = 'public.profiles'::regclass;
  `);
  console.log(policies.rows);

  await client.end();
}

audit().catch(console.error);
