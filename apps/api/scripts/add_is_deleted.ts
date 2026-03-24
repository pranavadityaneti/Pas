import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding is_deleted column to StoreProduct...');
  try {
    // Check if column exists first
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='StoreProduct' AND column_name='is_deleted';
    `);
    
    if (Array.isArray(result) && result.length > 0) {
      console.log('Column is_deleted already exists on StoreProduct.');
    } else {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "StoreProduct" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('Successfully added is_deleted to StoreProduct.');
    }
  } catch (e) {
    console.error('Migration error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
