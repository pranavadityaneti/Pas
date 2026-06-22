// Fix data (2026-06-22): categorize the remaining catalog-only (unlisted) non-food products
// into their real verticals; delete a short list of genuine gibberish (full rows captured first
// for recovery). Atomic + rollback snapshot. All items are invisible to customers (unlisted).
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
const q = (s: string, ...a: any[]) => prisma.$queryRawUnsafe(s, ...a) as Promise<any[]>;
const ROLLBACK = `${__dirname}/_recat_nonfood_rollback_2026-06-22.json`;
const lc = (s: string) => s.toLowerCase();
const inc = (n: string, ks: string[]) => ks.some((k) => lc(n).includes(k));

const DELETE_NAMES = ['Custom', 'Fashion', 'Indian fashion', 'Greeb', 'VJr', 'Smil fit', 'Royal blue', 'Surhi'];

// returns [vertical, subcat] or null (=leave)
function classify(name: string): [string, string] | null {
  const n = name;
  if (inc(n, ['dog', ' cat', 'cats', 'puppy', 'puppies', 'kitten', 'harness', 'pedigree', 'canin', 'petheeds', 'petverse', 'zoomies', 'brooming', 'feeder', ' paw', 'erina', 'furglow', 'digyton', 'pets food', 'pets life', 'for pets'])) {
    if (inc(n, ['food', 'feeding', 'pedigree', 'canin'])) return ['Pet Care & Supplies', inc(n, ['cat', 'canin']) ? 'Cat Food' : 'Dog Food'];
    if (inc(n, ['omega', 'syrup', 'drops', 'tonic', 'supplement', 'multivitamin', 'erina', 'furglow', 'digyton', 'dentastix'])) return ['Pet Care & Supplies', 'Pet Health'];
    if (inc(n, ['brooming', 'groom'])) return ['Pet Care & Supplies', 'Pet Grooming'];
    return ['Pet Care & Supplies', 'Toys & Accessories'];
  }
  if (inc(n, ['eye shadow', 'eyeshadow', 'eyelash', 'mascara', 'makeup', 'make-up'])) return ['Beauty & Personal Care', 'Makeup & Cosmetics'];
  if (inc(n, ['bangle', 'gajulu', 'earring', 'earing', 'necklace', 'pendant', 'bracelet', 'kundan', 'nose ring', ' watch', 'choker', 'anklet'])) return ['Fashion & Apparel', 'Accessories & Jewelry'];
  if (inc(n, ["men's", 'mens', 'dulha'])) return ['Fashion & Apparel', "Men's Clothing"];
  if (inc(n, ['jeans', 'jean', 'kurta', 'kurti', 'dress', 'drees', 'saree', 'lehenga', ' lee', 'bridal', 'bride', 'bridesmaid', 'wedding', 'party wear', 'formal'])) return ['Fashion & Apparel', "Women's Clothing"];
  if (inc(n, ['soft toy', 'plushie', 'plush'])) return ['Stationery, Gifting & Toys', 'Toys & Games'];
  if (inc(n, [' pen', 'pencil'])) return ['Stationery, Gifting & Toys', 'Pens & Markers'];
  if (inc(n, ['notebook'])) return ['Stationery, Gifting & Toys', 'Notebooks & Diaries'];
  if (lc(n.trim()) === 'ball' || lc(n.trim()).includes('bat') || inc(n, ['cricket'])) return ['Sports & Fitness', 'Sports & Outdoor Accessories'];
  if (inc(n, ['laung', 'clove', 'lavang', 'cardamom', 'elaichi', 'star anise', 'chakri', 'chilly powder', 'chilli powder', 'jeera', 'masala', 'dalchini', 'cassia', 'cinnamon', 'pepper', 'kali mirch'])) return ['Grocery & Kirana', 'Masalas & Spices'];
  return null;
}

async function main() {
  const rows = await q(`
    SELECT pr.id, pr.name FROM "Product" pr
    WHERE pr.vertical_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM "StoreProduct" sp WHERE sp."productId" = pr.id AND sp.active = true AND COALESCE(sp.is_deleted,false)=false)`);

  // resolve (vertical,subcat) → id once
  const subIds = new Map<string, string>();
  const getSub = async (v: string, s: string) => {
    const key = `${v}|${s}`;
    if (subIds.has(key)) return subIds.get(key)!;
    const r = (await q(`SELECT t.id FROM "Tier2Category" t JOIN "Vertical" vv ON vv.id=t.vertical_id AND vv.name=$1 WHERE t.name=$2`, v, s))[0];
    if (!r) throw new Error(`subcat not found: ${v}/${s}`);
    const vId = (await q(`SELECT id FROM "Vertical" WHERE name=$1`, v))[0].id;
    subIds.set(key, `${vId}::${r.id}`);
    return subIds.get(key)!;
  };

  const cats: any[] = [];
  const dels: any[] = [];
  for (const r of rows) {
    if (DELETE_NAMES.map(lc).includes(lc(r.name.trim()))) { dels.push(r); continue; }
    const c = classify(r.name);
    if (c) { const ids = await getSub(c[0], c[1]); cats.push({ id: r.id, name: r.name, vId: ids.split('::')[0], sId: ids.split('::')[1], to: `${c[0]}/${c[1]}` }); }
  }

  // CATEGORIZE ONLY — do NOT delete (the delete candidates are reported for explicit approval).
  fs.writeFileSync(ROLLBACK, JSON.stringify({ when: '2026-06-22', categorized: cats.map((c) => ({ id: c.id, name: c.name, to: c.to })) }, null, 2));

  await prisma.$transaction(async (tx) => {
    const byTarget = new Map<string, { vId: string; sId: string; ids: string[] }>();
    for (const c of cats) { const k = `${c.vId}|${c.sId}`; if (!byTarget.has(k)) byTarget.set(k, { vId: c.vId, sId: c.sId, ids: [] }); byTarget.get(k)!.ids.push(c.id); }
    for (const { vId, sId, ids } of byTarget.values())
      await tx.$executeRawUnsafe(`UPDATE "Product" SET vertical_id=$1::uuid, category_id=$2::uuid WHERE id = ANY($3::text[])`, vId, sId, ids);
  });

  const byV: Record<string, number> = {};
  cats.forEach((c) => { const v = c.to.split('/')[0]; byV[v] = (byV[v] || 0) + 1; });
  console.log('[nonfood] categorized:'); Object.entries(byV).forEach(([k, n]) => console.log(`   ${String(n).padStart(3)}  ${k}`));
  console.log(`[nonfood] NOT deleted — delete CANDIDATES (need your ok): ${dels.length} → ${dels.map((d) => d.name).join(', ')}`);
  const left = rows.length - cats.length - dels.length;
  console.log(`[nonfood] left ambiguous (kept): ${left}`);
  console.log(`[nonfood] rollback: ${ROLLBACK}`);
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
