"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function rescueSweep() {
    try {
        const updatedCount = await prisma.$executeRawUnsafe(`UPDATE public."StoreProduct" SET branch_id = "storeId"::text WHERE branch_id IS NULL AND "storeId"::text IN (SELECT id FROM public.merchant_branches)`);
        console.log(`Successfully updated/rescued ${updatedCount} StoreProduct rows.`);
    }
    catch (error) {
        console.error('Error executing rescue sweep:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
rescueSweep();
