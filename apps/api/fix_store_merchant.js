require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const stores = await prisma.store.findMany({ select: { id: true, name: true, merchantId: true } });
    console.log("Stores:", stores);

    const merchants = await prisma.merchant.findMany({ select: { id: true, storeName: true } });
    console.log("Merchants:", merchants);

    // If there's a merchant, attach it to all stores missing a merchantId
    if (merchants.length > 0) {
        const merchantId = merchants[0].id;
        for (const store of stores) {
            if (!store.merchantId) {
                console.log(`Fixing store ${store.name}... assigning merchant ${merchantId}`);
                await prisma.store.update({
                    where: { id: store.id },
                    data: { merchantId: merchantId }
                });
            }
        }
        console.log("Done fixing stores!");
    } else {
        console.log("No merchants exist to attach!");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
