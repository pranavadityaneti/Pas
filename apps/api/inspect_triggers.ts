import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- CHECKING TRIGGERS FOR: merchants ---');
        const triggers = await prisma.$queryRaw`
            SELECT event_object_table, trigger_name, action_statement 
            FROM information_schema.triggers 
            WHERE event_object_table = 'merchants';
        `;
        console.table(triggers);
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
