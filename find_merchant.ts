import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findMerchant() {
    const targetId = '8c36d2ad-52da-42f5-90e8-fcd05a8808b9';
    console.log(`Searching for merchant with ID: ${targetId}`);

    const { data: byId, error: errorId } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

    if (errorId) console.error('Error searching by ID:', errorId);
    if (byId) {
        console.log('Found by ID:', byId);
    } else {
        console.log('No record found for this ID in merchants table.');
    }

    // List all merchants again to see what's there
    console.log('\nListing all current merchants:');
    const { data: allMerchants } = await supabase.from('merchants').select('id, email, status, store_name');
    allMerchants?.forEach(m => console.log(` - ID: ${m.id}, Email: ${m.email}, Status: ${m.status}, Store: ${m.store_name}`));
}

findMerchant();
