
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyBranches() {
    console.log('Starting Branch Verification via Prisma...');

    try {
        // 1. Get a test merchant
        const testMerchant = await prisma.merchant.findFirst();

        if (!testMerchant) {
            console.error('No merchants found to test with.');
            return;
        }
        console.log(`Testing with merchant: ${testMerchant.id}`);

        const branchName = 'Prisma Verify Branch';
        const address = '456 Prisma Way';

        // 2. Insert
        const insertCount = await prisma.$executeRaw`
            INSERT INTO "merchant_branches" (id, merchant_id, branch_name, address, is_active)
            VALUES (gen_random_uuid(), ${testMerchant.id}, ${branchName}, ${address}, true)
        `;

        console.log(`✅ Inserted ${insertCount} branch(es).`);

        // 3. Select
        // Note: merchant_id is text, testMerchant.id is string (uuid format). Postgres handles string -> text fine.
        const branches: any[] = await prisma.$queryRaw`
            SELECT * FROM "merchant_branches" WHERE merchant_id = ${testMerchant.id} AND branch_name = ${branchName}
        `;

        if (branches.length > 0) {
            console.log('✅ Select Successful:', branches[0]);

            // 4. Delete
            // Removed ::uuid cast to avoid "text = uuid" type error if id column is text
            // If id is text, passing a string works.
            const deleteCount = await prisma.$executeRaw`
                DELETE FROM "merchant_branches" WHERE id = ${branches[0].id}
            `;
            console.log(`✅ Deleted ${deleteCount} branch(es).`);

        } else {
            console.error('❌ Select Failed: Branch not found.');
        }

    } catch (e) {
        console.error('Verification Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

verifyBranches();
