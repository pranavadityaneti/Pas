const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OLD_ID = '63c32d5a-3132-433c-98c4-dbd7d1429342';
const NEW_ID = 'e49016c2-1065-486c-ae5a-8d3dbfce872a';

async function run() {
    try {
        console.log('=== PHASE 1: ORM SCRIPT ===');

        // 1. Fetch current data
        const oldUser = await prisma.user.findUnique({ where: { id: OLD_ID } });
        const oldMerchant = await prisma.merchant.findUnique({ where: { id: OLD_ID } });

        if (!oldUser || !oldMerchant) {
            console.log('Old records not found!');
            return;
        }

        console.log('Got old records. Proceeding to clone and link...');

        // 2. Change old emails to free up constraints
        await prisma.user.update({
            where: { id: OLD_ID },
            data: { email: oldUser.email + '_old' }
        });
        
        await prisma.merchant.update({
            where: { id: OLD_ID },
            data: { email: oldMerchant.email + '_old' }
        });

        // 3. Create NEW User and Merchant (with original email)
        const newUserBody = { ...oldUser, id: NEW_ID };
        delete newUserBody.updatedAt; // Prisma handles this
        
        const newMerchantBody = { ...oldMerchant, id: NEW_ID };
        delete newMerchantBody.updatedAt;
        if (newMerchantBody.verticalId === null) delete newMerchantBody.verticalId; // Adjust for optionality

        await prisma.user.create({ data: newUserBody });
        console.log('New user created.');
        await prisma.merchant.create({ data: newMerchantBody });
        console.log('New merchant created.');

        // 4. Move FK relations to NEW_ID
        // Store
        await prisma.store.updateMany({
            where: { managerId: OLD_ID },
            data: { managerId: NEW_ID, merchantId: NEW_ID, active: true }
        });
        console.log('Store linked to new ID and activated.');

        // Subscriptions
        await prisma.subscription.updateMany({
            where: { merchantId: OLD_ID },
            data: { merchantId: NEW_ID }
        });

        // 5. Delete Old records
        await prisma.merchant.delete({ where: { id: OLD_ID } });
        await prisma.user.delete({ where: { id: OLD_ID } });
        
        console.log('Old records cleaned up. Phase 1 Done!');

    } catch (error) {
        console.error('Execution Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
