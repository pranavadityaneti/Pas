const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    const policies = await prisma.$queryRaw`
        SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
        FROM pg_policies 
        WHERE tablename = 'merchant_branches';
    `;
    console.log("Policies for merchant_branches:", JSON.stringify(policies, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
