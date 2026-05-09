const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" });
  await client.connect();

  const sp = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'StoreProduct' ORDER BY ordinal_position;`);
  console.log("StoreProduct:", JSON.stringify(sp.rows, null, 2));

  const p = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Product' ORDER BY ordinal_position;`);
  console.log("\nProduct:", JSON.stringify(p.rows, null, 2));

  const s = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Store' ORDER BY ordinal_position;`);
  console.log("\nStore:", JSON.stringify(s.rows, null, 2));

  // Check existing get_nearby_stores function definition
  const fn = await client.query(`SELECT prosrc FROM pg_proc WHERE proname = 'get_nearby_stores';`);
  console.log("\nget_nearby_stores SOURCE:", fn.rows[0]?.prosrc || 'NOT FOUND');

  // Check how many products exist
  const count = await client.query(`SELECT COUNT(*) as cnt FROM "StoreProduct";`);
  console.log("\nStoreProduct count:", count.rows[0].cnt);

  const pcount = await client.query(`SELECT COUNT(*) as cnt FROM "Product";`);
  console.log("Product count:", pcount.rows[0].cnt);

  // Sample a product
  const sample = await client.query(`SELECT sp.id, sp."storeId", sp."productId", p.name, p.description FROM "StoreProduct" sp JOIN "Product" p ON sp."productId" = p.id LIMIT 3;`);
  console.log("\nSample StoreProducts:", JSON.stringify(sample.rows, null, 2));

  await client.end();
}
main();
