const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- CHECKING FUNCTION: sync_merchant_data ---');
        const func = await prisma.$queryRaw`
            SELECT pg_get_functiondef('sync_merchant_data'::regproc);
        `;
        console.log(func[0].pg_get_functiondef);
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
