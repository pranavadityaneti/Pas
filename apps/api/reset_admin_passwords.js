const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  'https://llhxkonraqaxtradyycj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1NzkwNSwiZXhwIjoyMDg0NzMzOTA1fQ.8K1BYqcbOM6oAFBn1m0zlj3vKsNeWvSncfSBlJ6kdsI',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function resetPasswords() {
  const { error: e1 } = await supabaseAdmin.auth.admin.updateUserById(
    '0e32dd59-e98f-46ca-9366-168b2c8b9e03',
    { password: 'P@pas1' }
  );
  console.log('Pooja:', e1 ? '❌ ' + e1.message : '✅ Password reset to P@pas1');

  const { error: e2 } = await supabaseAdmin.auth.admin.updateUserById(
    '5f553dea-e0db-40bf-92eb-9cee4146908e',
    { password: 'K@pas1' }
  );
  console.log('Krishna:', e2 ? '❌ ' + e2.message : '✅ Password reset to K@pas1');
}

resetPasswords();
