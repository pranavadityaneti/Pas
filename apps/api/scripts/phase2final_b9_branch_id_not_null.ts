// Phase 2 FINAL — B9: make StoreProduct.branch_id NOT NULL.
//
// Why safe: after B3 (deleted the 4 NULL-branch mystery rows) every StoreProduct
// row has a branch_id. Every write path sets branch_id — both API endpoints
// (POST /merchant/products/save, POST /merchant/store-products/configure) and
// there are NO direct client writes (all merchant writes route through the API).
// So no shipped client can insert a NULL-branch_id row.
//
// Reversible: ALTER TABLE "StoreProduct" ALTER COLUMN branch_id DROP NOT NULL;
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Step 1: PRE-FLIGHT — count NULL branch_id rows (must be 0) ---');
  const nulls: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS null_branch FROM public."StoreProduct" WHERE branch_id IS NULL;
  `);
  console.table(nulls);
  if (nulls[0].null_branch !== 0) {
    console.error(`ABORT: ${nulls[0].null_branch} rows still have NULL branch_id. Cannot set NOT NULL.`);
    process.exit(1);
  }

  console.log('\n--- Step 2: current nullability ---');
  const pre: any[] = await prisma.$queryRawUnsafe(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='StoreProduct' AND column_name='branch_id';
  `);
  console.table(pre);
  if (pre[0]?.is_nullable === 'NO') {
    console.log('  ! already NOT NULL — nothing to do.');
    return;
  }

  console.log('\n--- Step 3: ALTER COLUMN SET NOT NULL ---');
  await prisma.$executeRawUnsafe(
    `ALTER TABLE public."StoreProduct" ALTER COLUMN branch_id SET NOT NULL;`
  );
  console.log('  ✓ branch_id is now NOT NULL');

  console.log('\n--- Step 4: verify ---');
  const post: any[] = await prisma.$queryRawUnsafe(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='StoreProduct' AND column_name='branch_id';
  `);
  console.table(post);
  if (post[0]?.is_nullable !== 'NO') throw new Error('Column did not become NOT NULL.');

  const total: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total FROM public."StoreProduct";`);
  console.log(`  ✓ confirmed NOT NULL; ${total[0].total} rows intact`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
