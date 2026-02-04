
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const allStoreProducts = await prisma.storeProduct.findMany({
        include: { product: true, store: true }
    });
    console.log('Total StoreProducts in DB: ' + allStoreProducts.length);
    const stores: any = {};
    allStoreProducts.forEach(sp => {
        if (!stores[sp.storeId]) stores[sp.storeId] = { name: sp.store.name, count: 0 };
        stores[sp.storeId].count++;
    });
    console.log('Inventory breakdown:');
    for (const storeId in stores) {
        console.log(`- ${stores[storeId].name} (${storeId}): ${stores[storeId].count} items`);
    }
}
run();
