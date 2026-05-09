const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    console.log('Testing useStores query...');
    const { data, error } = await supabase
        .from('merchant_branches')
        .select('id, branch_name, address, merchant_id, latitude, longitude, is_active, merchant:merchants(store_photos, vertical:Vertical(name))')
        .eq('is_active', true);

    if (error) {
        console.error('Query Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Query Success. Rows:', data?.length);
    }
}

testQuery();
