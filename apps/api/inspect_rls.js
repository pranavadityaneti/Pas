const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        // Check ALL policies including SELECT
        console.log('--- ALL POLICIES ON order_requests (raw) ---');
        const policies = await prisma.$queryRaw`
            SELECT policyname, permissive, roles, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename = 'order_requests'
            ORDER BY cmd;
        `;
        policies.forEach(p => {
            console.log(`\n[${p.cmd}] ${p.policyname}`);
            console.log(`  roles: ${JSON.stringify(p.roles)}`);
            console.log(`  qual (WHERE): ${p.qual || 'none'}`);
            console.log(`  with_check: ${p.with_check || 'none'}`);
        });

        // Check grants
        console.log('\n--- TABLE GRANTS ON order_requests ---');
        const grants = await prisma.$queryRaw`
            SELECT grantee, privilege_type
            FROM information_schema.table_privileges
            WHERE table_name = 'order_requests'
            ORDER BY grantee, privilege_type;
        `;
        console.table(grants);

    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
