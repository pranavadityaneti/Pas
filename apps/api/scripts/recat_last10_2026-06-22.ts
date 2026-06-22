// Final data fix (2026-06-22): place the last placeable catalog-only products. Rollback saved.
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
const q = (s: string, ...a: any[]) => prisma.$queryRawUnsafe(s, ...a) as Promise<any[]>;
const ROLLBACK = `${__dirname}/_recat_last10_rollback_2026-06-22.json`;

const MAP = [
  { name: '2 Quinoa', v: 'Grocery & Kirana', s: 'Rice & Grains' },
  { name: 'Caffè Americano', v: 'Grocery & Kirana', s: 'Beverages' },
  { name: 'Caffè Mocha', v: 'Grocery & Kirana', s: 'Beverages' },
  { name: 'Lee', v: 'Fashion & Apparel', s: "Men's Clothing" },
  { name: 'Mango Dal', v: 'Grocery & Kirana', s: 'Dal & Pulses' },
  { name: 'Mango Dal rice', v: 'Grocery & Kirana', s: 'Dal & Pulses' },
  { name: 'Plant', v: 'Home & Lifestyle', s: 'Gardening Essentials' },
  { name: 'Scissors', v: 'Stationery, Gifting & Toys', s: 'Office Supplies' },
  { name: 'Brushes', v: 'Home & Lifestyle', s: 'Cleaning Supplies' },
];

async function main() {
  // Resolve all (vertical, subcat) ids UPFRONT — avoids a long interactive tx over the pooler (P2028).
  const ids = new Map<string, { vId: string; sId: string }>();
  for (const m of MAP) {
    const k = `${m.v}|${m.s}`;
    if (ids.has(k)) continue;
    const v = (await q(`SELECT id FROM "Vertical" WHERE name=$1`, m.v))[0];
    const t = (await q(`SELECT id FROM "Tier2Category" WHERE vertical_id=$1::uuid AND name=$2`, v.id, m.s))[0];
    if (!t) throw new Error(`subcat not found: ${m.v}/${m.s}`);
    ids.set(k, { vId: v.id, sId: t.id });
  }
  // Sequential single-row updates (each auto-commits; rollback captured per item).
  const moves: any[] = [];
  for (const m of MAP) {
    const { vId, sId } = ids.get(`${m.v}|${m.s}`)!;
    const rows = await q(`SELECT id, name, vertical_id AS "oldV", category_id AS "oldC" FROM "Product" WHERE vertical_id IS NULL AND name=$1`, m.name);
    if (!rows.length) continue;
    await prisma.$executeRawUnsafe(`UPDATE "Product" SET vertical_id=$1::uuid, category_id=$2::uuid WHERE id = ANY($3::text[])`, vId, sId, rows.map((r) => r.id));
    rows.forEach((r) => moves.push({ ...r, to: `${m.v}/${m.s}` }));
    console.log(`   ${m.name} → ${m.v}/${m.s}`);
  }
  fs.writeFileSync(ROLLBACK, JSON.stringify({ when: '2026-06-22', moves }, null, 2));
  const left = await q(`SELECT name FROM "Product" WHERE vertical_id IS NULL ORDER BY name`);
  console.log(`\n[last10] ✓ placed ${moves.length}. null-vertical remaining: ${left.length} → ${left.map((r) => r.name).join(', ') || '(none)'}`);
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
