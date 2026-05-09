const { Client } = require('pg');

async function main() {
  const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT policyname, tablename, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename IN ('profiles', 'merchant_branches', 'addresses');
    `);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
  }
}

main();
