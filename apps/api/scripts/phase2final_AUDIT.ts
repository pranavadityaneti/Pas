// Phase 2 FINAL — ADVERSARIAL AUDIT (read-only). Hunt for leaks/bugs in B1-B9.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('========== Q1: CRITICAL — StoreProducts that DO NOT reach a Store ==========');
  // The no-leak invariant: every StoreProduct -> branch -> store_id -> Store.
  const q1: any[] = await prisma.$queryRawUnsafe(`
    SELECT sp.is_deleted, sp.active, COUNT(*)::int AS n
    FROM public."StoreProduct" sp
    JOIN public.merchant_branches mb ON mb.id = sp.branch_id
    LEFT JOIN public."Store" s ON s.id = mb.store_id
    WHERE mb.store_id IS NULL OR s.id IS NULL
    GROUP BY sp.is_deleted, sp.active;
  `);
  console.log('StoreProducts whose branch has NULL store_id OR store_id->no Store (LEAK if >0):');
  console.table(q1.length ? q1 : [{ note: 'ZERO — every StoreProduct reaches a Store' }]);

  console.log('\n========== Q2: full branch picture ==========');
  const q2: any[] = await prisma.$queryRawUnsafe(`
    SELECT mb.id::text AS branch_id, mb.branch_name,
           (mb.merchant_id IS NOT NULL) AS has_merchant_id,
           (mb.store_id IS NOT NULL) AS has_store_id,
           (SELECT COUNT(*)::int FROM public."StoreProduct" sp WHERE sp.branch_id = mb.id) AS sp_count,
           mb.is_active
    FROM public.merchant_branches mb
    ORDER BY has_store_id DESC, sp_count DESC, mb.branch_name;
  `);
  console.table(q2);

  console.log('\n========== Q3: forward leak — NULL-store_id branches that ALREADY have inventory ==========');
  const q3: any[] = await prisma.$queryRawUnsafe(`
    SELECT mb.id::text AS branch_id, mb.branch_name,
           (SELECT COUNT(*)::int FROM public."StoreProduct" sp WHERE sp.branch_id = mb.id) AS sp_count
    FROM public.merchant_branches mb
    WHERE mb.store_id IS NULL
      AND EXISTS (SELECT 1 FROM public."StoreProduct" sp WHERE sp.branch_id = mb.id);
  `);
  console.log(q3.length ? 'REALIZED LEAK — store-less branch with inventory:' : 'none currently');
  console.table(q3.length ? q3 : [{ note: 'none' }]);

  console.log('\n========== Q4: indexes + constraints on StoreProduct (plan B10 + find stale storeId index) ==========');
  const q4: any[] = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname='public' AND tablename='StoreProduct'
    ORDER BY indexname;
  `);
  console.table(q4);
  const q4b: any[] = await prisma.$queryRawUnsafe(`
    SELECT conname, contype, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public."StoreProduct"'::regclass
    ORDER BY conname;
  `);
  console.table(q4b);

  console.log('\n========== Q5: does storeId column have any FK/index/default still attached? ==========');
  const q5: any[] = await prisma.$queryRawUnsafe(`
    SELECT a.attname AS column, a.attnotnull AS not_null,
           pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = 'public."StoreProduct"'::regclass
      AND a.attname IN ('storeId','branch_id') AND a.attnum > 0 AND NOT a.attisdropped;
  `);
  console.table(q5);

  console.log('\n========== Q6: merchant_branches.store_id FK + index ==========');
  const q6: any[] = await prisma.$queryRawUnsafe(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.merchant_branches'::regclass AND contype='f'
    ORDER BY conname;
  `);
  console.table(q6);
  const q6b: any[] = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname='public' AND tablename='merchant_branches' AND indexdef ILIKE '%store_id%';
  `);
  console.log('Index on merchant_branches.store_id (none = unindexed FK, perf note):');
  console.table(q6b.length ? q6b : [{ note: 'NO index on store_id' }]);

  console.log('\n========== Q7: stale storeId values vs the derived store (post-B4) ==========');
  // For rows that still have storeId, does it now MATCH the branch's store_id?
  const q7: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total_with_storeid,
      COUNT(*) FILTER (WHERE sp."storeId" = mb.store_id)::int AS storeid_matches_derived,
      COUNT(*) FILTER (WHERE sp."storeId" IS DISTINCT FROM mb.store_id)::int AS storeid_diverges
    FROM public."StoreProduct" sp
    JOIN public.merchant_branches mb ON mb.id = sp.branch_id
    WHERE sp."storeId" IS NOT NULL;
  `);
  console.table(q7);

  console.log('\n========== Q8: Stores with NO branch (branchless = can hold no inventory in new model) ==========');
  const q8: any[] = await prisma.$queryRawUnsafe(`
    SELECT s.id::text, s.name, s.active,
           (SELECT COUNT(*)::int FROM public.merchant_branches mb WHERE mb.store_id = s.id) AS branch_count
    FROM public."Store" s
    ORDER BY branch_count, s.name;
  `);
  console.table(q8);

  console.log('\n========== Q9: any Store linked by >1 branch with DIFFERENT merchant identity (sanity) ==========');
  const q9: any[] = await prisma.$queryRawUnsafe(`
    SELECT s.id::text AS store_id, s.name, COUNT(mb.id)::int AS branches
    FROM public."Store" s JOIN public.merchant_branches mb ON mb.store_id = s.id
    GROUP BY s.id, s.name HAVING COUNT(mb.id) > 1 ORDER BY branches DESC;
  `);
  console.log('Stores with multiple branches (expected: Freshly=3):');
  console.table(q9);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
