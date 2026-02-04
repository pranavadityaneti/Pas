import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDuplicates() {
    console.log('Checking for duplicate emails in merchants table...');
    const { data: merchants, error } = await supabase
        .from('merchants')
        .select('email, id, store_name');

    if (error) {
        console.error('Error fetching merchants:', error);
        return;
    }

    const emailCounts: { [key: string]: string[] } = {};
    merchants?.forEach(m => {
        if (!emailCounts[m.email]) emailCounts[m.email] = [];
        emailCounts[m.email].push(m.id);
    });

    let found = false;
    for (const email in emailCounts) {
        if (emailCounts[email].length > 1) {
            console.log(`Duplicate found for email: ${email}`);
            console.log(`IDs: ${emailCounts[email].join(', ')}`);
            found = true;
        }
    }

    if (!found) {
        console.log('No duplicates found in merchants table.');
    }
}

checkDuplicates();
