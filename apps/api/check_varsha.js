const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const merchantId = '63c32d5a-3132-433c-98c4-dbd7d1429342';
        const phone = '9182369196';
        
        // Check Store by merchant_id (text column) 
        const stores = await prisma.$queryRaw`
            SELECT id, name, "managerId", "merchant_id", active 
            FROM "Store" 
            WHERE "merchant_id" = ${merchantId}
        `;
        console.log('=== STORES by merchant_id (text match) ===');
        console.log(JSON.stringify(stores, null, 2));
        
        // Check Store by managerId (uuid column) - need to cast
        const stores2 = await prisma.$queryRaw`
            SELECT id, name, "managerId", "merchant_id", active 
            FROM "Store" 
            WHERE "managerId" = ${merchantId}::uuid
        `;
        console.log('\n=== STORES by managerId (uuid match) ===');
        console.log(JSON.stringify(stores2, null, 2));
        
        // Check auth.users
        const authUsers = await prisma.$queryRaw`
            SELECT id, phone, email, created_at 
            FROM auth.users 
            WHERE phone = ${phone} OR phone = ${'91' + phone} OR phone = ${'+91' + phone}
        `;
        console.log('\n=== AUTH.USERS ===');
        console.log(JSON.stringify(authUsers, null, 2));
        
        // Also check: what does the merchant app login endpoint actually do?
        // Check if there's a store_staff record
        const staff = await prisma.$queryRaw`
            SELECT id, store_id, name, phone, role 
            FROM store_staff 
            WHERE phone = ${phone} OR phone = ${'91' + phone} OR phone = ${'+91' + phone}
        `;
        console.log('\n=== STORE_STAFF ===');
        console.log(JSON.stringify(staff, null, 2));
        
    } catch (error) {
        console.error('Query failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();
