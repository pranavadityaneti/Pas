import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanup() {
    const ids = ['3bc26411-46f2-4c3e-8a02-1c6d8156ce84', '6cd18daf-81dc-4323-a5a2-ed6caf711c10'];
    console.log(`Deleting stale merchant records: ${ids.join(', ')}`);

    const { error } = await supabase
        .from('merchants')
        .delete()
        .in('id', ids);

    if (error) {
        console.error('Delete Error:', error);
    } else {
        console.log('Successfully deleted stale merchant records.');
    }
}

cleanup();
