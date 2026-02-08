
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function simulate() {
    const testEmail = `test.user.${Date.now()}@example.com`;
    console.log(`\n🧪 Starting Simulation for: ${testEmail}`);

    // Track cleanup IDs
    let createdMerchantId = null;
    let createdStoreId = null;

    try {
        const newMerchantId = randomUUID();
        createdMerchantId = newMerchantId;

        console.log(`1. Creating new Merchant record (ID: ${newMerchantId})...`);

        // Using $executeRawUnsafe to ensure we hit the table directly
        // The trigger is ON merchants table
        await prisma.$executeRawUnsafe(`
            INSERT INTO merchants (id, email, store_name, owner_name, phone, status, kyc_status, created_at, updated_at)
            VALUES ($1::uuid, $2, 'Simulation Store', 'Sim User', '1234567890', 'active', 'approved', NOW(), NOW())
        `, newMerchantId, testEmail);

        console.log('✅ Merchant record created.');

        // 2. Verify Store Creation (Automatic)
        console.log('2. Checking for automatic Store creation...');

        // Wait a small delay for trigger
        await new Promise(r => setTimeout(r, 1000));

        const store = await prisma.store.findUnique({
            where: { id: newMerchantId }
        });

        if (!store) {
            throw new Error('❌ Store was NOT created automatically. Trigger failed.');
        }
        createdStoreId = store.id;
        console.log('✅ Store found:', store.id);

        if (!store.active) {
            throw new Error('❌ Store was created but is INACTIVE. Default value issue.');
        }
        console.log('✅ Store is ACTIVE.');

        // 3. Verify User Creation (Automatic)
        console.log('3. Checking for automatic User creation...');
        const user = await prisma.user.findUnique({
            where: { email: testEmail }
        });

        if (!user) {
            throw new Error('❌ User login record was NOT created automatically.');
        }
        console.log('✅ User record found.');

        // 4. Simulate Inventory Addition (RLS Test Validity)
        console.log('4. Attempting to add Inventory Item...');
        // Find a product
        const product = await prisma.product.findFirst();
        if (!product) throw new Error('No global products found to add.');

        const inventory = await prisma.storeProduct.create({
            data: {
                storeId: store.id,
                productId: product.id,
                price: 100,
                stock: 50,
                active: true
            }
        });
        console.log('✅ Inventory item added successfully:', inventory.id);

        console.log('\n🎉 SUCCESS! The entire flow is working automatically.');

    } catch (e) {
        console.error('\n💥 SIMULATION FAILED:', e);
    } finally {
        console.log('\nCleaning up test data...');
        try {
            if (createdStoreId) {
                // Delete inventory first
                await prisma.storeProduct.deleteMany({ where: { storeId: createdStoreId } });
                // Delete store
                await prisma.store.delete({ where: { id: createdStoreId } }).catch(() => { });
            }
            if (createdMerchantId) {
                // Cascades might handle this, but manual cleanup is safer
                await prisma.$executeRawUnsafe(`DELETE FROM merchants WHERE id = $1::uuid`, createdMerchantId);
            }
            // User delete
            await prisma.user.delete({ where: { email: testEmail } }).catch(() => { });
            console.log('Cleanup done.');
        } catch (cleanupError) {
            console.error('Cleanup failed:', cleanupError);
        }

        await prisma.$disconnect();
    }
}

simulate();
