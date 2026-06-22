// Phase 2 FINAL — B1: add merchant_branches.store_id (nullable, no FK).
// Additive only. Fully reversible: ALTER TABLE merchant_branches DROP COLUMN store_id;
// Run from apps/api/ with the production DATABASE_URL loaded via .env.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- B1: ALTER TABLE merchant_branches ADD COLUMN store_id uuid; ---');
  await prisma.$executeRawUnsafe(
    `ALTER TABLE public.merchant_branches ADD COLUMN IF NOT EXISTS store_id uuid;`
  );
  console.log('  ✓ column added (or already existed)');

  console.log('\n--- Verify column exists ---');
  const col: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='merchant_branches' AND column_name='store_id';
  `);
  console.table(col);

  console.log('\n--- Verify no rows have store_id populated yet ---');
  const counts: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS branch_total, COUNT(store_id)::int AS branches_with_store_id
    FROM public.merchant_branches;
  `);
  console.table(counts);

  console.log('\n--- Verify no FK exists on the new column yet (added in B5) ---');
  const fks: any[] = await prisma.$queryRawUnsafe(`
    SELECT tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema='public'
      AND tc.table_name='merchant_branches'
      AND tc.constraint_type='FOREIGN KEY';
  `);
  console.table(fks);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
