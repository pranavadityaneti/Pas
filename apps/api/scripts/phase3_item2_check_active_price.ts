// Phase 3 Item 2b: DB backstop — an active StoreProduct must have price > 0.
// CHECK (NOT (active AND price <= 0)). Covers every write path (handlers, the
// upcoming bulk loader, direct SQL) in one place. Pranav-approved 2026-06-16.
// Reversible: ALTER TABLE "StoreProduct" DROP CONSTRAINT storeproduct_active_requires_price;
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const NAME = 'storeproduct_active_requires_price';

async function main() {
  console.log('--- Pre-flight: existing violations (active AND price<=0) must be 0 ---');
  const v: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM public."StoreProduct" WHERE active = true AND price <= 0;`);
  console.table(v);
  if (v[0].n !== 0) throw new Error(`${v[0].n} existing violations — ABORT (would fail the ADD).`);

  const exists: any[] = await prisma.$queryRawUnsafe(`SELECT 1 FROM pg_constraint WHERE conname='${NAME}' AND conrelid='public."StoreProduct"'::regclass;`);
  if (exists.length) { console.log(`  ! ${NAME} already exists — nothing to do.`); return; }

  console.log('\n--- ADD CONSTRAINT ---');
  await prisma.$executeRawUnsafe(`ALTER TABLE public."StoreProduct" ADD CONSTRAINT ${NAME} CHECK (NOT (active AND price <= 0));`);
  console.log('  ✓ added');

  console.log('\n--- Verify registered ---');
  const def: any[] = await prisma.$queryRawUnsafe(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='${NAME}';`);
  console.table(def);

  console.log('\n--- Negative test: raw UPDATE to active+₹0 must be REJECTED (rolled back) ---');
  let rejected = false;
  try {
    await prisma.$transaction(async (tx) => {
      const t: any[] = await tx.$queryRawUnsafe(`SELECT id FROM public."StoreProduct" LIMIT 1;`);
      await tx.$executeRawUnsafe(`UPDATE public."StoreProduct" SET active = true, price = 0 WHERE id = '${t[0].id}';`);
      throw new Error('UPDATE to active+₹0 SUCCEEDED — constraint not effective!');
    });
  } catch (err: any) {
    if (err?.message?.includes('SUCCEEDED')) { console.error('  ✗', err.message); throw err; }
    rejected = true;
    console.log(`  ✓ DB rejected active+₹0 (msg: ${(err?.meta?.message || err?.message || '').split('\n')[0]})`);
  }
  if (!rejected) throw new Error('Negative test inconclusive.');

  console.log('\n--- Positive test: active + price>0 still allowed (rolled back) ---');
  await prisma.$transaction(async (tx) => {
    const t: any[] = await tx.$queryRawUnsafe(`SELECT id, price FROM public."StoreProduct" WHERE active = true AND price > 0 LIMIT 1;`);
    if (t.length) {
      const ok = await tx.$executeRawUnsafe(`UPDATE public."StoreProduct" SET price = ${Number(t[0].price)} WHERE id = '${t[0].id}';`);
      console.log(`  ✓ valid active row update accepted (${ok} row)`);
    } else console.log('  (no active price>0 row to test; skipped)');
    throw new Error('__ROLLBACK__');
  }).catch((e: any) => { if (!e?.message?.includes('__ROLLBACK__')) throw e; });
  console.log('  ✓ positive test rolled back cleanly');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
