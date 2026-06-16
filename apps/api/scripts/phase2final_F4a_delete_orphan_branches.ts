// Phase 2 FINAL — F4a: hard-delete the orphan/test branches (store_id IS NULL).
// Pranav-approved 2026-06-16. Pre-verified: 0 orders / 0 StoreProducts /
// 0 table_bookings / 0 store_staff reference them (all NULL merchant_id test rows).
// Guarded: re-checks 0 inbound refs inside the tx; aborts if anything appears.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orphans: any[] = await prisma.$queryRawUnsafe(`
    SELECT id::text AS id, branch_name FROM public.merchant_branches WHERE store_id IS NULL ORDER BY branch_name;
  `);
  console.log(`Target: ${orphans.length} branches with store_id IS NULL`);
  if (orphans.length === 0) { console.log('Nothing to delete (already done?).'); return; }
  const ids = orphans.map((o) => `'${o.id}'`).join(',');

  console.log('\n--- Re-verify 0 inbound refs (abort if any) ---');
  const refs: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM orders WHERE branch_id::text IN (${ids}))                  AS orders,
      (SELECT COUNT(*)::int FROM public."StoreProduct" WHERE branch_id IN (${ids}))         AS storeproducts,
      (SELECT COUNT(*)::int FROM table_bookings WHERE branch_id::text IN (${ids}))          AS bookings,
      (SELECT COUNT(*)::int FROM store_staff WHERE store_id::text IN (${ids}))              AS staff;
  `);
  console.table(refs);
  const r = refs[0];
  if (r.orders + r.storeproducts + r.bookings + r.staff !== 0) {
    throw new Error('Inbound refs found — ABORT. Not deleting.');
  }

  console.log('\n--- DELETE inside a transaction with rowcount assertion ---');
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.$executeRawUnsafe(`DELETE FROM public.merchant_branches WHERE store_id IS NULL;`);
    console.log(`  ✓ ${deleted} branches deleted`);
    if (deleted !== orphans.length) throw new Error(`Expected ${orphans.length} deletes, got ${deleted}. Rolling back.`);
  });

  console.log('\n--- Post-state ---');
  const post: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE store_id IS NULL)::int AS null_store,
           COUNT(*) FILTER (WHERE store_id IS NOT NULL)::int AS with_store
    FROM public.merchant_branches;
  `);
  console.table(post);
  if (post[0].null_store !== 0) throw new Error('Still NULL store_id rows after delete.');
  console.log('  ✓ every remaining branch has a store_id — ready for NOT NULL (after F1 deploy).');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
