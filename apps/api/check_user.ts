import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) console.error(error);
    const users = data?.users.filter(u => u.phone?.includes('9959777027') || u.email?.includes('reviewer'));
    console.log(users);
}
check();
