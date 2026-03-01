const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const libPath = path.join(__dirname, 'src/lib/supabase.ts');
const libContent = fs.readFileSync(libPath, 'utf8');
const urlMatch = libContent.match(/supabaseUrl = '(.*?)'/);
const keyMatch = libContent.match(/supabaseAnonKey = '(.*?)'/);

if (!urlMatch || !keyMatch) { console.error('Could not parse supabase credentials'); process.exit(1); }

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function check() {
    console.log('Checking StoreProduct columns...');
    const { data, error } = await supabase.from('StoreProduct').select('*').limit(1);
    if (error) {
        console.error('Error selecting:', error);
    } else {
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log('No data to infer columns. Trying to insert to see specific error or use RPC if available.');
        }
    }
}

check();
