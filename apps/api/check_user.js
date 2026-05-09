const { Client } = require('pg');
async function main() {
  const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });
  try {
    await client.connect();
    // Check RLS policies on consumer_addresses
    const policies = await client.query(`SELECT policyname, tablename, roles, cmd, qual FROM pg_policies WHERE tablename = 'consumer_addresses';`);
    console.log("RLS POLICIES:", JSON.stringify(policies.rows, null, 2));
    
    // Check table columns
    const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'consumer_addresses' ORDER BY ordinal_position;`);
    console.log("COLUMNS:", JSON.stringify(cols.rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
  }
}
main();
