const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" 
  });
  await client.connect();

  const res = await client.query(`
    select polname, polcmd, pg_get_expr(polqual, polrelid) as qual
    from pg_policy
    where polrelid = 'public.Store'::regclass OR polrelid = 'public.stores'::regclass;
  `);

  console.log("RLS Policies on stores:", res.rows);
  
  const tables = await client.query(`SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('Store', 'stores');`);
  console.log("Table security active?", tables.rows);
  
  await client.end();
}

main().catch(console.error);
