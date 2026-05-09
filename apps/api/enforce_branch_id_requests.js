
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding branch_id to order_requests and backfilling...');
  try {
    await prisma.$executeRaw`ALTER TABLE public.order_requests ADD COLUMN IF NOT EXISTS branch_id TEXT;`;
    await prisma.$executeRaw`UPDATE public.order_requests SET branch_id = store_id WHERE branch_id IS NULL;`;
    await prisma.$executeRaw`ALTER TABLE public.order_requests ALTER COLUMN branch_id SET NOT NULL;`;
    console.log('Database constraint for order_requests updated successfully.');
  } catch (err) {
    console.error('Failed to update schema:', err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
