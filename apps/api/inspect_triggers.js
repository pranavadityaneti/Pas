const { PrismaClient } = require('@prisma/client');

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

        console.log('--- CHECKING TRIGGERS FOR: auth.users ---');
        // Note: This might fail if we don't have access to auth schema or if it's not exposed to Prisma
        try {
            const authTriggers = await prisma.$queryRaw`
                SELECT event_object_table, trigger_name, action_statement 
                FROM information_schema.triggers 
                WHERE event_object_table = 'users' AND event_object_schema = 'auth';
            `;
            console.table(authTriggers);
        } catch (e) {
            console.log("Could not access auth schema triggers (expected)");
        }

    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
