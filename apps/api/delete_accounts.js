const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const prisma = new PrismaClient();

async function main() {
    const targetPhones = ['9100117027'];
    console.log(`Searching for accounts associated with: ${targetPhones.join(', ')}...`);

    const idsToDelete = new Set();

    for (const phone of targetPhones) {
        // Query Merchants
        const { data: merchants, error } = await supabaseAdmin
            .from('merchants')
            .select('id')
            .or(`phone.eq.${phone},phone.eq.91${phone},phone.eq.+91${phone}`);

        if (merchants) {
            merchants.forEach(m => idsToDelete.add(m.id));
        }

        // Query Auth Users via Prisma
        const fullPhone = `91${phone}`;
        const plusPhone = `+91${phone}`;
        const syntheticEmail = `91${phone}@phone.pickatstore.app`;
        const syntheticEmail2 = `${phone}@phone.pickatstore.app`;

        const authUsers = await prisma.$queryRaw`
            SELECT id FROM auth.users 
            WHERE phone IN (${phone}, ${fullPhone}, ${plusPhone}) 
            OR email IN (${syntheticEmail}, ${syntheticEmail2})
        `;

        if (authUsers) {
            authUsers.forEach(u => idsToDelete.add(u.id));
        }
    }

    const idsArray = Array.from(idsToDelete);
    console.log(`Found ${idsArray.length} unique accounts to delete.`);

    for (const id of idsArray) {
        console.log(`Deleting user ID: ${id}`);
        // 1. Delete from merchants table explicitly (in case CASCADE isn't enabled)
        await supabaseAdmin.from('merchants').delete().eq('id', id);
        
        // 2. Delete from auth.users
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) {
            console.error(`  -> Failed to delete from auth.users: ${authError.message}`);
        } else {
            console.log(`  -> Successfully deleted from auth.users.`);
        }
    }

    console.log('Cleanup complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
