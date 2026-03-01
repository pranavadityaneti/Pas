import { supabase } from './src/lib/supabase';

async function check() {
    console.log('Checking City table...');
    const { count, error } = await supabase.from('City').select('*', { count: 'exact', head: true });
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('City count:', count);
    }
}

check();
