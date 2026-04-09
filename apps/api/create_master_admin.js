/**
 * Creates a Super Admin user: pranav@ideaye.com
 * Usage: node create_master_admin.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://llhxkonraqaxtradyycj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1NzkwNSwiZXhwIjoyMDg0NzMzOTA1fQ.8K1BYqcbOM6oAFBn1m0zlj3vKsNeWvSncfSBlJ6kdsI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_EMAIL = 'pranav@ideaye.com';
const ADMIN_PASSWORD = 'SuperAdmin@2026'; 
const ADMIN_NAME = 'Pranav Master';

async function main() {
    console.log(`\n🔐 Provisioning New Super Admin: ${ADMIN_EMAIL}\n`);

    // 1. Create/Update Auth User
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    let existingUser = authUsers?.users?.find(u => u.email === ADMIN_EMAIL);

    let userId;
    if (existingUser) {
        console.log(`✅ Auth user exists: ${existingUser.id}`);
        userId = existingUser.id;
        await supabase.auth.admin.updateUserById(userId, { password: ADMIN_PASSWORD, email_confirm: true });
        console.log('✅ Password reset.');
    } else {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true
        });
        if (createError) throw createError;
        userId = newUser.user.id;
        console.log(`✅ Auth user created: ${userId}`);
    }

    // 2. Upsert User profile with SUPER_ADMIN role
    const now = new Date().toISOString();
    const { error: profileError } = await supabase
        .from('User')
        .upsert({
            id: userId,
            email: ADMIN_EMAIL,
            name: ADMIN_NAME,
            role: 'SUPER_ADMIN',
            passwordHash: 'managed-by-supabase-auth',
            createdAt: now,
            updatedAt: now
        });

    if (profileError) throw profileError;

    console.log('✅ User profile set to SUPER_ADMIN');
    console.log('\n🎉 New Admin Credentials:');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Dashboard: https://admin.pickatstore.io\n`);
}

main().catch(console.error);
