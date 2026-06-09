/**
 * Check prod state of Migration #3 columns. If Prisma wraps migrations in a tx,
 * none should be present. If it doesn't, some may be.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    const cols = ['order_coupon_id', 'order_coupon_code', 'order_coupon_discount', 'order_coupon_funding_source', 'order_coupon_discount_type'];
    try {
        console.log('Orders table — Migration #3 columns:');
        for (const col of cols) {
            const r = await prisma.$queryRaw<{ exists: boolean }[]>`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='orders' AND column_name=${col}
                ) AS exists;
            `;
            console.log(`  ${r[0]?.exists ? '✓ EXISTS' : '✗ MISSING'}  ${col}`);
        }
        const idx = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname='public' AND indexname='Order_order_coupon_id_idx'
            ) AS exists;
        `;
        console.log(`  ${idx[0]?.exists ? '✓ EXISTS' : '✗ MISSING'}  Order_order_coupon_id_idx (index)`);

        // Check Coupon.id type
        const couponIdType = await prisma.$queryRaw<{ data_type: string }[]>`
            SELECT data_type FROM information_schema.columns
            WHERE table_schema='public' AND table_name='coupons' AND column_name='id';
        `;
        console.log(`\nCoupons.id PostgreSQL type: ${couponIdType[0]?.data_type ?? '(missing)'}`);
    } finally {
        await prisma.$disconnect();
    }
}
main();
