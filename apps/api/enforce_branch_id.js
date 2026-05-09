
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Backfilling legacy orders to set branch_id = store_id where missing...');
  try {
    await prisma.$executeRaw`UPDATE public.orders SET branch_id = store_id WHERE branch_id IS NULL`;
    console.log('Backfill complete.');

    console.log('Enforcing NOT NULL constraint on branch_id...');
    await prisma.$executeRaw`ALTER TABLE public.orders ALTER COLUMN branch_id SET NOT NULL`;
    console.log('Database constraint updated successfully.');
  } catch (err) {
    console.error('Failed to update schema:', err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
