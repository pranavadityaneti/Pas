import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- CHECKING TABLE: Product ---');
        const productCols = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'Product';
        `;
        console.table(productCols);

        console.log('\n--- CHECKING TABLE: StoreProduct ---');
        const storeProductCols = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'StoreProduct';
        `;
        console.table(storeProductCols);

    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
