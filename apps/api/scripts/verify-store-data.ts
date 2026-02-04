
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Store Data - Round 3 (Corrected) ---');

    // 1. Search for specific ID mentioned in previous context
    const specificId = '9103ca71-523e-4e84-a664-3e40825f1be8';
    const specificStore = await prisma.store.findUnique({
        where: { id: specificId },
        include: { manager: true }
    });

    if (specificStore) {
        console.log(`FOUND Specific Store by ID ${specificId}:`);
        console.log(`- Name: ${specificStore.name}`);
        console.log(`- Manager Email: ${specificStore.manager?.email || 'N/A'}`);

        // Check products for this specific store
        const products = await prisma.product.count({
            where: { createdByStoreId: specificId }
        });
        console.log(`- Custom Products count: ${products}`);
    } else {
        console.log(`Store with ID ${specificId} NOT FOUND.`);
    }

    // 2. List ALL stores to help identification
    console.log('\nListing ALL Stores in DB:');
    const allStores = await prisma.store.findMany({
        include: { manager: true }
    });

    for (const s of allStores) {
        const pCount = await prisma.product.count({ where: { createdByStoreId: s.id } });
        console.log(`- [${s.id}] ${s.name} (Manager: ${s.manager?.email || 'N/A'}) - Custom Products: ${pCount}`);
    }


    // 3. Inspect 'merchants' table/view to see if it's a View or Table
    try {
        console.log('\n--- Checking "merchants" relation ---');
        const result = await prisma.$queryRaw`SELECT * FROM merchants WHERE id = ${specificId}::uuid`;
        console.log('Result from "SELECT * FROM merchants":', result);

        const tableType = await prisma.$queryRaw`
        SELECT table_type
        FROM information_schema.tables
        WHERE table_name = 'merchants'`;
        console.log('Table Type for "merchants":', tableType);

    } catch (e: any) { // Explicitly type 'e' as 'any' or 'Error'
        console.log('Error querying "merchants": (It might not exist or permission denied)', e.message);
    }

    // 4. Count total custom products again
    const totalCustom = await prisma.product.count({ where: { createdByStoreId: { not: null } } });
    console.log(`\nTotal Custom Products in DB: ${totalCustom}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
