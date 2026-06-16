// Phase 2 FINAL — B5: add the merchant_branches.store_id → Store(id) foreign key.
//
// Pre-state (verified at B2): 5 rows populated with valid Store ids, 21 NULL.
// FK definition (matches the Prisma schema declared at B1):
//   ON DELETE NO ACTION  — Stores can't be deleted while branches reference them
//   ON UPDATE NO ACTION  — Store.id is immutable in practice; explicit anyway
//
// Reversible: ALTER TABLE merchant_branches DROP CONSTRAINT fk_merchant_branches_store;
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONSTRAINT_NAME = 'fk_merchant_branches_store';

async function main() {
  console.log('--- Step 1: PRE-FLIGHT — re-verify zero dangling values ---');
  const dangling: any[] = await prisma.$queryRawUnsafe(`
    SELECT mb.id::text AS branch_id, mb.store_id::text AS store_id
    FROM public.merchant_branches mb
    LEFT JOIN public."Store" s ON s.id = mb.store_id
    WHERE mb.store_id IS NOT NULL AND s.id IS NULL;
  `);
  if (dangling.length > 0) {
    console.error('ABORT: dangling store_id values found — FK would fail.');
    console.table(dangling);
    process.exit(1);
  }
  console.log('  ✓ 0 dangling values');

  console.log('\n--- Step 2: PRE-FLIGHT — confirm constraint does not already exist ---');
  const exists: any[] = await prisma.$queryRawUnsafe(`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='merchant_branches'
      AND constraint_name='${CONSTRAINT_NAME}' AND constraint_type='FOREIGN KEY';
  `);
  if (exists.length > 0) {
    console.log(`  ! constraint ${CONSTRAINT_NAME} already exists — nothing to do.`);
    return;
  }
  console.log('  ✓ constraint not present yet');

  console.log('\n--- Step 3: ADD CONSTRAINT ---');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.merchant_branches
      ADD CONSTRAINT ${CONSTRAINT_NAME}
      FOREIGN KEY (store_id) REFERENCES public."Store"(id)
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  `);
  console.log('  ✓ constraint added');

  console.log('\n--- Step 4: VERIFY constraint registered ---');
  const reg: any[] = await prisma.$queryRawUnsafe(`
    SELECT tc.constraint_name, kcu.column_name,
           ccu.table_name AS ref_table, ccu.column_name AS ref_column,
           rc.delete_rule, rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_schema='public' AND tc.table_name='merchant_branches'
      AND tc.constraint_name='${CONSTRAINT_NAME}';
  `);
  console.table(reg);
  if (reg.length !== 1) throw new Error('Constraint missing from information_schema after ADD.');

  console.log('\n--- Step 5: NEGATIVE TEST — fake UUID must be rejected (in a rolled-back tx) ---');
  let negativeRejected = false;
  try {
    await prisma.$transaction(async (tx) => {
      // Find a real branch row to test on
      const target: any[] = await tx.$queryRawUnsafe(`
        SELECT id::text AS id, store_id::text AS store_id
        FROM public.merchant_branches
        WHERE store_id IS NOT NULL
        LIMIT 1;
      `);
      if (target.length === 0) throw new Error('No populated branch to test against.');
      console.log(`    testing UPDATE on branch ${target[0].id} (current store_id=${target[0].store_id})`);
      // This should throw a FK violation
      await tx.$executeRawUnsafe(`
        UPDATE public.merchant_branches
        SET store_id = '00000000-0000-0000-0000-000000000000'::uuid
        WHERE id = '${target[0].id}';
      `);
      // If we get here the FK didn't fire — force rollback + flag
      throw new Error('FK did not reject the fake store_id — constraint is not effective!');
    });
  } catch (err: any) {
    if (err?.message?.includes('FK did not reject')) {
      console.error('  ✗ NEGATIVE TEST FAILED:', err.message);
      throw err;
    }
    // Any other error (FK violation) is the expected outcome
    if (err?.meta?.message?.includes('violates foreign key') || /foreign key|fk_merchant_branches_store/i.test(err?.meta?.message || err?.message || '')) {
      negativeRejected = true;
      console.log(`  ✓ DB rejected the fake store_id (constraint working). Pg msg: ${err?.meta?.message?.split('\n')[0] || err?.message?.split('\n')[0]}`);
    } else {
      console.error('  ? unexpected error during negative test:', err);
      throw err;
    }
  }
  if (!negativeRejected) throw new Error('Negative test did not see the expected FK violation.');

  console.log('\n--- Step 6: POSITIVE TEST — valid UUID accepted (in a rolled-back tx) ---');
  await prisma.$transaction(async (tx) => {
    const target: any[] = await tx.$queryRawUnsafe(`
      SELECT id::text AS id, store_id::text AS store_id
      FROM public.merchant_branches
      WHERE store_id IS NOT NULL
      LIMIT 1;
    `);
    // Set it to the same value — a valid Store id (no-op semantically, but exercises the constraint)
    const ok = await tx.$executeRawUnsafe(`
      UPDATE public.merchant_branches
      SET store_id = '${target[0].store_id}'::uuid
      WHERE id = '${target[0].id}';
    `);
    console.log(`  ✓ valid UPDATE accepted (${ok} row touched)`);
    // Force rollback so this test leaves nothing behind
    throw new Error('__ROLLBACK_POSITIVE_TEST__');
  }).catch((err: any) => {
    if (err?.message?.includes('__ROLLBACK_POSITIVE_TEST__')) return;
    throw err;
  });
  console.log('  ✓ positive test transaction rolled back cleanly');

  console.log('\n--- Step 7: FINAL — count of all FKs on merchant_branches ---');
  const fks: any[] = await prisma.$queryRawUnsafe(`
    SELECT constraint_name, column_name, ref_table, ref_column, delete_rule
    FROM (
      SELECT tc.constraint_name, kcu.column_name,
             ccu.table_name AS ref_table, ccu.column_name AS ref_column,
             rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.table_schema='public' AND tc.table_name='merchant_branches'
        AND tc.constraint_type='FOREIGN KEY'
    ) AS sub
    ORDER BY constraint_name;
  `);
  console.table(fks);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
