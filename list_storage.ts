
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function listFiles() {
    console.log('--- Listing top level folders/files in merchant-docs ---');
    const { data: rootItems, error: rootError } = await supabase.storage.from('merchant-docs').list('');
    if (rootError) {
        console.error('Root Error:', rootError);
        return;
    }

    console.log('Root items:', JSON.stringify(rootItems, null, 2));

    for (const item of rootItems) {
        if (!item.id) { // likely a folder
            console.log(`\n--- Listing inside folder: ${item.name} ---`);
            const { data: folderItems, error: folderError } = await supabase.storage.from('merchant-docs').list(item.name);
            if (folderError) console.error(`Error in ${item.name}:`, folderError);
            else console.log(JSON.stringify(folderItems, null, 2));
        }
    }
}

listFiles();
