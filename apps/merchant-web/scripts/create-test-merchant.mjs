// Script to create a test merchant account
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestMerchant() {
    const email = 'test@merchant.com';
    const password = 'Test123!';

    console.log('Creating test merchant account...');

    // Step 1: Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        console.error('Auth Error:', authError.message);
        // If user already exists, try to sign in instead
        if (authError.message.includes('already registered')) {
            console.log('User already exists. Trying to update merchant status...');

            // Sign in to get user ID
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                console.error('Sign in failed:', signInError.message);
                return;
            }

            // Update merchant status
            const { error: updateError } = await supabase
                .from('merchants')
                .update({ status: 'active' })
                .eq('id', signInData.user.id);

            if (updateError) {
                console.error('Update Error:', updateError.message);
            } else {
                console.log('✅ Merchant status updated to active!');
            }
            return;
        }
        return;
    }

    const userId = authData.user?.id;
    if (!userId) {
        console.error('No user ID returned');
        return;
    }

    console.log('User created with ID:', userId);

    // Step 2: Create merchant record with active status
    const { error: merchantError } = await supabase
        .from('merchants')
        .insert({
            id: userId,
            email: email,
            owner_name: 'Test Merchant',
            store_name: 'Test Store',
            phone: '9876543210',
            status: 'active', // Pre-approved!
            city: 'Test City',
            address: '123 Test Street',
        });

    if (merchantError) {
        console.error('Merchant Error:', merchantError.message);
        return;
    }

    console.log('✅ Test merchant created successfully!');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('🟢 Status: ACTIVE (pre-approved)');
}

createTestMerchant();
