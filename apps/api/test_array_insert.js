const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    const uniqueEmail = `test_branch_array_${Date.now()}@example.com`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: uniqueEmail,
        password: 'Password123!',
    });
    
    if (authError) return console.error("Auth Error:", authError);
    const userId = authData.user.id;
    console.log("Registered Test User:", userId);

    await supabase.from('merchants').upsert({
        id: userId, owner_name: 'Test Owner', email: uniqueEmail, store_name: 'Test Store', category: 'Grocery', city: 'Hyderabad', phone: '1234567890', status: 'inactive', kyc_status: 'pending'
    });

    const branches = [{ name: 'B1', address: 'A1', manager_name: '', phone: '' }, { name: 'B2', address: 'A2', manager_name: '', phone: '' }];
    
    // Exactly as mapped in signup.tsx
    const branchRecords = branches.map(b => ({
        id: `br_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        merchant_id: userId,
        branch_name: b.name,
        address: b.address,
        manager_name: b.manager_name,
        phone: b.phone
    }));

    const { data: branchData, error: branchError } = await supabase.from('merchant_branches').insert(branchRecords);
    console.log("Branch Insert Error:", branchError);
    console.log("Branch Data:", branchData);
}
main();
