const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- CHECKING POLICIES FOR: StoreProduct ---');
        const policies = await prisma.$queryRaw`
            SELECT policyname, permissive, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'StoreProduct';
        `;
        console.table(policies);
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
