
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from current dir (apps/api)
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

console.log('Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking Supabase connection...');
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
        console.error('Error listing buckets:', error);
    } else {
        console.log('Buckets found:', data.map(b => b.name));
        const productsBucket = data.find(b => b.name === 'products');
        if (!productsBucket) {
            console.log('CRITICAL: Bucket "products" does NOT exist.');
            // Try to create it? Only works if Service Role, but let's see.
        } else {
            console.log('Bucket "products" exists.');
            console.log('Public:', productsBucket.public);
        }
    }
}
check();
