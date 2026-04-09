const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://llhxkonraqaxtradyycj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1NzkwNSwiZXhwIjoyMDg0NzMzOTA1fQ.8K1BYqcbOM6oAFBn1m0zlj3vKsNeWvSncfSBlJ6kdsI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const EMAIL = 'pranav.n@ideaye.in';

async function debugAuth() {
    console.log(`\n🔍 Debugging Auth for: ${EMAIL}\n`);

    // 1. Check Supabase Auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('❌ Error listing auth users:', authError.message);
        return;
    }

    const authUser = authUsers.users.find(u => u.email === EMAIL);
    if (!authUser) {
        console.log('❌ No Supabase Auth user found for this email.');
    } else {
        console.log('✅ Supabase Auth User found:');
        console.log(`   ID:    ${authUser.id}`);
        console.log(`   Email: ${authUser.email}`);
    }

    // 2. Check public.User table
    const { data: userRecord, error: userError } = await supabase
        .from('User')
        .select('*')
        .eq('email', EMAIL);

    if (userError) {
        console.error('❌ Error fetching from public.User table:', userError.message);
    } else if (userRecord.length === 0) {
        console.log('\n❌ No record found in public.User table for this email.');
    } else {
        console.log('\n✅ public.User record(s) found:');
        userRecord.forEach(u => {
            console.log(`   ID:      ${u.id}`);
            console.log(`   Email:   ${u.email}`);
            console.log(`   Role:    ${u.role}`);
            console.log(`   Matches Auth ID? ${authUser && u.id === authUser.id ? 'YES' : 'NO'}`);
        });
    }

    // 3. Search by the Auth ID just in case
    if (authUser) {
        const { data: recordByAuthId } = await supabase
            .from('User')
            .select('*')
            .eq('id', authUser.id);
        
        if (recordByAuthId && recordByAuthId.length > 0) {
            console.log('\n✅ Found user record by Auth ID (might have different email?):');
            console.log(recordByAuthId[0]);
        } else {
            console.log('\n❌ No user record found with the exact Auth ID.');
        }
    }
}

debugAuth();
