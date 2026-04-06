const { Client } = require('pg');

async function main() {
  const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected directly to Supabase Postgres.");

    // Query the latest 5 orders with their associated Store metadata
    const query = `
      SELECT 
        o.id as order_id, 
        o.status, 
        o.created_at, 
        o.store_id, 
        s.name as store_name, 
        s.merchant_id 
      FROM public.orders o
      LEFT JOIN public."Store" s ON o.store_id = s.id
      ORDER BY o.created_at DESC
      LIMIT 5;
    `;
    
    const { rows } = await client.query(query);

    console.log("=== LATEST 5 ORDERS AUDIT ===");
    console.table(rows);

  } catch (error) {
    console.error("Query Error:", error);
  } finally {
    await client.end();
  }
}

main();
