import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- CHECKING RLS POLICIES FOR: merchants ---');
        const policies = await prisma.$queryRaw`
            SELECT * FROM pg_policies WHERE tablename = 'merchants';
        `;
        console.table(policies);

        console.log('--- CHECKING RLS POLICIES FOR: merchant_branches ---');
        const policiesBranches = await prisma.$queryRaw`
            SELECT * FROM pg_policies WHERE tablename = 'merchant_branches';
        `;
        console.table(policiesBranches);
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
