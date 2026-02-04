
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function cleanup() {
    const staleId = 'fb809c96-2856-4056-b50e-d8a4f9ed4922';
    console.log(`Deleting stale merchant ID: ${staleId}`);

    const { error } = await supabase
        .from('merchants')
        .delete()
        .eq('id', staleId);

    if (error) {
        console.error('Delete Error:', error);
    } else {
        console.log('Successfully deleted stale merchant record.');
    }
}

cleanup();
