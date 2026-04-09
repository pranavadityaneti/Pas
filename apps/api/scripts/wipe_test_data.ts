import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from api/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// ============================================
// SAFE LIST: Production / Golden Accounts
// Add phone numbers (e.g. '919999999999') or UUIDs you NEVER want deleted
// ============================================
const SAFE_LIST: string[] = [
    '9182369196', // Varsha bangles (formatted as stored in merchants.phone)
    'mochicafeandbistro@gmail.com',
    'e49016c2-1065-486c-ae5a-8d3dbfce872a' // Varsha UUID
];

async function run() {
    console.log('🛑 STARTING TEST DATA WIPE SCRIPT');
    
    try {
        // Fetch all merchants
        const merchants = await prisma.merchant.findMany();
        
        let deletedCount = 0;

        for (const merchant of merchants) {
            const isSafe = SAFE_LIST.includes(merchant.phone) || 
                           SAFE_LIST.includes(merchant.id) || 
                           (merchant.email ? SAFE_LIST.includes(merchant.email) : false);

            if (isSafe) {
                console.log(`🛡️ SKIPPING PROTECTED MERCHANT: ${merchant.storeName || merchant.email} (${merchant.phone})`);
                continue;
            }

            console.log(`\n🗑️ WIPING TEST MERCHANT: ${merchant.storeName || merchant.email} (${merchant.id})`);

            const stores = await prisma.store.findMany({ 
                where: { OR: [{ managerId: merchant.id }, { merchantId: merchant.id }] } 
            });
            const storeIds = stores.map(s => s.id);

            if (storeIds.length > 0) {
                // Delete OrderItems (deepest child, restricted by StoreProduct and Order)
                await prisma.orderItem.deleteMany({
                    where: {
                        OR: [
                            { order: { storeId: { in: storeIds } } },
                            { storeProduct: { storeId: { in: storeIds } } }
                        ]
                    }
                });
                console.log(`   - Deleted OrderItems`);

                // Delete Orders (restricted by Store)
                await prisma.order.deleteMany({ where: { storeId: { in: storeIds } } });
                console.log(`   - Deleted Orders (as Store)`);

                // Delete StoreProducts
                await prisma.storeProduct.deleteMany({ where: { storeId: { in: storeIds } } });
                console.log(`   - Deleted StoreProducts`);

                // Delete StoreStaff
                await prisma.storeStaff.deleteMany({ where: { storeId: { in: storeIds } } });
                console.log(`   - Deleted StoreStaff`);

                // Delete Coupons
                await prisma.coupon.deleteMany({ where: { storeId: { in: storeIds } } });
                console.log(`   - Deleted Coupons`);
            }

            // Also delete any orders where the merchant acted as a customer (User relation)
            await prisma.orderItem.deleteMany({ where: { order: { userId: merchant.id } } });
            await prisma.order.deleteMany({ where: { userId: merchant.id } });
            console.log(`   - Deleted Orders (as Customer)`);

            // 1. Delete dependent relations first (Prisma constraints)
            await prisma.subscription.deleteMany({ where: { merchantId: merchant.id } });
            console.log(`   - Deleted Subscriptions`);

            await prisma.merchantBranch.deleteMany({ where: { merchantId: merchant.id } });
            console.log(`   - Deleted Branches`);

            await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
            console.log(`   - Deleted Stores`);

            // 2. Delete Core Merchant and User records
            await prisma.merchant.delete({ where: { id: merchant.id } });
            console.log(`   - Deleted Prisma Merchant record`);

            await prisma.user.deleteMany({ where: { id: merchant.id } });
            console.log(`   - Deleted Prisma User record`);

            // 3. Wipe from Supabase Auth Vault
            const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(merchant.id);
            if (deleteAuthError) {
                console.error(`   ❌ Failed to delete from Supabase Auth: ${deleteAuthError.message}`);
                // Sometimes they might not exist in Auth, but we log it anyway
            } else {
                console.log(`   - ✅ Deleted from Supabase Auth Vault!`);
            }
            
            deletedCount++;
        }

        // ============================================
        // Phase 4: The Orphan Sweep
        // ============================================
        console.log('\n🧹 PHASE 4: THE ORPHAN SWEEP (Cleaning up orphaned stores)');
        const allStores = await prisma.store.findMany();
        let orphanedDeletedCount = 0;

        for (const store of allStores) {
            const isSafe = (store.merchantId && SAFE_LIST.includes(store.merchantId)) || 
                           (store.managerId && SAFE_LIST.includes(store.managerId));

            if (!isSafe) {
                console.log(`   🗑️ DELETING ORPHANED STORE: ${store.name} (${store.id})`);
                
                const storeIds = [store.id];

                // Delete OrderItems (deepest child)
                await prisma.orderItem.deleteMany({
                    where: {
                        OR: [
                            { order: { storeId: { in: storeIds } } },
                            { storeProduct: { storeId: { in: storeIds } } }
                        ]
                    }
                });

                // Delete Orders
                await prisma.order.deleteMany({ where: { storeId: { in: storeIds } } });

                // Delete StoreProducts
                await prisma.storeProduct.deleteMany({ where: { storeId: { in: storeIds } } });

                // Delete StoreStaff
                await prisma.storeStaff.deleteMany({ where: { storeId: { in: storeIds } } });

                // Delete Coupons
                await prisma.coupon.deleteMany({ where: { storeId: { in: storeIds } } });

                // Finally delete the store itself
                await prisma.store.delete({ where: { id: store.id } });
                
                orphanedDeletedCount++;
            }
        }

        if (orphanedDeletedCount > 0) {
            console.log(`   ✅ Cleaned up ${orphanedDeletedCount} orphaned stores.`);
        } else {
            console.log(`   ✨ No orphaned stores found.`);
        }

        console.log(`\n✅ WIPE COMPLETE. Deleted ${deletedCount} test accounts and ${orphanedDeletedCount} orphaned stores.`);
        
    } catch (error) {
        console.error('🔥 CRITICAL ERROR DURING WIPE:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
