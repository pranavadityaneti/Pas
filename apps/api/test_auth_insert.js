const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    // We will register a user using email to get a valid authenticated session
    const uniqueEmail = `test_branch_${Date.now()}@example.com`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: uniqueEmail,
        password: 'Password123!',
    });
    
    if (authError) {
        return console.error("Auth Error:", authError);
    }

    const userId = authData.user.id;
    console.log("Registered Test User:", userId);

    // 1. Insert Merchant
    const { error: merchantError } = await supabase.from('merchants').upsert({
        id: userId,
        owner_name: 'Test Owner',
        email: uniqueEmail,
        store_name: 'Test Store',
        category: 'Grocery',
        city: 'Hyderabad',
        phone: '1234567890',
        status: 'inactive',
        kyc_status: 'pending'
    });

    if (merchantError) {
        return console.error("Merchant Upsert Error:", merchantError);
    }
    console.log("Merchant inserted");

    // 2. Insert Branch
    const branchRecords = [{
        id: `br_${Date.now()}`,
        merchant_id: userId,
        branch_name: 'Test Branch Name',
        address: 'Test Addr',
        manager_name: '',
        phone: ''
    }];

    const { data: branchData, error: branchError } = await supabase.from('merchant_branches').insert(branchRecords).select();
    console.log("Branch Insert Error:", branchError);
    if (branchData) {
        console.log("Branch successfully inserted!");
    }
}
main();
