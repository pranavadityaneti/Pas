"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function countOrphans() {
    try {
        const orphans = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int as count FROM public."StoreProduct" WHERE branch_id IS NULL');
        console.log(`Orphaned StoreProduct rows (branch_id IS NULL): ${orphans[0].count}`);
    }
    catch (error) {
        console.error('Error counting orphans:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
countOrphans();
