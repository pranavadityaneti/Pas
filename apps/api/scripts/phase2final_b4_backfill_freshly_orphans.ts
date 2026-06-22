// Phase 2 FINAL — B4: repair the 22 Freshly StoreProduct orphans.
//
// Today these rows have storeId == branch_id (both pointing at the Freshly
// Vadapalli or Ravulapalem branch). Fix: set storeId to the parent Freshly
// Store id (9143278d-…). branch_id stays unchanged — it correctly identifies
// which branch the inventory belongs to. After B4, all 40 StoreProducts have
// a valid Store reference, making B5 (add the missing FK) safe.
//
// Reversible: UPDATE "StoreProduct" SET "storeId" = branch_id::uuid
//             WHERE branch_id::text IN ('c20b9f8f-…','2f25e818-…');
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FRESHLY_VADAPALLI = 'c20b9f8f-4b98-419d-b7aa-01dac3d4c40e';
const FRESHLY_RAVULAPALEM = '2f25e818-7aff-45c2-baca-31a6322232c4';
const FRESHLY_STORE = '9143278d-444e-4ee9-b836-f31d5de62e41';

async function main() {
  console.log('--- Step 1: confirm Freshly Store still exists at the target id ---');
  const store: any[] = await prisma.$queryRawUnsafe(`
    SELECT id::text, name, active FROM public."Store" WHERE id::text = '${FRESHLY_STORE}';
  `);
  console.table(store);
  if (store.length !== 1) throw new Error(`Freshly Store ${FRESHLY_STORE} not found. Aborting.`);

  console.log('\n--- Step 2: preview the rows that will be updated ---');
  const preview: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.id, sp."storeId"::text AS storeid, sp.branch_id, p.name, sp.active, sp.is_deleted
    FROM public."StoreProduct" sp
    JOIN public."Product" p ON p.id = sp."productId"
    WHERE sp."storeId"::text IN ('${FRESHLY_VADAPALLI}','${FRESHLY_RAVULAPALEM}')
    ORDER BY sp.branch_id, p.name;
  `);
  console.log(`${preview.length} rows will be updated:`);
  console.table(preview);
  if (preview.length !== 22) throw new Error(`Expected 22 rows, got ${preview.length}. Aborting.`);
  for (const r of preview) {
    if (r.storeid !== r.branch_id) throw new Error(`Row ${r.id} has storeid != branch_id (${r.storeid} vs ${r.branch_id}). Aborting — pattern broken.`);
  }
  console.log('  ✓ all 22 rows match the pattern (storeId == branch_id, branch_id is a Freshly branch)');

  console.log('\n--- Step 3: UPDATE inside a transaction with rowcount=22 check ---');
  await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRawUnsafe(`
      UPDATE public."StoreProduct"
      SET "storeId" = '${FRESHLY_STORE}'
      WHERE "storeId"::text IN ('${FRESHLY_VADAPALLI}','${FRESHLY_RAVULAPALEM}');
    `);
    console.log(`  ✓ ${updated} rows updated`);
    if (updated !== 22) throw new Error(`Expected 22 updates, got ${updated}. Rolling back.`);
  });

  console.log('\n--- Step 4: verify zero orphans remain ---');
  const orphans: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.id, sp."storeId"::text AS storeid, sp.branch_id
    FROM public."StoreProduct" sp
    LEFT JOIN public."Store" s ON s.id::text = sp."storeId"::text
    WHERE s.id IS NULL;
  `);
  console.log(`Orphans remaining: ${orphans.length} (expected 0)`);
  if (orphans.length !== 0) {
    console.table(orphans);
    throw new Error('Orphans still present after B4. B5 FK add would fail.');
  }
  console.log('  ✓ every StoreProduct.storeId now matches a real Store — B5 FK add will succeed');

  console.log('\n--- Step 5: final shape per Store ---');
  const shape: any[] = await prisma.$queryRawUnsafe(`
    SELECT s.id::text, s.name, s.active::text,
           (SELECT COUNT(*)::int FROM public."StoreProduct" sp WHERE sp."storeId" = s.id) AS sp_total,
           (SELECT COUNT(*)::int FROM public."StoreProduct" sp WHERE sp."storeId" = s.id AND sp.active = true AND sp.is_deleted = false) AS sp_active_live
    FROM public."Store" s
    ORDER BY s.name;
  `);
  console.table(shape);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
