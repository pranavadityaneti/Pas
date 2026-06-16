// Phase 2 FINAL — B2: backfill merchant_branches.store_id.
//
// Linking rule: a branch's parent Store is the one whose id == the branch's
// merchant_id, when such a Store exists. This covers:
//   - the "main branch" UUID-share pattern (Clean cuts: branch.id == Store.id)
//   - additional branches that correctly point merchant_id at the Store.id
//     (Freshly's 3 branches all have merchant_id=9143278d, the Freshly Store id)
//
// Any branch with merchant_id IS NULL (test/orphan rows) keeps store_id NULL.
// B5 adds the FK with NULL allowed; B10 drops the vestigial StoreProduct.storeId.
//
// Reversible: UPDATE merchant_branches SET store_id = NULL WHERE store_id IS NOT NULL;
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Step 1: preview which branches will be updated ---');
  const preview: any[] = await prisma.$queryRawUnsafe(`
    SELECT mb.id::text AS branch_id, mb.branch_name, mb.merchant_id::text AS branch_merchant_id,
           s.id::text AS proposed_store_id, s.name AS proposed_store_name
    FROM public.merchant_branches mb
    JOIN public."Store" s ON s.id::text = mb.merchant_id::text
    WHERE mb.store_id IS NULL
    ORDER BY s.name, mb.branch_name;
  `);
  console.log(`Will update ${preview.length} branches:`);
  console.table(preview);

  if (preview.length === 0) {
    console.log('Nothing to backfill (already done?). Exiting cleanly.');
    return;
  }

  console.log('\n--- Step 2: apply the UPDATE ---');
  const affected = await prisma.$executeRawUnsafe(`
    UPDATE public.merchant_branches mb
    SET store_id = s.id
    FROM public."Store" s
    WHERE s.id::text = mb.merchant_id::text
      AND mb.store_id IS NULL;
  `);
  console.log(`  ✓ ${affected} rows updated`);

  console.log('\n--- Step 3: verify post-state ---');
  const post: any[] = await prisma.$queryRawUnsafe(`
    SELECT mb.id::text AS branch_id, mb.branch_name, mb.merchant_id::text AS branch_merchant_id,
           mb.store_id::text AS store_id, s.name AS store_name
    FROM public.merchant_branches mb
    LEFT JOIN public."Store" s ON s.id = mb.store_id
    WHERE mb.store_id IS NOT NULL
    ORDER BY s.name, mb.branch_name;
  `);
  console.log(`${post.length} branches now have store_id populated:`);
  console.table(post);

  console.log('\n--- Step 4: branches still with NULL store_id (kept by design — no matching Store) ---');
  const nulls: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS null_count FROM public.merchant_branches WHERE store_id IS NULL;
  `);
  console.table(nulls);

  console.log('\n--- Step 5: sanity — every populated store_id matches a real Store ---');
  const dangling: any[] = await prisma.$queryRawUnsafe(`
    SELECT mb.id::text AS branch_id, mb.store_id::text AS store_id
    FROM public.merchant_branches mb
    LEFT JOIN public."Store" s ON s.id = mb.store_id
    WHERE mb.store_id IS NOT NULL AND s.id IS NULL;
  `);
  if (dangling.length === 0) {
    console.log('  ✓ no dangling store_id values — every populated row has a matching Store. B5 FK add will succeed.');
  } else {
    console.error('  ✗ DANGLING values found — DO NOT proceed to B5:');
    console.table(dangling);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
