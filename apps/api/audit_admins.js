const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" });
  await client.connect();

  // 1. Check User table for these emails
  console.log("=== User TABLE (public schema) ===");
  const users = await client.query(`SELECT id, email, name, role, "createdAt" FROM "User" WHERE email IN ('pooja@pickatstore.in', 'krishna@pickatstore.in');`);
  if (users.rows.length === 0) {
    console.log("  ❌ NO RECORDS found for pooja@ or krishna@ in User table");
  } else {
    users.rows.forEach(u => console.log(`  ✅ ${u.email} | role: ${u.role} | id: ${u.id} | created: ${u.createdAt}`));
  }

  // 2. Check ALL admins in User table
  console.log("\n=== ALL USERS IN User TABLE ===");
  const allUsers = await client.query(`SELECT id, email, name, role FROM "User" ORDER BY email;`);
  allUsers.rows.forEach(u => console.log(`  ${u.email} | role: ${u.role} | id: ${u.id}`));

  // 3. Check auth.users for these emails (may not work through pooler but let's try)
  console.log("\n=== auth.users CHECK ===");
  try {
    const authUsers = await client.query(`SELECT id, email, created_at, email_confirmed_at FROM auth.users WHERE email IN ('pooja@pickatstore.in', 'krishna@pickatstore.in');`);
    if (authUsers.rows.length === 0) {
      console.log("  ❌ NO auth.users records found — accounts were never created in Supabase Auth");
    } else {
      authUsers.rows.forEach(u => {
        console.log(`  ${u.email} | auth_id: ${u.id} | created: ${u.created_at} | email_confirmed: ${u.email_confirmed_at || 'NOT CONFIRMED'}`);
      });
    }
  } catch (e) {
    console.log("  ⚠️ Cannot query auth.users via pooler:", e.message);
  }

  await client.end();
}
main();
