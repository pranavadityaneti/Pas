const { createClient } = require('@supabase/supabase-js');
// Load environment variables if available or prompt the user to replace these
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearGlobalProducts() {
    console.log("Starting to clear global products...");

    // Global products are those where createdByStoreId is null
    const { data, error } = await supabase
        .from('Product')
        .delete()
        .is('createdByStoreId', null);

    if (error) {
        console.error("Error deleting global products:", error);
    } else {
        console.log("Successfully wiped all global products from the database.");
    }
}

clearGlobalProducts();
