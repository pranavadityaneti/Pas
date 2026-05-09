const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const result = await prisma.$executeRawUnsafe(`
      UPDATE public."StoreProduct" 
      SET branch_id = "storeId"::text 
      WHERE branch_id IS NULL 
      AND "storeId"::text IN (SELECT id FROM public.merchant_branches);
    `);
    console.log('[SUCCESS] Rescued rows:', result);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
