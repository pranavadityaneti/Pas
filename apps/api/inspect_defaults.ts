import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- CHECKING DEFAULTS FOR TIMESTAMPS ---');
        const cols = await prisma.$queryRaw`
            SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name IN ('Product', 'StoreProduct') 
            AND column_name IN ('createdAt', 'updatedAt');
        `;
        console.table(cols);
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
