const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log("Applying RLS policies to StoreProduct...");
        
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Merchant can insert StoreProduct" ON "StoreProduct"`);
        await prisma.$executeRawUnsafe(`
            CREATE POLICY "Merchant can insert StoreProduct" 
            ON "public"."StoreProduct" 
            FOR INSERT 
            WITH CHECK (
                "storeId" IN (SELECT id FROM "public"."Store" WHERE "merchant_id" = auth.uid()::text OR "managerId" = auth.uid())
            )
        `);

        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Merchant can update StoreProduct" ON "StoreProduct"`);
        await prisma.$executeRawUnsafe(`
            CREATE POLICY "Merchant can update StoreProduct" 
            ON "public"."StoreProduct" 
            FOR UPDATE 
            USING (
                "storeId" IN (SELECT id FROM "public"."Store" WHERE "merchant_id" = auth.uid()::text OR "managerId" = auth.uid())
            )
        `);

        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Merchant can delete StoreProduct" ON "StoreProduct"`);
        await prisma.$executeRawUnsafe(`
            CREATE POLICY "Merchant can delete StoreProduct" 
            ON "public"."StoreProduct" 
            FOR DELETE 
            USING (
                "storeId" IN (SELECT id FROM "public"."Store" WHERE "merchant_id" = auth.uid()::text)
            )
        `);

        console.log("Successfully applied RLS policies for StoreProduct.");
    } catch (e) {
        console.error("Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
