
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function countOrphans() {
  try {
    const orphans = await prisma.$queryRawUnsafe<{ count: number }[]>(
      'SELECT COUNT(*)::int as count FROM public."StoreProduct" WHERE branch_id IS NULL'
    );
    
    console.log(`Orphaned StoreProduct rows (branch_id IS NULL): ${orphans[0].count}`);
  } catch (error) {
    console.error('Error counting orphans:', error);
  } finally {
    await prisma.$disconnect();
  }
}

countOrphans();
