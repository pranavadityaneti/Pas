const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting Manual DB Patch...');

    try {
        // --- 1. Product Table (Fixes Master Catalog) ---
        console.log('Patching Product table...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitType" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitValue" DOUBLE PRECISION;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "hsnCode" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "gstRate" DOUBLE PRECISION;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "createdByStoreId" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ean" TEXT;`);

        // --- 2. Order Table (Fixes Auto-Reject & New Order) ---
        console.log('Patching Order table...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "user_id" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "order_number" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "store_id" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "staff_id" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "total_amount" DOUBLE PRECISION;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ispaid" BOOLEAN DEFAULT false;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "otp" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelled_reason" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "metadata" JSONB;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);

        // --- 3. Notification Table (Fixes Notifications) ---
        console.log('Creating Notification table...');
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "notifications" (
                "id" TEXT NOT NULL,
                "user_id" TEXT NOT NULL,
                "type" TEXT NOT NULL,
                "title" TEXT NOT NULL,
                "message" TEXT NOT NULL,
                "is_read" BOOLEAN NOT NULL DEFAULT false,
                "link" TEXT,
                "metadata" JSONB,
                "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
            );
        `);

        console.log('✅ DB Patch Completed Successfully!');

    } catch (error) {
        console.error('❌ DB Patch Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
