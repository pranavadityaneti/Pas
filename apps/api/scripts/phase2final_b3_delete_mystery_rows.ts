// Phase 2 FINAL — B3: hard-delete the 4 mystery StoreProduct rows.
//
// These rows have storeId = 5bc7891d-449b-4bea-9756-6890b6232c52 (not a Store,
// not a branch, not a merchant) and branch_id IS NULL. Zero order_items
// history. Approved for hard delete by Pranav 2026-06-16.
//
// The 4 ids are listed explicitly (defense-in-depth: even if data shifted,
// this script can only ever touch these 4 rows).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGETS = [
  { id: 'cf725493-c059-4f16-b2ac-91754175c58a', name: 'Broccoli' },
  { id: '9133dfa7-d030-4aa3-b5ef-738ea6adcb5c', name: 'Grapes Green Sonaka Seedless' },
  { id: 'd145584b-0368-4c89-ae8b-d77852685bde', name: 'Gooseberry (Amla)' },
  { id: 'eb4f575b-2589-4af8-8452-e1252f55a927', name: 'Papaya Cut' },
] as const;

const TARGET_STOREID = '5bc7891d-449b-4bea-9756-6890b6232c52';

async function main() {
  const ids = TARGETS.map(t => t.id);

  console.log('--- Step 1: re-confirm the 4 rows still match the mystery profile ---');
  const pre: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.id, sp."storeId"::text AS storeid, sp.branch_id, sp."productId", p.name
    FROM public."StoreProduct" sp
    JOIN public."Product" p ON p.id = sp."productId"
    WHERE sp.id IN (${ids.map(i => `'${i}'`).join(',')});
  `);
  console.table(pre);
  if (pre.length !== 4) throw new Error(`Expected 4 rows, found ${pre.length}. Aborting.`);
  for (const row of pre) {
    if (row.storeid !== TARGET_STOREID) throw new Error(`Row ${row.id} no longer points at mystery storeId. Aborting.`);
    if (row.branch_id !== null) throw new Error(`Row ${row.id} now has branch_id=${row.branch_id}. Aborting.`);
  }
  console.log('  ✓ all 4 rows still match the mystery profile (storeId=5bc7891d…, branch_id=NULL)');

  console.log('\n--- Step 2: re-confirm zero order_items reference these rows ---');
  const refs: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS n
    FROM public.order_items
    WHERE store_product_id IN (${ids.map(i => `'${i}'`).join(',')});
  `);
  console.table(refs);
  if (refs[0].n !== 0) throw new Error(`order_items references found (${refs[0].n}). Aborting hard delete.`);
  console.log('  ✓ 0 order_items reference the targets — safe to hard delete');

  console.log('\n--- Step 3: DELETE inside a transaction with rowcount check ---');
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.$executeRawUnsafe(`
      DELETE FROM public."StoreProduct"
      WHERE id IN (${ids.map(i => `'${i}'`).join(',')})
        AND "storeId"::text = '${TARGET_STOREID}'
        AND branch_id IS NULL;
    `);
    console.log(`  ✓ ${deleted} rows deleted`);
    if (deleted !== 4) throw new Error(`Expected 4 deletes, got ${deleted}. Rolling back.`);
  });

  console.log('\n--- Step 4: verify post-state ---');
  const post: any[] = await prisma.$queryRawUnsafe(`
    SELECT id FROM public."StoreProduct" WHERE id IN (${ids.map(i => `'${i}'`).join(',')});
  `);
  console.log(`${post.length} of the 4 targets remain (expected 0)`);
  if (post.length !== 0) throw new Error('Post-delete check failed.');

  const counts: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM public."StoreProduct")                                AS total,
      (SELECT COUNT(*) FROM public."StoreProduct" WHERE branch_id IS NULL)        AS null_branch,
      (SELECT COUNT(*) FROM public."StoreProduct" sp LEFT JOIN public."Store" s ON s.id::text = sp."storeId"::text WHERE s.id IS NULL) AS still_orphaned;
  `);
  console.table(counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
