const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySchema() {
    try {
        console.log('Querying first merchant...');
        const merchant = await prisma.merchant.findFirst();

        if (merchant) {
            console.log('Success! Found merchant:');
            console.log({
                id: merchant.id,
                storeName: merchant.storeName,
                gstNumber: merchant.gstNumber,
                storePhotos: merchant.storePhotos,
                turnoverRange: merchant.turnoverRange
            });
        } else {
            console.log('No merchants found in database.');
        }
    } catch (error) {
        console.error('Prisma Query Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifySchema();
