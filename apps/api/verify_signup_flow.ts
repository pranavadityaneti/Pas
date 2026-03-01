
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING FINAL SIGNUP VERIFICATION (RAW SQL) ---');
    const testId = `test_user_raw_${Date.now()}`;
    const testEmail = `test_raw_${Date.now()}@example.com`;

    try {
        // 1. Ensure City Exists
        const cities: any[] = await prisma.$queryRaw`SELECT * FROM "City" WHERE name = 'Hyderabad'`;
        if (cities.length === 0) {
            throw new Error('City "Hyderabad" not found.');
        }

        // 2. Simulate Merchant Signup (Raw SQL Insert)
        // This mimics Supabase/PostgREST insertion
        console.log('🔄 [Action] Inserting Mock Merchant (Raw SQL)...');

        await prisma.$executeRaw`
            INSERT INTO merchants (
                id, owner_name, email, phone, store_name, category, city, address, 
                latitude, longitude, store_photos, operating_days, operating_hours, status, kyc_status, "updated_at"
            ) VALUES (
                ${testId}, 'Test Owner Raw', ${testEmail}, '9999999999', 'Test Raw Store', 'Grocery', 'Hyderabad', '123 Raw St', 
                17.0, 78.0, ARRAY['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'], 
                ARRAY['Mon', 'Tue'], '{"open": "09:00"}', 'active', 'pending', NOW()
            )
        `;
        console.log('✅ [Action] Mock Merchant inserted.');

        // 3. Verify User Creation (Trigger Check)
        // Give trigger a moment
        await new Promise(r => setTimeout(r, 1000));

        const users: any[] = await prisma.$queryRaw`SELECT * FROM "User" WHERE id = ${testId}`;
        if (users.length === 0) throw new Error('❌ Trigger Failed: User record was NOT created.');

        if (users[0].role !== 'MERCHANT') throw new Error(`❌ Data Mismatch: User role is ${users[0].role}, expected MERCHANT`);
        console.log('✅ [Verify] Public User record created with correct Role.');

        // 4. Verify Store Creation (Trigger Check)
        const stores: any[] = await prisma.$queryRaw`SELECT * FROM "Store" WHERE id = ${testId}`;
        if (stores.length === 0) throw new Error('❌ Trigger Failed: Store record was NOT created.');

        if (stores[0].image !== 'https://example.com/photo1.jpg') {
            throw new Error(`❌ Image Sync Failed: Got "${stores[0].image}", expected "https://example.com/photo1.jpg"`);
        }

        // Check Operating Days
        // Postgres returns arrays as arrays in library usually
        const opDays = stores[0].operatingDays || stores[0].operating_days; // Handle casing return
        const daysMatch = JSON.stringify(opDays) === JSON.stringify(['Mon', 'Tue']);

        if (!daysMatch) throw new Error(`❌ Operating Days Mismatch. Got ${JSON.stringify(opDays)}`);

        console.log('✅ [Verify] Public Store record created perfectly with Image and Details.');

        // 5. Cleanup
        console.log('🔄 [Cleanup] Deleting test records...');
        await prisma.$executeRaw`DELETE FROM merchants WHERE id = ${testId}`;
        await prisma.$executeRaw`DELETE FROM "Store" WHERE id = ${testId}`;
        await prisma.$executeRaw`DELETE FROM "User" WHERE id = ${testId}`;
        console.log('✅ [Cleanup] Done.');

        console.log('\n🎉 SUCCESS: The Signup Logic is PERFECT. All safeguards passed.');

    } catch (error) {
        console.error('\n🚨 VALIDATION FAILED:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
