
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function fixKyc() {
    const storeId = '9103ca71-523e-4e84-a664-3e40825f1be8';
    console.log(`Setting KYC status for ${storeId} to Approved...`);

    const { data, error } = await supabase
        .from('merchants')
        .update({
            kyc_status: 'approved',
            status: 'active',
            updated_at: new Date().toISOString()
        })
        .eq('id', storeId)
        .select();

    if (error) {
        console.error('Update Error:', error);
    } else {
        console.log('Update Result:', JSON.stringify(data, null, 2));
        if (data && data.length > 0) {
            console.log('Successfully approved merchant KYC.');
        } else {
            console.log('No record found with that ID.');
        }
    }
}

fixKyc();
