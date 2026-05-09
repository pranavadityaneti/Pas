"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    try {
        const verticals = await prisma.vertical.findMany({
            include: { categories: true },
            orderBy: { name: 'asc' }
        });
        console.log('---START_VERTICAL_DATA---');
        console.log(JSON.stringify(verticals, null, 2));
        console.log('---END_VERTICAL_DATA---');
    }
    catch (error) {
        console.error('Query error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
