const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });
const { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY } = process.env;

// Load API env for service role key
require('dotenv').config({ path: '../api/.env' });
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runAudit() {
  console.log('--- 🛡️ Supabase Database Audit: Store Table ---');
  
  const anonClient = createClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const adminClient = createClient(EXPO_PUBLIC_SUPABASE_URL, SERVICE_KEY);

  console.log('\n[TEST 1] Querying with ANON KEY (App Behavior)...');
  const { data: anonData, error: anonError, count: anonCount } = await anonClient
    .from('Store')
    .select('*', { count: 'exact' });

  if (anonError) {
    console.error('❌ ANON ERROR:', anonError.message);
  } else {
    console.log(`✅ ANON SUCCESS: Found ${anonCount} total accessible stores.`);
    console.log(`   Detailed Count (Active=true): ${anonData.filter(s => s.active).length}`);
    console.log(`   Detailed Count (Active=false): ${anonData.filter(s => !s.active).length}`);
  }

  console.log('\n[TEST 2] Querying with SERVICE ROLE KEY (Bypass RLS)...');
  const { data: adminData, error: adminError, count: adminCount } = await adminClient
    .from('Store')
    .select('*', { count: 'exact' });

  if (adminError) {
    console.error('❌ ADMIN ERROR:', adminError.message);
  } else {
    console.log(`✅ ADMIN SUCCESS: Found ${adminCount} total records in table.`);
    
    const statusCounts = adminData.reduce((acc, s) => {
      acc[String(s.active)] = (acc[String(s.active)] || 0) + 1;
      return acc;
    }, {});
    
    console.log('   Stats by "active" column:', JSON.stringify(statusCounts, null, 2));
    
    if (adminCount > 0 && anonCount === 0) {
      console.log('\n🚨 DIAGNOSIS: RLS is active and blocking READ access for the ANON key.');
    } else if (adminCount === 0) {
      console.log('\n🚨 DIAGNOSIS: The Store table is physically EMPTY.');
    } else if (anonCount > 0 && adminData.filter(s => s.active).length === 0) {
      console.log('\n🚨 DIAGNOSIS: Data exists, but all stores are marked active = false.');
    } else {
      console.log('\n✅ DIAGNOSIS: Database visibility appears correct.');
    }
  }
}

runAudit();
