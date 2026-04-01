import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/Users/pranavaditya/projects/pas-admin/apps/api/.env' });

const prisma = new PrismaClient();
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanup() {
    const phoneNumber = '9959777027';
    console.log(`Starting cleanup for phone: ${phoneNumber}`);

    // 1. Delete from Prisma User (Cascade deletes Store, etc.)
    try {
        const users = await prisma.user.findMany({
            where: { email: { contains: 'pas.com' } } // Only cleanup seeded test users if needed, or by ID
        });
        
        // Wait, the user's phone is not in User model if it failed, actually let's delete by email or phone.
        // Let's just delete the store and user for id '200ea527-0fb9-4db0-8165-ca1286ea91b0'
        const legacyId = '200ea527-0fb9-4db0-8165-ca1286ea91b0';
        try {
            await prisma.storeProduct.deleteMany({ where: { store: { managerId: legacyId } } });
            await prisma.store.deleteMany({ where: { managerId: legacyId } });
            await prisma.user.delete({ where: { id: legacyId } }).catch(() => {});
            console.log(`Deleted Prisma User and Store dependencies for: ${legacyId}`);
        } catch(e) {}
    } catch (e: any) {
        console.error('Error deleting Prisma user:', e.message);
    }

    // 2. Delete from merchants table (raw SQL)
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM merchants WHERE phone = $1 OR phone = $2`, phoneNumber, `91${phoneNumber}`);
        console.log(`Deleted from 'merchants' table.`);
    } catch (e: any) {
        console.error('Error deleting from merchants table:', e.message);
    }
    
    // 3. Delete from Supabase Auth
    try {
         const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
         const targetUsers = usersData.users.filter(u => u.phone === phoneNumber || u.phone === `91${phoneNumber}` || u.phone === `+91${phoneNumber}`);
         
         for (const u of targetUsers) {
             await supabaseAdmin.auth.admin.deleteUser(u.id);
             console.log(`Deleted Supabase Auth User: ${u.id}`);
         }
    } catch(e: any) {
        console.error('Error deleting Supabase Auth user:', e.message);
    }
    
    // Also delete any subscriptions/branches mapped to legacy IDs if they exist
    const legacyId = '200ea527-0fb9-4db0-8165-ca1286ea91b0';
    try {
        await supabaseAdmin.from('merchant_branches').delete().eq('merchant_id', legacyId);
        await supabaseAdmin.from('subscriptions').delete().eq('merchant_id', legacyId);
    } catch(e) {}

    console.log("Cleanup complete. The user can now sign up from scratch.");
}

cleanup()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
