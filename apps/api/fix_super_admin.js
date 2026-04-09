/**
 * Fix Super Admin: Updates the existing User record to link to the new auth user.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://llhxkonraqaxtradyycj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1NzkwNSwiZXhwIjoyMDg0NzMzOTA1fQ.8K1BYqcbOM6oAFBn1m0zlj3vKsNeWvSncfSBlJ6kdsI',
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
    const NEW_AUTH_ID = '4be235ca-c860-4318-a67f-566f0a5084af';
    const EMAIL = 'pranav.n@ideaye.in';

    // Find the existing User record
    const { data: existing, error: findErr } = await supabase
        .from('User')
        .select('id, email, role')
        .eq('email', EMAIL)
        .single();

    if (findErr) {
        console.error('❌ Could not find existing User record:', findErr.message);
        return;
    }

    console.log('📋 Existing User record:', existing);

    if (existing.id === NEW_AUTH_ID) {
        console.log('✅ IDs already match! Just ensuring role is SUPER_ADMIN...');
        await supabase.from('User').update({ role: 'SUPER_ADMIN' }).eq('id', NEW_AUTH_ID);
        console.log('✅ Done!');
        return;
    }

    // Delete the old record and insert new one with correct auth ID
    console.log(`🔄 Replacing old User ID ${existing.id} with auth ID ${NEW_AUTH_ID}...`);

    const { error: delErr } = await supabase.from('User').delete().eq('id', existing.id);
    if (delErr) {
        console.error('❌ Delete failed:', delErr.message);
        return;
    }

    const now = new Date().toISOString();
    const { error: insertErr } = await supabase.from('User').insert({
        id: NEW_AUTH_ID,
        email: EMAIL,
        name: 'Pranav Aditya',
        role: 'SUPER_ADMIN',
        passwordHash: 'managed-by-supabase-auth',
        createdAt: now,
        updatedAt: now
    });

    if (insertErr) {
        console.error('❌ Insert failed:', insertErr.message);
        return;
    }

    console.log('✅ Super Admin record created with correct auth ID');
    console.log('\n📋 Login Credentials:');
    console.log('   Email:    pranav.n@ideaye.in');
    console.log('   Password: SuperAdmin@2026');
    console.log('   Role:     SUPER_ADMIN');
}

main().catch(console.error);
