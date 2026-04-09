const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OLD_ID = '63c32d5a-3132-433c-98c4-dbd7d1429342';
const NEW_ID = 'e49016c2-1065-486c-ae5a-8d3dbfce872a';

async function run() {
    try {
        console.log('=== PHASE 1: ORM SCRIPT PART 2 ===');

        // Check if Store with NEW_ID exists
        const occupyingStore = await prisma.store.findFirst({ where: { managerId: NEW_ID } });
        if (occupyingStore) {
            console.log('Found occupying Store with NEW_ID! Deleting it to make way...', occupyingStore.id);
            await prisma.store.delete({ where: { id: occupyingStore.id } });
        }

        // 4. Move FK relations to NEW_ID
        // Store
        const oldStore = await prisma.store.findFirst({ where: { managerId: OLD_ID } });
        if(oldStore) {
            await prisma.store.update({
                where: { id: oldStore.id },
                data: { managerId: NEW_ID, merchantId: NEW_ID, active: true }
            });
            console.log('Store linked to new ID and activated.');
        } else {
             console.log('Old store not found! Already linked?');
        }

        // Subscriptions
        await prisma.subscription.updateMany({
            where: { merchantId: OLD_ID },
            data: { merchantId: NEW_ID }
        });

        // 5. Delete Old records
        try {
             await prisma.merchant.delete({ where: { id: OLD_ID } });
             await prisma.user.delete({ where: { id: OLD_ID } });
             console.log('Old records cleaned up. Phase 1 Done!');
        } catch(e) {
             console.log('old records already deleted?', e.message);
        }

    } catch (error) {
        console.error('Execution Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
