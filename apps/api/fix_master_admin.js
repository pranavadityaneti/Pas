/**
 * Fix and Provision Master Admin: pranav@ideaye.com
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://llhxkonraqaxtradyycj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1NzkwNSwiZXhwIjoyMDg0NzMzOTA1fQ.8K1BYqcbOM6oAFBn1m0zlj3vKsNeWvSncfSBlJ6kdsI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const EMAIL = 'pranav@ideaye.com';
const AUTH_ID = 'ef81fa7b-cff8-4d08-ac6a-85fcbe29a2b7';

async function main() {
    console.log(`\n🛠️  Fixing Master Admin record for: ${EMAIL}\n`);

    // 1. Delete any existing User record with this email to avoid conflict
    const { error: delErr } = await supabase.from('User').delete().eq('email', EMAIL);
    if (delErr) console.warn('Note: Delete error (might not exist):', delErr.message);

    // 2. Insert fresh record with correct Auth ID and Role
    const now = new Date().toISOString();
    const { error: insErr } = await supabase.from('User').insert({
        id: AUTH_ID,
        email: EMAIL,
        name: 'Pranav Master',
        role: 'SUPER_ADMIN',
        passwordHash: 'managed-by-supabase-auth',
        createdAt: now,
        updatedAt: now
    });

    if (insErr) {
        console.error('❌ Failed to insert User record:', insErr.message);
        return;
    }

    console.log('✅ Super Admin record created successfully!');
    console.log('\n🎉 Login Credentials:');
    console.log(`   Email:    ${EMAIL}`);
    console.log(`   Password: SuperAdmin@2026`);
    console.log(`   Dashboard: https://admin.pickatstore.io\n`);
}

main().catch(console.error);
