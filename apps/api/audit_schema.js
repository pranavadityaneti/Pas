const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" });
  await client.connect();

  // 1. List all tables
  const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`);
  console.log("TABLES:", tables.rows.map(r => r.table_name).join(', '));

  // 2. Check if inventory/products tables exist
  const inv = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('products', 'inventory', 'store_products', 'branch_products', 'menu_items') ORDER BY table_name, ordinal_position;`);
  console.log("\nPRODUCT TABLES COLUMNS:", JSON.stringify(inv.rows, null, 2));

  // 3. Check merchant_branches columns
  const mb = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'merchant_branches' ORDER BY ordinal_position;`);
  console.log("\nMERCHANT_BRANCHES COLUMNS:", JSON.stringify(mb.rows, null, 2));

  // 4. Check merchants table
  const merchants = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'merchants' ORDER BY ordinal_position;`);
  console.log("\nMERCHANTS COLUMNS:", JSON.stringify(merchants.rows, null, 2));

  // 5. Check Vertical table
  const vert = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Vertical' ORDER BY ordinal_position;`);
  console.log("\nVERTICAL COLUMNS:", JSON.stringify(vert.rows, null, 2));

  // 6. Check existing get_nearby_stores function
  const fn = await client.query(`SELECT routine_name, data_type FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%nearby%' OR routine_name LIKE '%search%';`);
  console.log("\nEXISTING FUNCTIONS:", JSON.stringify(fn.rows, null, 2));

  // 7. Check if PostGIS extension is installed
  const ext = await client.query(`SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';`);
  console.log("\nPOSTGIS:", JSON.stringify(ext.rows, null, 2));

  await client.end();
}
main();
