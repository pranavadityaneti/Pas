const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://llhxkonraqaxtradyycj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1NzkwNSwiZXhwIjoyMDg0NzMzOTA1fQ.8K1BYqcbOM6oAFBn1m0zlj3vKsNeWvSncfSBlJ6kdsI',
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function audit() {
    const { data, error } = await supabase
        .from('merchants')
        .select('id, store_name, status, kyc_status, created_at, updated_at')
        .ilike('store_name', '%Freshly%');

    if (error) { console.error(error); return; }
    console.log('=== Freshly Foods Merchant Record ===');
    console.log(JSON.stringify(data, null, 2));

    if (data && data.length > 0) {
        const { data: storeData } = await supabase
            .from('Store')
            .select('id, name, active, "createdAt", "updatedAt"')
            .eq('id', data[0].id);
        console.log('\n=== Associated Store Record ===');
        console.log(JSON.stringify(storeData, null, 2));
    }
}
audit();
