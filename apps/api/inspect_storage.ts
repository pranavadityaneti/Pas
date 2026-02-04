import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- CHECKING STORAGE BUCKETS ---');
        const buckets = await prisma.$queryRaw`
            SELECT id, name, public, owner, created_at FROM storage.buckets;
        `;
        console.table(buckets);

        console.log('--- CHECKING STORAGE POLICIES ---');
        const policies = await prisma.$queryRaw`
            SELECT * FROM storage.policies WHERE bucket_id = 'merchant-docs';
        `;
        console.table(policies);
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
