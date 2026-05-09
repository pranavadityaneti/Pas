const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" });
  await client.connect();

  const t1 = await client.query(`SELECT search_nearby_inventory('milk', 16.816, 81.812, 10000, NULL) as result;`);
  console.log("TEST 'milk' (10km):", JSON.stringify(t1.rows[0].result, null, 2));

  const t2 = await client.query(`SELECT search_nearby_inventory('Freshly', 16.816, 81.812, 10000, NULL) as result;`);
  console.log("\nTEST 'Freshly' (10km):", JSON.stringify(t2.rows[0].result, null, 2));

  const t3 = await client.query(`SELECT search_nearby_inventory('carrot', 16.816, 81.812, 10000, NULL) as result;`);
  console.log("\nTEST 'carrot' (10km):", JSON.stringify(t3.rows[0].result, null, 2));

  const t4 = await client.query(`SELECT search_nearby_inventory('Freshly', 17.434, 78.432, 10000, NULL) as result;`);
  console.log("\nTEST 'Freshly' (Hyderabad, 10km):", JSON.stringify(t4.rows[0].result, null, 2));

  await client.end();
}
main();
