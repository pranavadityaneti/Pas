const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const triggers = await prisma.$queryRaw`
        SELECT event_object_table AS table_name ,trigger_name, action_statement
        FROM information_schema.triggers
        WHERE event_object_table IN ('merchants', 'profiles', 'users');
    `;
    console.log("Triggers:", JSON.stringify(triggers, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
