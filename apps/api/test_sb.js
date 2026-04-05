require('dotenv').config({ path: '../consumer-app/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
    try {
        const { data, error } = await supabase.from('stores').select('*').limit(3);
        console.log("Error:", error);
        if (data && data.length > 0) {
            console.log("Sample store:", data[0]);
        } else {
            console.log("No data");
        }
    } catch (e) {
        console.error("Caught error:", e);
    }
}
main().catch(console.error);
