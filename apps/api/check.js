const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/pranavaditya/projects/pas-admin/apps/api/.env' });

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    console.log("Checking User in auth.users via API...");
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
        console.error("Auth Error:", usersError);
        return;
    }

    const targetUser = usersData.users.find(u => u.phone === '919959777027' || u.phone === '+919959777027' || u.phone === '9959777027');
    console.log("Auth User Found:", JSON.stringify(targetUser, null, 2));

    if (targetUser) {
        console.log(`\nChecking merchants table for id: ${targetUser.id}`);
        const { data: merchantData, error: merchantError } = await supabaseAdmin
            .from('merchants')
            .select('*')
            .eq('id', targetUser.id);
        
        console.log("Merchant Record by User ID:", JSON.stringify(merchantData, null, 2));
    }
    
    const { data: phoneData } = await supabaseAdmin
            .from('merchants')
            .select('*')
            .eq('phone', '9959777027');
    console.log("\nMerchant Record by phone 9959777027:", JSON.stringify(phoneData, null, 2));

    const { data: phoneData2 } = await supabaseAdmin
            .from('merchants')
            .select('*')
            .eq('phone', '919959777027');
    console.log("Merchant Record by phone 919959777027:", JSON.stringify(phoneData2, null, 2));
}

check();
