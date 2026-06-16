// Phase 2 FINAL — F4b: make merchant_branches.store_id NOT NULL.
// THE LOCK: after this, the DB itself forbids a branch with no parent Store.
// Safe now: (a) the 21 NULL-store_id branches were deleted (F4a); (b) F1 is
// DEPLOYED (app-260616_182606893154) so all branch-creation paths set store_id.
// Reversible: ALTER TABLE merchant_branches ALTER COLUMN store_id DROP NOT NULL;
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Pre-flight: 0 NULL store_id rows required ---');
  const nulls: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM public.merchant_branches WHERE store_id IS NULL;`);
  console.table(nulls);
  if (nulls[0].n !== 0) throw new Error(`${nulls[0].n} NULL store_id rows remain — ABORT.`);

  console.log('\n--- ALTER COLUMN store_id SET NOT NULL ---');
  await prisma.$executeRawUnsafe(`ALTER TABLE public.merchant_branches ALTER COLUMN store_id SET NOT NULL;`);
  console.log('  ✓ store_id is now NOT NULL');

  console.log('\n--- Verify ---');
  const v: any[] = await prisma.$queryRawUnsafe(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='merchant_branches' AND column_name='store_id';
  `);
  console.table(v);
  if (v[0].is_nullable !== 'NO') throw new Error('store_id did not become NOT NULL.');

  console.log('\n--- Negative test: inserting a branch with NULL store_id must now be rejected (rolled back) ---');
  let rejected = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`INSERT INTO public.merchant_branches (id, branch_name) VALUES ('f4b_negtest_${Date.now()}', 'F4B NEG TEST');`);
      throw new Error('INSERT with NULL store_id SUCCEEDED — NOT NULL not effective!');
    });
  } catch (err: any) {
    if (err?.message?.includes('SUCCEEDED')) { console.error('  ✗', err.message); throw err; }
    rejected = true;
    console.log(`  ✓ DB rejected NULL store_id (msg: ${(err?.meta?.message || err?.message || '').split('\n')[0]})`);
  }
  if (!rejected) throw new Error('Negative test inconclusive.');

  console.log('\n--- Final chain integrity: every StoreProduct -> branch -> store_id -> Store ---');
  const leak: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS leaks FROM public."StoreProduct" sp
    JOIN public.merchant_branches mb ON mb.id = sp.branch_id
    LEFT JOIN public."Store" s ON s.id = mb.store_id
    WHERE s.id IS NULL;
  `);
  console.table(leak);
  console.log(leak[0].leaks === 0 ? '  ✓ ZERO leaks. Chain is now DB-enforced end-to-end.' : '  ✗ leaks remain!');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
