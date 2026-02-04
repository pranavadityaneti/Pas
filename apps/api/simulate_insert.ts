
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''; // Use Anon Key to simulate client
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- SIMULATING AUTHENTICATED INSERT ---');

    // 1. Sign in (or mock a session if we had a service role, but better to actually sign in)
    // Since we don't have a user credentials, we'll use a hardcoded token if available, 
    // OR we will create a dummy user via Admin API (simulated) then try to insert.
    // Actually, let's try to simple insert with a made-up JWT if possible, but that won't work without secret.
    // Plan B: Use Service Role to create a user, getting their session, then trying the insert.

    // For this simulation, we'll try to insert using the SERVICE ROLE first to see if it even works as "Super Admin",
    // then we try to debug "Authenticated" user.
    // But wait, the previous error was "new row violates row level security policy".
    // This implies the user WAS authenticated (or anon) but the policy failed.

    // Let's rely on the policy check we did. It looked correct.
    // Maybe there is a trigger that FAILS.
    // The trigger 'trg_sync_merchants_to_store' runs AFTER UPDATE.
    // Does it run on INSERT? `CREATE TRIGGER ... AFTER UPDATE ON merchants`.
    // It seems it ONLY runs on UPDATE.

    // So INSERT should be fine?
    // Unless there is ANOTHER trigger.

    // Let's try to insert a dummy merchant using standard client (simulate Anon/Client)
    // If it fails with RLS, then our policy is still wrong.

    const { data: { user }, error: authError } = await supabase.auth.signUp({
        email: `test_admin_${Date.now()}@example.com`,
        password: 'password123',
    });

    if (authError) {
        // If sign up fails (maybe user exists), try sign in
        const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
            email: `test_admin_${Date.now()}@example.com`,
            password: 'password123',
        });
        if (signInError) {
            console.log("Auth failed, cannot proceed with simulation as authenticated user.");
            return;
        }
    }

    // Now we have a user. Let's try insert.
    console.log("Authenticated as:", user?.id || 'New User');

    const merchantPayload = {
        store_name: "Debug Store",
        owner_name: "Debug Owner",
        email: "debug@example.com",
        phone: "9999999999",
        city: "Debug City",
        has_branches: false,
        status: "active",
        kyc_status: "pending"
    };

    const { data, error } = await supabase
        .from('merchants')
        .insert([merchantPayload])
        .select();

    if (error) {
        console.error("INSERT FAILED:", error);
    } else {
        console.log("INSERT SUCCESS:", data);

        // Clean up
        if (data && data[0]) {
            await supabase.from('merchants').delete().eq('id', data[0].id);
        }
    }
}

run();
