// Fix data (2026-06-22): categorize the Freshly store's uncategorized FRESH PRODUCE into
// Fresh Items + Fresh Vegetables / Fresh Fruits. Targets products that are (a) listed by a
// "Freshly" branch, (b) currently uncategorized (null vertical), (c) a known produce name.
// Atomic + before-state rollback snapshot. Safe to delete after.
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
const q = (s: string, ...a: any[]) => prisma.$queryRawUnsafe(s, ...a) as Promise<any[]>;
const ROLLBACK = `${__dirname}/_recat_freshly_rollback_2026-06-22.json`;

const VEG = ['Beans Broad', 'Beetroot', 'Cabbage', 'Capsicum Green', 'Carrot Local', 'Chilli Green', 'Coccinia', 'Coriander Leaves', 'Cucumber Green', 'Organically Grown Spinach', 'Tomato Local'];
const FRUIT = ['Mosambi', 'Sapota'];

async function main() {
  const fi = (await q(`SELECT id FROM "Vertical" WHERE name = 'Fresh Items'`))[0];
  const sub = new Map((await q(`SELECT id, name FROM "Tier2Category" WHERE vertical_id = $1::uuid`, fi.id)).map((r) => [r.name, r.id]));
  const vegId = sub.get('Fresh Vegetables');
  const fruitId = sub.get('Fresh Fruits');
  if (!vegId || !fruitId) throw new Error('Fresh Items subcategories not found');

  // The exact uncategorized produce products Freshly lists.
  const rows = await q(`
    SELECT DISTINCT pr.id, pr.name, pr.vertical_id AS "oldV", pr.category_id AS "oldC"
    FROM "StoreProduct" sp JOIN "Product" pr ON pr.id = sp."productId"
    JOIN "merchant_branches" mb ON mb.id = sp.branch_id
    WHERE mb.branch_name ILIKE '%fresh%' AND pr.vertical_id IS NULL
      AND pr.name = ANY($1::text[])`, [...VEG, ...FRUIT]);

  const moves = rows.map((r) => ({ id: r.id, name: r.name, oldV: r.oldV, oldC: r.oldC, subId: VEG.includes(r.name) ? vegId : fruitId, sub: VEG.includes(r.name) ? 'Fresh Vegetables' : 'Fresh Fruits' }));
  console.log(`[freshly] ${moves.length} produce products to categorize:`);
  moves.forEach((m) => console.log(`   • ${m.name} → Fresh Items / ${m.sub}`));

  fs.writeFileSync(ROLLBACK, JSON.stringify({ when: '2026-06-22', moves }, null, 2));
  console.log(`[freshly] rollback snapshot: ${ROLLBACK}`);

  const veg = moves.filter((m) => m.subId === vegId).map((m) => m.id);
  const fruit = moves.filter((m) => m.subId === fruitId).map((m) => m.id);
  await prisma.$transaction(async (tx) => {
    if (veg.length) await tx.$executeRawUnsafe(`UPDATE "Product" SET vertical_id=$1::uuid, category_id=$2::uuid WHERE id = ANY($3::text[])`, fi.id, vegId, veg);
    if (fruit.length) await tx.$executeRawUnsafe(`UPDATE "Product" SET vertical_id=$1::uuid, category_id=$2::uuid WHERE id = ANY($3::text[])`, fi.id, fruitId, fruit);
  });
  console.log(`[freshly] ✓ ${veg.length} → Fresh Vegetables, ${fruit.length} → Fresh Fruits`);
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
