const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OLD_ID = '63c32d5a-3132-433c-98c4-dbd7d1429342';
const NEW_ID = 'e49016c2-1065-486c-ae5a-8d3dbfce872a';

async function run() {
    try {
        console.log('=== DEPENDENCY AUDIT ===');

        const branches = await prisma.$queryRaw`SELECT id FROM merchant_branches WHERE merchant_id = ${OLD_ID}`;
        console.log('merchant_branches:', branches.length, 'rows');

        const subs = await prisma.$queryRaw`SELECT id FROM subscriptions WHERE merchant_id = ${OLD_ID}`;
        console.log('subscriptions:', subs.length, 'rows');
        if (subs.length > 0) console.log('  IDs:', JSON.stringify(subs));

        const orders = await prisma.$queryRaw`SELECT id FROM orders WHERE user_id = ${OLD_ID}::uuid`;
        console.log('orders (by userId):', orders.length, 'rows');

        const storeOrders = await prisma.$queryRaw`SELECT id FROM orders WHERE store_id = ${OLD_ID}::uuid`;
        console.log('orders (by storeId):', storeOrders.length, 'rows');

        const storeProducts = await prisma.$queryRaw`SELECT id FROM "StoreProduct" WHERE "storeId" = ${OLD_ID}::uuid`;
        console.log('StoreProducts:', storeProducts.length, 'rows');

        const staff = await prisma.$queryRaw`SELECT id FROM store_staff WHERE store_id = ${OLD_ID}::uuid`;
        console.log('StoreStaff:', staff.length, 'rows');

        const notifs = await prisma.$queryRaw`SELECT id FROM notifications WHERE user_id = ${OLD_ID}::uuid`;
        console.log('Notifications:', notifs.length, 'rows');

        // Auth user
        const authUser = await prisma.$queryRaw`SELECT id, phone, email FROM auth.users WHERE id = ${NEW_ID}::uuid`;
        console.log('\n=== AUTH USER (target) ===');
        console.log(JSON.stringify(authUser, null, 2));

        // Current merchant
        const merchant = await prisma.$queryRaw`SELECT id, email, phone, store_name FROM merchants WHERE id = ${OLD_ID}`;
        console.log('\n=== MERCHANT (current) ===');
        console.log(JSON.stringify(merchant, null, 2));

        // Check if NEW_ID already exists in any target tables
        const existingUser = await prisma.$queryRaw`SELECT id FROM "User" WHERE id = ${NEW_ID}::uuid`;
        console.log('\n=== CONFLICT CHECK ===');
        console.log('User with NEW_ID exists:', existingUser.length > 0);

        const existingMerchant = await prisma.$queryRaw`SELECT id FROM merchants WHERE id = ${NEW_ID}`;
        console.log('Merchant with NEW_ID exists:', existingMerchant.length > 0);

        const existingStore = await prisma.$queryRaw`SELECT id FROM "Store" WHERE id = ${NEW_ID}::uuid`;
        console.log('Store with NEW_ID exists:', existingStore.length > 0);

    } catch (error) {
        console.error('Audit failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();
