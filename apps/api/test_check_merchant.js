const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
    const { data: existingMerchant, error } = await supabaseAdmin
        .from('merchants')
        .select('*')
        .eq('phone', '9959777027')
        .maybeSingle();

    if (error) {
        console.error("DB Error:", error);
    } else {
        console.log("Merchant found:", !!existingMerchant, existingMerchant?.phone);
    }
}
main();
