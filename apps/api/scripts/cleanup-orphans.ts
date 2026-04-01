import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupOrphans() {
    console.log('--- Starting Hardened Orphan Cleanup ---');

    // Use raw query to handle text/uuid mismatch (Mandate 2)
    // Find orders where the user_id (UUID) does not exist in User.id (TEXT)
    const orphanOrders = await prisma.$queryRaw<any[]>`
        SELECT id, order_number, user_id::text as user_id_str, store_id 
        FROM orders 
        WHERE (user_id::text NOT IN (SELECT id FROM "User"))
           OR (store_id NOT IN (SELECT id FROM "Store"));
    `;

    console.log(`Found ${orphanOrders.length} potential orphan orders.`);

    for (const order of orphanOrders) {
        console.warn(`[AUDIT_VIOLATION] Order ${order.order_number} (${order.id}) is orphaned. Cancelling.`);
        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' }
        });
    }

    console.log('--- Orphan Cleanup Completed ---');
}

cleanupOrphans()
    .catch((e) => {
        console.error('Cleanup failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
