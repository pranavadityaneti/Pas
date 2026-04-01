const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    const branches = await prisma.$queryRaw`
        SELECT * FROM merchant_branches LIMIT 10;
    `;
    console.log("Branches in DB:", JSON.stringify(branches, null, 2));

    const branchesCount = await prisma.merchantBranch.count();
    console.log("Total branches:", branchesCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
