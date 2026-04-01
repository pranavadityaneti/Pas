const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const policies = await prisma.$queryRaw`
        SELECT tablename, policyname, roles, cmd, qual, with_check 
        FROM pg_policies 
        WHERE tablename = 'subscriptions';
    `;
    console.log("Policies for subscriptions:", JSON.stringify(policies, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
