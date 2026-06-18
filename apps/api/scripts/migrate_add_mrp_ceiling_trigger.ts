// Phase 4 sub-2 · Task 1 (2026-06-17)
// Installs a BEFORE INSERT/UPDATE trigger on "StoreProduct" that joins "Product" and
// rejects writes where price > Product.mrp. Defense-in-depth on top of the app + API
// guards (spec §9, decision D1). Pre-flight: counts existing violators and refuses
// to install if any exist (Phase 4 spec verified 0 in prod — this is a forward guard).
// Negative-tested in a rolled-back transaction (positive case is implicit — any
// normal listing already satisfies it).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// $executeRawUnsafe rejects multiple commands in one call — run each statement separately.
const STATEMENTS = [
  `CREATE OR REPLACE FUNCTION public.enforce_mrp_ceiling()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  product_mrp double precision;
BEGIN
  SELECT mrp INTO product_mrp FROM public."Product" WHERE id = NEW."productId";
  IF product_mrp IS NULL THEN
    RAISE EXCEPTION 'Product % not found for StoreProduct write', NEW."productId";
  END IF;
  IF NEW.price > product_mrp THEN
    RAISE EXCEPTION 'MRP_CEILING_VIOLATED: price % exceeds Product.mrp %', NEW.price, product_mrp;
  END IF;
  RETURN NEW;
END $$;`,
  `DROP TRIGGER IF EXISTS trg_storeproduct_mrp_ceiling ON public."StoreProduct";`,
  `CREATE TRIGGER trg_storeproduct_mrp_ceiling
  BEFORE INSERT OR UPDATE OF price, "productId" ON public."StoreProduct"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mrp_ceiling();`,
];

async function main() {
  console.log('[mrp-ceiling] pre-flight: count existing violators');
  const offenders: any[] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "StoreProduct" sp JOIN "Product" pr ON pr.id = sp."productId" WHERE sp.price > pr.mrp`,
  );
  if (offenders[0].n > 0) {
    throw new Error(`refusing to install trigger: ${offenders[0].n} existing rows violate it`);
  }
  console.log('[mrp-ceiling] 0 violators ✓  applying trigger…');
  for (const stmt of STATEMENTS) await prisma.$executeRawUnsafe(stmt);
  console.log('[mrp-ceiling] applied. verifying trigger exists…');
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT tgname FROM pg_trigger WHERE tgname='trg_storeproduct_mrp_ceiling'`,
  );
  if (!rows.length) throw new Error('trigger not present after install');
  console.log('[mrp-ceiling] ✓ trigger present');

  console.log('[mrp-ceiling] negative-test in a rolled-back tx…');
  let caught = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "StoreProduct" (id, "productId", branch_id, price, stock, variant, active, is_deleted)
         SELECT gen_random_uuid(), pr.id, mb.id, pr.mrp + 1, 0, 'Standard', false, false
         FROM "Product" pr CROSS JOIN "MerchantBranch" mb
         WHERE pr.source='blinkit' AND mb.store_id IS NOT NULL LIMIT 1`,
      );
      throw new Error('NEGATIVE_TEST_DID_NOT_THROW');
    });
  } catch (e: any) {
    if (/MRP_CEILING_VIOLATED/.test(String(e?.message))) {
      caught = true;
      console.log('[mrp-ceiling] ✓ trigger raised MRP_CEILING_VIOLATED on price > mrp');
    } else if (e.message === 'NEGATIVE_TEST_DID_NOT_THROW') {
      throw new Error('NEGATIVE TEST FAILED — trigger did not fire on a price > mrp insert');
    } else {
      throw e;
    }
  }
  if (!caught) throw new Error('negative test did not run');
  console.log('[mrp-ceiling] done.');
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
