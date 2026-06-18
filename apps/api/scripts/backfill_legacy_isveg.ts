// Phase 4 sub-3 (2026-06-17): backfill Product.isVeg for the ~294 legacy (non-Blinkit)
// products. Reuses the loader's tri-state deriveVeg: food (Vertical.requiresFssai) →
// veg unless a non-veg signal in name/subcategory; non-food → stays null (no dot).
// Blinkit rows already have isVeg (set at load) and are excluded.
import { PrismaClient } from '@prisma/client';
import { deriveVeg } from '../src/blinkitLoader/vegRules';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.product.findMany({
    where: { source: { not: 'blinkit' }, isVeg: null },
    select: { id: true, name: true, subcategory: true, Vertical: { select: { requiresFssai: true } } },
  });
  console.log(`[isveg-backfill] candidates (non-blinkit, isVeg null): ${rows.length}`);

  const vegIds: string[] = [];
  const nonVegIds: string[] = [];
  for (const r of rows) {
    const v = deriveVeg({ isFood: !!r.Vertical?.requiresFssai, name: r.name ?? '', subcategory: r.subcategory ?? null });
    if (v === true) vegIds.push(r.id);
    else if (v === false) nonVegIds.push(r.id);
    // v === null → leave as null (non-food)
  }

  if (vegIds.length) await prisma.product.updateMany({ where: { id: { in: vegIds } }, data: { isVeg: true } });
  if (nonVegIds.length) await prisma.product.updateMany({ where: { id: { in: nonVegIds } }, data: { isVeg: false } });

  console.log(`[isveg-backfill] set veg=${vegIds.length}, non-veg=${nonVegIds.length}, left-null(non-food)=${rows.length - vegIds.length - nonVegIds.length}`);

  // verify: no food legacy product left null
  const foodNull = await prisma.product.count({ where: { source: { not: 'blinkit' }, Vertical: { requiresFssai: true }, isVeg: null } });
  console.log(`[isveg-backfill] food legacy still null (should be 0): ${foodNull}`);
  console.log('[isveg-backfill] done.');
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
