
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrphans() {
  try {
    const orphans = await prisma.$queryRaw`
      SELECT DISTINCT "storeId"::text as "storeId"
      FROM public."StoreProduct" 
      WHERE branch_id IS NULL
    `;
    console.log('Orphan Store IDs:', JSON.stringify(orphans, null, 2));

    const branches = await prisma.$queryRaw`
      SELECT id FROM public.merchant_branches
    `;
    console.log('Branch IDs:', JSON.stringify(branches, null, 2));
  } catch (error) {
    console.error('Error checking orphans:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrphans();
