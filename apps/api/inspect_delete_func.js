const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- INSPECTING FUNCTION: delete_merchants_cascaded ---');
        const func = await prisma.$queryRaw`
            SELECT pg_get_functiondef(p.oid) as def
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'delete_merchants_cascaded';
        `;
        if (func.length > 0) {
            console.log(func[0].def);
        } else {
            console.log('Function not found.');
        }
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
