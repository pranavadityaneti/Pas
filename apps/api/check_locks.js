const { Client } = require('pg');
async function main() {
  const connectionString = "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        pid, state, wait_event_type, wait_event, query, backend_type, 
        age(now(), query_start) as duration
      FROM pg_stat_activity 
      WHERE state != 'idle' AND pid != pg_backend_pid();
    `);
    console.log("ACTIVE QUERIES:", JSON.stringify(result.rows, null, 2));

    const locks = await client.query(`
      SELECT relation::regclass, mode, granted, pid 
      FROM pg_locks 
      WHERE relation::regclass::text IN ('profiles', 'merchant_branches', 'addresses', '"Store"');
    `);
    console.log("LOCKS:", JSON.stringify(locks.rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
  }
}
main();
