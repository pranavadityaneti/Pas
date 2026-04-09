const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const subcats = await prisma.$queryRaw`
            SELECT t2.id, t2.name, v.name as vertical_name
            FROM "Tier2Category" t2
            JOIN "Vertical" v ON t2.vertical_id = v.id
            WHERE v.name IN ('Grocery & Kirana', 'Pharmacy & Wellness')
            AND t2.active = true;
        `;
        
        console.log(JSON.stringify(subcats, null, 2));
    } catch (error) {
        console.error('Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
