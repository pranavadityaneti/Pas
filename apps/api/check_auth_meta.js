const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" });
  await client.connect();

  // Check auth metadata for these users
  const result = await client.query(`
    SELECT id, email, 
           raw_user_meta_data,
           encrypted_password IS NOT NULL AS has_password,
           LENGTH(encrypted_password) AS pwd_hash_length,
           email_confirmed_at,
           confirmation_sent_at,
           confirmed_at,
           is_sso_user,
           banned_until
    FROM auth.users 
    WHERE email IN ('pooja@pickatstore.in', 'krishna@pickatstore.in');
  `);

  result.rows.forEach(u => {
    console.log(`\n=== ${u.email} ===`);
    console.log(`  auth_id: ${u.id}`);
    console.log(`  has_password: ${u.has_password}`);
    console.log(`  pwd_hash_length: ${u.pwd_hash_length}`);
    console.log(`  email_confirmed: ${u.email_confirmed_at}`);
    console.log(`  confirmed_at: ${u.confirmed_at}`);
    console.log(`  is_sso: ${u.is_sso_user}`);
    console.log(`  banned_until: ${u.banned_until}`);
    console.log(`  metadata: ${JSON.stringify(u.raw_user_meta_data)}`);
  });

  await client.end();
}
main();
