// Phase 2 FINAL — F5 (apply index) + F4 pre-delete verification (READ-ONLY for
// the deletes). Enumerates every inbound FK to merchant_branches and counts how
// many rows the 21 NULL-store_id branches hold in each — so we know whether
// deleting them is safe (and which deletes would cascade / block).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('========== F5: index merchant_branches.store_id ==========');
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_merchant_branches_store_id ON public.merchant_branches(store_id);`
  );
  const idx: any[] = await prisma.$queryRawUnsafe(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='merchant_branches' AND indexname='idx_merchant_branches_store_id';
  `);
  console.log(idx.length ? '  ✓ index created (or already existed)' : '  ✗ index missing');

  console.log('\n========== F4 PRE-DELETE: the 21 NULL-store_id branches ==========');
  const orphans: any[] = await prisma.$queryRawUnsafe(`
    SELECT id::text AS branch_id, branch_name, (merchant_id IS NULL) AS merchant_null, is_active
    FROM public.merchant_branches WHERE store_id IS NULL ORDER BY branch_name;
  `);
  console.log(`${orphans.length} branches have NULL store_id:`);
  console.table(orphans);

  console.log('\n========== Every FK that references merchant_branches.id ==========');
  const fks: any[] = await prisma.$queryRawUnsafe(`
    SELECT tc.table_name AS referencing_table, kcu.column_name AS referencing_col,
           rc.delete_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.constraint_name
    WHERE ccu.table_name = 'merchant_branches' AND ccu.column_name = 'id';
  `);
  console.table(fks);

  console.log('\n========== Inbound row counts from the 21 NULL-store branches ==========');
  // Build the branch-id list once.
  const ids = orphans.map((o) => `'${o.branch_id}'`).join(',');
  if (!ids) { console.log('No orphan branches — nothing to check.'); return; }

  const checks: Array<{ label: string; sql: string }> = [
    { label: 'StoreProduct.branch_id', sql: `SELECT COUNT(*)::int n FROM "StoreProduct" WHERE branch_id IN (${ids})` },
    { label: 'Order.branch_id (orders)', sql: `SELECT COUNT(*)::int n FROM "Order" WHERE branch_id IN (${ids})` },
    { label: 'orders.branch_id (supabase tbl, if exists)', sql: `SELECT COUNT(*)::int n FROM orders WHERE branch_id::text IN (${ids})` },
    { label: 'TableBooking.branch_id', sql: `SELECT COUNT(*)::int n FROM "TableBooking" WHERE branch_id IN (${ids})` },
    { label: 'store_staff.store_id (=branch in PAS)', sql: `SELECT COUNT(*)::int n FROM store_staff WHERE store_id::text IN (${ids})` },
    { label: 'order_requests.store_id (if branch-keyed)', sql: `SELECT COUNT(*)::int n FROM order_requests WHERE store_id::text IN (${ids})` },
  ];
  for (const c of checks) {
    try {
      const r: any[] = await prisma.$queryRawUnsafe(c.sql);
      console.log(`  ${c.label}: ${r[0].n}`);
    } catch (e: any) {
      console.log(`  ${c.label}: (skipped — ${e?.meta?.message?.split('\n')[0] || e.message})`);
    }
  }

  console.log('\nNOTE: Order.branch_id is NOT NULL with onDelete:SetNull — if any orphan branch has orders, a plain DELETE will FAIL. Counts above tell us.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
