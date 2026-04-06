const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- RLS & POLICIES ON merchant_branches ---');
        const rlsStatus = await prisma.$queryRaw`
            SELECT relname, relrowsecurity
            FROM pg_class
            WHERE relname = 'merchant_branches';
        `;
        console.table(rlsStatus);

        const policies = await prisma.$queryRaw`
            SELECT policyname, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename = 'merchant_branches'
            ORDER BY cmd;
        `;
        if (policies.length === 0) {
            console.log('No policies found.');
        } else {
            console.table(policies);
        }

        const grants = await prisma.$queryRaw`
            SELECT grantee, privilege_type
            FROM information_schema.table_privileges
            WHERE table_name = 'merchant_branches'
            AND grantee IN ('authenticated', 'anon')
            ORDER BY grantee, privilege_type;
        `;
        console.log('\nGrants:');
        console.table(grants);
    } catch (error) {
        console.error('Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
