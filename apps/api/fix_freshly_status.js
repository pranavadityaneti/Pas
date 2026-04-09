const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://llhxkonraqaxtradyycj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1NzkwNSwiZXhwIjoyMDg0NzMzOTA1fQ.8K1BYqcbOM6oAFBn1m0zlj3vKsNeWvSncfSBlJ6kdsI',
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fix() {
    // Fix merchant record
    const { data: m, error: e1 } = await supabase
        .from('merchants')
        .update({ status: 'inactive', kyc_status: 'pending' })
        .ilike('store_name', '%Freshly%')
        .select('id, store_name, status, kyc_status');

    if (e1) { console.error('Merchant fix error:', e1); return; }
    console.log('✅ Merchant reset:', JSON.stringify(m, null, 2));

    // Fix store record
    if (m && m.length > 0) {
        const { data: s, error: e2 } = await supabase
            .from('Store')
            .update({ active: false })
            .eq('id', m[0].id)
            .select('id, name, active');

        if (e2) { console.error('Store fix error:', e2); return; }
        console.log('✅ Store reset:', JSON.stringify(s, null, 2));
    }
}
fix();
