require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Fetching latest order to test Prisma findUnique...");
        const orders = await prisma.$queryRaw`SELECT id FROM "public"."orders" ORDER BY created_at DESC LIMIT 1;`;
        
        if (orders.length === 0) {
            console.log("No orders found.");
            return;
        }

        const id = orders[0].id;
        console.log(`Found Order ID: ${id}. Attempting Prisma findUnique...`);

        const currentOrder = await prisma.order.findUnique({
            where: { id },
            include: { 
                user: true, 
                orderItems: { include: { storeProduct: { include: { product: true } } } }, 
                store: { include: { manager: true } } 
            }
        });

        console.log("FindUnique Result:", !!currentOrder);
        
        console.log("Attempting Prisma Update...");
        const updated = await prisma.order.update({
            where: { id },
            data: { status: 'CONFIRMED' },
            include: { user: true, items: { include: { storeProduct: { include: { product: true } } } }, store: { include: { manager: true } } }
        });
        
        console.log("Update Result:", updated.status);

    } catch (e) {
        console.error("PRISMA ERROR:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
