const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
    // Check if RLS is enabled on merchant_branches
    const { data, error } = await supabaseAdmin.rpc('get_table_rls_status', { table_name: 'merchant_branches' });
    console.log(data, error);
}
main();
