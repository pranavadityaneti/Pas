const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const fn = await prisma.$queryRaw`
        SELECT pg_get_functiondef(oid) 
        FROM pg_proc 
        WHERE proname = 'sync_merchant_data_robust';
    `;
    console.log("Function:", JSON.stringify(fn, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
