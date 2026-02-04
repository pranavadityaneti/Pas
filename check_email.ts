
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkByEmail() {
    const email = 'pranav.n@drut.club';
    console.log(`Checking merchants for email: ${email}`);

    const { data, error } = await supabase
        .from('merchants')
        .select('id, store_name, status')
        .eq('email', email);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Results:', JSON.stringify(data, null, 2));
    }
}

checkByEmail();
