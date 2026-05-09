const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('[RESCUE] Identifying orphaned inventory...');

    // 1. Count orphans using raw SQL
    const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM public."StoreProduct" WHERE branch_id IS NULL`);
    const orphans = countResult[0].count ? Number(countResult[0].count) : 0;
    
    console.log(`Orphan count before sweep: ${orphans}`);

    if (orphans > 0) {
      console.log('Executing SQL sweep...');
      // 2. Execute Rescue Sweep
      const updatedRowsResult = await prisma.$executeRawUnsafe(
        `UPDATE public."StoreProduct" SET branch_id = "storeId"::text WHERE branch_id IS NULL AND "storeId"::text IN (SELECT id::text FROM public.merchant_branches);`
      );
      
      console.log(`[SUCCESS] Rescued rows: ${updatedRowsResult}`);

      // Count orphans after sweep
      const remainingResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM public."StoreProduct" WHERE branch_id IS NULL`);
      const orphansRemaining = remainingResult[0].count ? Number(remainingResult[0].count) : 0;
      console.log(`Orphan count remaining: ${orphansRemaining}`);
    } else {
      console.log('No orphans found to rescue.');
    }

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
