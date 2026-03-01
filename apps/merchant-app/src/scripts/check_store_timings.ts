
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStore() {
    console.log('Checking store...');
    const { data: stores, error } = await supabase
        .from('Store')
        .select('id, name, operating_hours'); // removed limit(1)

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (stores && stores.length > 0) {
        console.log(`Found ${stores.length} stores:`);
        stores.forEach(store => {
            console.log('------------------------------------------------');
            console.log('ID:', store.id);
            console.log('Name:', store.name);
            console.log('Operating Hours:', JSON.stringify(store.operating_hours, null, 2));
        });
    } else {
        console.log('No stores found.');
    }
}

checkStore();
