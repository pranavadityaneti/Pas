// Phase 2 FINAL — B6.0: prerequisite for the write-site removals.
//
// ALTER TABLE "StoreProduct" ALTER COLUMN "storeId" DROP NOT NULL.
//
// Why: the next code edits (B6.2/B6.3) stop writing storeId on INSERT/UPSERT.
// While the column still EXISTS (we drop it at B10), every new row from the
// updated code path will have storeId IS NULL. So the column must accept NULL.
// Existing rows are unaffected (they all have a valid storeId post B4).
//
// Reversible: ALTER TABLE "StoreProduct" ALTER COLUMN "storeId" SET NOT NULL;
//             (only safe to re-apply if every row still has a value — which is
//             true right now and will remain true until B6.2/B6.3 deploy.)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Step 1: pre-state — current nullability + non-null row count ---');
  const pre: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='StoreProduct' AND column_name='storeId';
  `);
  console.table(pre);
  const rowcount: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total, COUNT("storeId")::int AS non_null_storeid FROM public."StoreProduct";
  `);
  console.table(rowcount);

  if (pre[0]?.is_nullable === 'YES') {
    console.log('  ! already nullable — nothing to do.');
    return;
  }

  console.log('\n--- Step 2: ALTER COLUMN DROP NOT NULL ---');
  await prisma.$executeRawUnsafe(
    `ALTER TABLE public."StoreProduct" ALTER COLUMN "storeId" DROP NOT NULL;`
  );
  console.log('  ✓ column is now nullable');

  console.log('\n--- Step 3: verify post-state ---');
  const post: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='StoreProduct' AND column_name='storeId';
  `);
  console.table(post);
  if (post[0]?.is_nullable !== 'YES') throw new Error('Column did not become nullable.');
  console.log('  ✓ confirmed nullable');

  console.log('\n--- Step 4: existing rows unaffected ---');
  const rowcount2: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total, COUNT("storeId")::int AS non_null_storeid FROM public."StoreProduct";
  `);
  console.table(rowcount2);
  if (rowcount2[0].total !== rowcount[0].total || rowcount2[0].non_null_storeid !== rowcount[0].non_null_storeid) {
    throw new Error('Row counts changed during ALTER — unexpected.');
  }
  console.log('  ✓ row counts unchanged');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
