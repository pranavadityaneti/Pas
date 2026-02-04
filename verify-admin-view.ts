
import { createClient } from '@supabase/supabase-js';

// process.env keys should be set in terminal execution or hardcoded for this scratch script
// Assuming they are available in env from previous context or I'll try to find them.
// Actually, I'll rely on the existing Supabase setup in api/src/index.ts or just use the local connection string if possible?
// Supabase JS client needs URL and KEY.
// I will try to read .env first.

import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in apps/api/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const storeId = '9103ca71-523e-4e84-a664-3e40825f1be8';
    console.log(`Checking 'merchants' table/view for ID: ${storeId}`);

    const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', storeId)
        .single();

    if (error) {
        console.error('Error fetching from merchants view:', error);
    } else {
        console.log('Full Merchant Record:', JSON.stringify(data, null, 2));
    }
}

main();
