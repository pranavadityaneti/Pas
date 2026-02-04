
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: 'apps/api/.env' });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
    const { data, error } = await supabase
        .from('merchants')
        .select('*, merchant_branches(*)')
        .ilike('store_name', '%Jon Kirana%');
    if (error) {
        console.error(error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}
run();
