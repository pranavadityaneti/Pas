const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    // 1. Authenticate as the user we just created
    // Actually, I don't have the user's password because it's OTP based.
    // Instead, I will use Service Role to see if the schema even accepts this payload.
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const branchRecords = [{
        id: `br_test`,
        merchant_id: 'f393dd5e-9b7b-497c-8756-9aeb75c2f683', // Example ID
        branch_name: 'Test Branch',
        address: 'Test Address',
        manager_name: 'Test Manager',
        phone: '1234567890'
    }];
    
    const { data, error } = await supabaseAdmin.from('merchant_branches').insert(branchRecords).select();
    console.log("Admin Insert Error:", error);

    if (!error && data) {
        await supabaseAdmin.from('merchant_branches').delete().eq('id', 'br_test');
    }
}
main();
