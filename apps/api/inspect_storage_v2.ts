import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- CHECKING RLS POLICIES FOR STORAGE.OBJECTS ---');
        const policies = await prisma.$queryRaw`
            SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
        `;
        console.table(policies);
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
