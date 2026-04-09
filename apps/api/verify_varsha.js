const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const phone = '9182369196';
        const formattedPhone = '+9182369196';
        const phone91 = '919182369196';

        // 1. auth.users
        const authUsers = await prisma.$queryRaw`SELECT id, phone FROM auth.users WHERE phone = ${phone} OR phone = ${formattedPhone} OR phone = ${phone91}`;
        console.log('--- AUTH USERS ---');
        console.log(authUsers);

        // 2. merchants
        const merchants = await prisma.$queryRaw`SELECT id, phone, store_name FROM merchants WHERE phone = ${phone} OR phone = ${phone91}`;
        console.log('--- MERCHANTS ---');
        console.log(merchants);
        
        const merchantId = merchants.length > 0 ? merchants[0].id : null;

        // 3. User
        const users = await prisma.$queryRaw`SELECT id, phone, role FROM "User" WHERE phone = ${phone} OR phone = ${phone91}`;
        console.log('--- USER ---');
        console.log(users);

        // 4. Store
        let stores = [];
        if (merchantId) {
            stores = await prisma.$queryRaw`SELECT id, "managerId", "merchant_id", active FROM "Store" WHERE "managerId" = ${merchantId}::uuid OR "merchant_id" = ${merchantId}`;
        }
        console.log('--- STORE ---');
        console.log(stores);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
