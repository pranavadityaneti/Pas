
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function simulate() {
    const testEmail = `test.user.${Date.now()}@example.com`;
    console.log(`\n🧪 Starting Simulation for: ${testEmail}`);

    try {
        // 1. Simulate Auth Signup (Insert into Merchant/User table)
        // The trigger 'trg_sync_merchant_data' listens on 'merchants' table essentially, 
        // OR the 'sync-store-to-merchant' script syncs them.
        // Let's check the finding from 'inspect_function.js': 
        // The function sync_merchant_data() is triggered on 'merchants' table INSERT/UPDATE.
        // So we must insert into 'merchants' to trigger the flow.

        const newMerchantId = `test-${Date.now()}`;

        console.log('1. Creating new Merchant record...');
        // We use $executeRawUnsafe because 'merchants' might be a separate table not fully typed or to avoid extensive setup
        // But better to use prisma if model exists. The schema.prisma has 'Merchant' model key 'merchants'.

        const merchant = await prisma.merchant.create({
            data: {
                id: newMerchantId,
                email: testEmail,
                storeName: "Simulation Store",
                ownerName: "Sim User",
                phone: "1234567890",
                status: "active", // This should set store.active = true
                kycStatus: "approved"
            }
        });
        console.log('✅ Merchant record created.');

        // 2. Verify Store Creation (Automatic)
        console.log('2. Checking for automatic Store creation...');

        // Wait a moment for trigger (usually instant in same tx, but good to be sure)
        const store = await prisma.store.findUnique({
            where: { id: newMerchantId } // Trigger sets Store ID = Merchant ID
        });

        if (!store) {
            throw new Error('❌ Store was NOT created automatically. Trigger failed.');
        }
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

        // 4. Simulate Inventory Addition (RLS Test)
        // Since we are running as admin (Prisma), we can't truly test RLS *restrictions* here easily without switching roles,
        // but we CAN verify that the data relationship holds and the insert succeeds.
        // To strictly test RLS, we'd need a Supabase client logged in as this user, which is complex to mock here.
        // However, the previous 'inspect_policies.js' confirmed the policies exist.
        // We will just verify that the data CAN be inserted validly.

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

        // Cleanup
        console.log('Cleaning up test data...');
        // Delete merchant (should cascade or we delete manually)
        await prisma.storeProduct.deleteMany({ where: { storeId: store.id } });
        await prisma.store.delete({ where: { id: store.id } });
        await prisma.merchant.delete({ where: { id: merchant.id } });
        await prisma.user.delete({ where: { email: testEmail } });
        console.log('Cleanup done.');

    } catch (e) {
        console.error('\n💥 SIMULATION FAILED:', e);
    } finally {
        await prisma.$disconnect();
    }
}

simulate();
