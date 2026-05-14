const { Client } = require('pg');

// Use the direct database connection URL from api/.env
const connectionString = 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  console.log('--- FETCHING RLS POLICIES ON ORDERS ---');
  const res = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'orders' OR tablename = 'order_requests' OR tablename = 'store_staff';
  `);
  
  console.log(JSON.stringify(res.rows, null, 2));
  
  await client.end();
}

run().catch(console.error);
