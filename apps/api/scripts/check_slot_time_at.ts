/**
 * One-off read-only check: confirm orders.slot_time_at AND order_requests.slot_time_at
 * columns both exist on prod. Used to confirm safety of marking
 * 20260528100000_add_slot_time_at as applied.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const a = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='orders' AND column_name='slot_time_at'
            ) AS exists;
        `;
        const b = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='order_requests' AND column_name='slot_time_at'
            ) AS exists;
        `;
        console.log('orders.slot_time_at:        ', a[0]?.exists ? '✓ EXISTS' : '✗ MISSING');
        console.log('order_requests.slot_time_at:', b[0]?.exists ? '✓ EXISTS' : '✗ MISSING');
        if (a[0]?.exists && b[0]?.exists) {
            console.log('\n✅ Both columns present. Safe to mark 20260528100000_add_slot_time_at as applied.');
            process.exit(0);
        } else {
            console.log('\n⚠️  Drift — at least one column missing. Cannot mark as applied.');
            process.exit(2);
        }
    } finally {
        await prisma.$disconnect();
    }
}
main();
