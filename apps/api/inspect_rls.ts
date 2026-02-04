import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- CHECKING RLS POLICIES FOR: Product ---');
        const policies = await prisma.$queryRaw`
            SELECT * FROM pg_policies WHERE tablename = 'Product';
        `;
        console.table(policies);
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
