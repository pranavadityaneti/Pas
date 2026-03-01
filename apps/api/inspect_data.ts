
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectEx() {
    console.log('--- Stores ---');
    const stores = await prisma.store.findMany({
        include: { manager: true, _count: { select: { orders: true } } }
    });
    console.table(stores.map(s => ({
        id: s.id,
        name: s.name,
        managerBase: s.manager?.email,
        ordersCount: s._count.orders
    })));

    console.log('\n--- Recent Orders ---');
    const orders = await prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { store: { select: { name: true } } }
    });
    console.table(orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        store: o.store?.name,
        status: o.status,
        createdAt: o.createdAt
    })));
}

inspectEx()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
