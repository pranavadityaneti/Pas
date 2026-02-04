
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function listBuckets() {
    console.log('--- Listing Supabase Storage Buckets ---');
    const { data, error } = await supabase.storage.listBuckets();
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

listBuckets();
