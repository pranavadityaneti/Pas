const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OLD_ID = '63c32d5a-3132-433c-98c4-dbd7d1429342';
const NEW_ID = 'e49016c2-1065-486c-ae5a-8d3dbfce872a';

async function run() {
    try {
        console.log('=== PHASE 1: DIRECT PK UPDATE ===');

        // Let's try direct PK update. If ON UPDATE CASCADE is set, this is 1 line.
        // We do it in a particular order if cascade is not present.
        
        // 1. Update User ID. (Store.managerId will cascade if configured)
        await prisma.$executeRawUnsafe(`UPDATE "User" SET id = $2::uuid WHERE id = $1::uuid`, OLD_ID, NEW_ID);
        console.log('User ID updated.');

        // 2. Update merchant ID. (subscriptions.merchant_id will cascade if configured)
        await prisma.$executeRawUnsafe(`UPDATE merchants SET id = $2 WHERE id = $1`, OLD_ID, NEW_ID);
        console.log('Merchant ID updated.');

        // 3. Make sure Store has the right IDs and is active
        await prisma.$executeRawUnsafe(`
            UPDATE "Store" 
            SET "managerId" = $2::uuid, 
                "merchant_id" = $2, 
                active = true 
            WHERE "managerId" = $2::uuid OR "managerId" = $1::uuid
        `, OLD_ID, NEW_ID);
        console.log('Store updated and activated.');

    } catch (error) {
        console.error('Update failed. Constraint error?', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();
