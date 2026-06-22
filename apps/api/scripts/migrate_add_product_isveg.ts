// Phase 4: additive Product.is_veg column (nullable tri-state). Reversible:
// ALTER TABLE "Product" DROP COLUMN is_veg;
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE public."Product" ADD COLUMN IF NOT EXISTS is_veg boolean;`
  );
  const col: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Product' AND column_name='is_veg';
  `);
  console.table(col);
  if (col[0]?.is_nullable !== 'YES') throw new Error('is_veg not added as nullable');
  console.log('  ✓ Product.is_veg added (nullable)');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
