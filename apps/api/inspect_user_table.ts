import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('Inspecting User table...');

    // Try to selecting from 'User' - expecting RLS error or empty if we are anon
    const { data, error } = await supabase.from('User').select('*').limit(1);

    if (error) {
        console.error('Error selecting from User:', error);
    } else {
        console.log('Successfully selected from User table (Anon). Rows:', data?.length);
    }
}

inspect();
