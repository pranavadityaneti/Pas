// Fix data (2026-06-22): categorize the catalog-only (unlisted) FOOD products — hand-vetted
// to exclude false positives (jewelry/pet/dal). Atomic + rollback snapshot. Safe to delete after.
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
const q = (s: string, ...a: any[]) => prisma.$queryRawUnsafe(s, ...a) as Promise<any[]>;
const ROLLBACK = `${__dirname}/_recat_catalog_food_rollback_2026-06-22.json`;

const GROUPS = [
  { vertical: 'Fresh Items', subcat: 'Fresh Vegetables', names: ['Beans Haricot', 'Bottle Gourd', 'Broccoli', 'Carrot Local', 'Cauliflower', 'Green Peas (Matar)', 'Onion', 'Potato', 'Tropical Pumpkin Harmony', 'ZOFF Kasoori Methi - Fenugreek Leaves', 'Lady Finger'] },
  { vertical: 'Fresh Items', subcat: 'Fresh Fruits', names: ['Baby Apple Shimla', 'Baby Orange (Mandarin)', 'Banana Elaichi / Yelakki', 'Banana Nendran', 'Banana Robusta', 'Gooseberry (Amla)', 'Grapes Bangalore Blue', 'Grapes Black Seedless', 'Grapes Green Sonaka Seedless', 'Guava Indian', 'Guava Thai', 'Kiwi Green', 'Muskmelon Striped', 'Orange Nagpur', 'Papaya', 'Papaya Cut', 'Pomegranate Premium', 'Tender Coconut'] },
  { vertical: 'Fresh Items', subcat: 'Meat & Seafood', names: ['Chicken Biryani', 'Chicken full', 'Chicken wings', 'Lamp mutton', 'Biryani cut'] },
  { vertical: 'Grocery & Kirana', subcat: 'Masalas & Spices', names: ['GARAM MASALA SABUT', 'Nutraj Cassia (Cinnamon / Dalchini) Sticks', 'ZOFF Cassia Bark - Dalchini Sticks', 'ZOFF Foods Garam Masala Whole Spices', 'ZOFF Foods Whole Spices Clove/Laung', 'Catch Jeera Whole', 'Daily Good Black Pepper / Kali Mirch', 'Daily Good Cassia - Taj', 'Daily Good Cloves / Lavang / Laung', 'Daily Good Star Anise'] },
];

async function main() {
  const allMoves: any[] = [];
  await prisma.$transaction(async (tx) => {
    for (const g of GROUPS) {
      const v = (await tx.$queryRawUnsafe(`SELECT id FROM "Vertical" WHERE name = $1`, g.vertical) as any[])[0];
      const t = (await tx.$queryRawUnsafe(`SELECT id FROM "Tier2Category" WHERE vertical_id = $1::uuid AND name = $2`, v.id, g.subcat) as any[])[0];
      if (!t) throw new Error(`subcat not found: ${g.vertical}/${g.subcat}`);
      const rows = await tx.$queryRawUnsafe(`SELECT id, name, vertical_id AS "oldV", category_id AS "oldC" FROM "Product" WHERE vertical_id IS NULL AND name = ANY($1::text[])`, g.names) as any[];
      if (rows.length) {
        await tx.$executeRawUnsafe(`UPDATE "Product" SET vertical_id=$1::uuid, category_id=$2::uuid WHERE id = ANY($3::text[])`, v.id, t.id, rows.map((r) => r.id));
        rows.forEach((r) => allMoves.push({ ...r, to: `${g.vertical}/${g.subcat}` }));
      }
      console.log(`   ${g.vertical}/${g.subcat}: ${rows.length}`);
    }
  });
  fs.writeFileSync(ROLLBACK, JSON.stringify({ when: '2026-06-22', moves: allMoves }, null, 2));
  console.log(`\n[food] ✓ categorized ${allMoves.length} catalog-only food products. rollback: ${ROLLBACK}`);
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
