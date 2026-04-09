/**
 * Creates a Super Admin user for the admin dashboard.
 * Usage: node create_super_admin.js
 * 
 * This script:
 * 1. Creates a Supabase Auth user (or resets password if exists)
 * 2. Upserts the User record in the public.User table with SUPER_ADMIN role
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://llhxkonraqaxtradyycj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1NzkwNSwiZXhwIjoyMDg0NzMzOTA1fQ.8K1BYqcbOM6oAFBn1m0zlj3vKsNeWvSncfSBlJ6kdsI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_EMAIL = 'pranav.n@ideaye.in';
const ADMIN_PASSWORD = 'SuperAdmin@2026';  // <-- Change this to your desired password
const ADMIN_NAME = 'Pranav Aditya';

async function main() {
    console.log(`\n🔐 Creating Super Admin: ${ADMIN_EMAIL}\n`);

    // Step 1: Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL);

    let userId;

    if (existingUser) {
        console.log(`✅ Auth user already exists: ${existingUser.id}`);
        userId = existingUser.id;

        // Reset password
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
            password: ADMIN_PASSWORD,
            email_confirm: true
        });
        if (updateError) {
            console.error('❌ Failed to update password:', updateError.message);
            return;
        }
        console.log('✅ Password reset successfully');
    } else {
        // Create new auth user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true
        });

        if (createError) {
            console.error('❌ Failed to create auth user:', createError.message);
            return;
        }
        userId = newUser.user.id;
        console.log(`✅ Auth user created: ${userId}`);
    }

    // Step 2: Upsert User record in public.User table with SUPER_ADMIN role
    const now = new Date().toISOString();
    const { data: profile, error: profileError } = await supabase
        .from('User')
        .upsert({
            id: userId,
            email: ADMIN_EMAIL,
            name: ADMIN_NAME,
            role: 'SUPER_ADMIN',
            passwordHash: 'managed-by-supabase-auth',
            createdAt: now,
            updatedAt: now
        }, { onConflict: 'id' })
        .select()
        .single();

    if (profileError) {
        console.error('❌ Failed to upsert User profile:', profileError.message);
        return;
    }

    console.log('✅ User profile upserted with SUPER_ADMIN role');
    console.log('\n📋 Summary:');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Role:     SUPER_ADMIN`);
    console.log(`   User ID:  ${userId}`);
    console.log('\n🎉 You can now login to the admin dashboard!\n');
}

main().catch(console.error);
