/**
 * Pre-deploy safety check for Phase 1 Migration #4 (redemption_ledger_fields).
 *
 * Migration #4 adds @@unique([couponId, orderId]) to coupon_redemptions.
 * That constraint will FAIL TO APPLY on production if there are existing rows
 * where the (coupon_id, order_id) pair is duplicated AND order_id IS NOT NULL.
 *
 * This script runs a single read-only GROUP BY query against the production
 * database (via DATABASE_URL) and reports any duplicates. ZERO writes. ZERO
 * mutations. Safe to run at any time.
 *
 * Run with: cd apps/api && npx ts-node-dev --transpile-only scripts/check_coupon_redemption_duplicates.ts
 * or with:  cd apps/api && npx ts-node --transpile-only scripts/check_coupon_redemption_duplicates.ts
 */

import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log('Running read-only duplicate check on coupon_redemptions(coupon_id, order_id)…');
        const duplicates = await prisma.$queryRaw<
            { coupon_id: string; order_id: string; cnt: bigint }[]
        >`
            SELECT coupon_id, order_id, COUNT(*)::bigint AS cnt
            FROM coupon_redemptions
            WHERE order_id IS NOT NULL
            GROUP BY coupon_id, order_id
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 50;
        `;

        const totalRows = await prisma.couponRedemption.count({});
        const totalWithOrder = await prisma.couponRedemption.count({
            where: { orderId: { not: null } },
        });

        console.log('');
        console.log('Total coupon_redemptions rows:               ', totalRows);
        console.log('Rows with non-null order_id:                  ', totalWithOrder);
        console.log('Duplicate (coupon_id, order_id) groups found:', duplicates.length);
        console.log('');

        if (duplicates.length === 0) {
            console.log('✅ ZERO duplicates. Safe to apply Migration #4 (the @@unique constraint).');
            console.log('   Proceed with prisma migrate deploy.');
            process.exit(0);
        } else {
            console.log('⚠️  DUPLICATES FOUND — Migration #4 unique constraint will FAIL to apply.');
            console.log('   First few duplicate groups (up to 50):');
            for (const dup of duplicates) {
                console.log('   coupon=' + dup.coupon_id + '  order=' + dup.order_id + '  count=' + String(dup.cnt));
            }
            console.log('');
            console.log('   Required action: choose ONE row per (coupon_id, order_id) to keep,');
            console.log('   delete the others, then re-run this script to confirm ZERO before deploying.');
            process.exit(2);
        }
    } catch (err: any) {
        console.error('Script failed:', err?.message || err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
