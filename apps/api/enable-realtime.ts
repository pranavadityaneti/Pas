import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Adding orders table to supabase_realtime publication...");
        await prisma.$executeRawUnsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE orders;`);
        console.log("Successfully added orders to realtime!");
        
        console.log("Adding order_requests table as well just in case...");
        await prisma.$executeRawUnsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE order_requests;`);
        console.log("Done.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
