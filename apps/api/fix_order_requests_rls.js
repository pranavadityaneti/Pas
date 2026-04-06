const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log('Adding SELECT policy to order_requests...');
        await prisma.$executeRaw`
            CREATE POLICY "Users can read their own requests"
            ON public.order_requests
            FOR SELECT
            USING (auth.uid() = consumer_user_id);
        `;
        console.log('✅ SELECT policy created successfully.');

        // Verify
        const policies = await prisma.$queryRaw`
            SELECT policyname, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename = 'order_requests'
            ORDER BY cmd;
        `;
        console.log('\n--- Updated Policies ---');
        policies.forEach(p => {
            console.log(`[${p.cmd}] ${p.policyname} | WHERE: ${p.qual || 'none'} | CHECK: ${p.with_check || 'none'}`);
        });
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
