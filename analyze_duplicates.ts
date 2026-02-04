import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function analyzeDuplicates() {
    console.log('Analyzing duplicates in merchants table...');
    const { data: merchants, error } = await supabase
        .from('merchants')
        .select('email, id, status, created_at, store_name');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const emailGroups: { [key: string]: any[] } = {};
    merchants?.forEach(m => {
        if (!emailGroups[m.email]) emailGroups[m.email] = [];
        emailGroups[m.email].push(m);
    });

    for (const email in emailGroups) {
        if (emailGroups[email].length > 1) {
            console.log(`\nEmail: ${email}`);
            emailGroups[email].forEach((m: any) => {
                console.log(` - ID: ${m.id}, Status: ${m.status}, Created: ${m.created_at}, Store: ${m.store_name}`);
            });
        }
    }
}

analyzeDuplicates();
