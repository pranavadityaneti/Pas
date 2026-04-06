const { Client } = require('pg');

async function main() {
  const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });

  try {
    await client.connect();
    // The Reviewer Bypass logs the user in with UID = 200ea527-0fb9-4db0-8165-ca1286ea91b0
    // We just need to ensure Kirana Store (id = 200ea527-0fb9-4db0-8165-ca1286ea91b0) 
    // has its merchant_id set to that exact UUID!
    const res = await client.query(`
      UPDATE public."Store" 
      SET merchant_id = '200ea527-0fb9-4db0-8165-ca1286ea91b0' 
      WHERE id = '200ea527-0fb9-4db0-8165-ca1286ea91b0'
      RETURNING name, merchant_id;
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
main();
