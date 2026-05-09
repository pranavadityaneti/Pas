
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding prep_time_minutes and operating_hours to merchant_branches...');
  
  try {
    await prisma.$executeRaw`ALTER TABLE public.merchant_branches ADD COLUMN IF NOT EXISTS operating_hours jsonb`;
    console.log('Added operating_hours column.');
  } catch (err) {
    console.log('operating_hours may already exist:', err.message);
  }

  try {
    await prisma.$executeRaw`ALTER TABLE public.merchant_branches ADD COLUMN IF NOT EXISTS prep_time_minutes integer NOT NULL DEFAULT 15`;
    console.log('Added prep_time_minutes column.');
  } catch (err) {
    console.log('prep_time_minutes may already exist:', err.message);
  }

  console.log('Database schema update complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
