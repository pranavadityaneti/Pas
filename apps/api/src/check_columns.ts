
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkColumns() {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'StoreProduct' AND table_schema = 'public'
    `;
    console.log(JSON.stringify(columns, null, 2));
  } catch (error) {
    console.error('Error checking columns:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
