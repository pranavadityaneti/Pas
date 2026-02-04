import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listTables() {
    const { data, error } = await supabase.rpc('get_tables'); // This might not work if rpc doesn't exist
    if (error) {
        // Fallback to a simple query that might give us clues
        console.log('Trying fallback query...');
        const { data: merchants, error: mError } = await supabase.from('merchants').select('id').limit(1);
        if (mError) {
            console.error('Merchants table not found via common select');
        } else {
            console.log('Merchants table exists.');
        }
    } else {
        console.log('Tables:', data);
    }
}

listTables();
