// Re-categorization (2026-06-22): move high-confidence electrical/paint/automotive
// products into the (previously empty) "Electricals, Paints & Automotive" vertical +
// the right Tier2 subcategory. High-precision keyword rules; decorative night lamps
// and ~150 false positives intentionally excluded (Pranav-approved clean set).
// Atomic (one tx). Writes a before-state ROLLBACK file for one-command revert.
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const q = (s: string, ...a: any[]) => prisma.$queryRawUnsafe(s, ...a) as Promise<any[]>;
const VERT = 'Electricals, Paints & Automotive';
const ROLLBACK = `${__dirname}/_recat_rollback_2026-06-22.json`;

// rule.sub MUST equal the exact Tier2Category name under the Electricals vertical.
const RULES: { sub: string; include: string[]; exclude: string[] }[] = [
  { sub: 'Extension Boards', include: ['%extension board%', '%power strip%', '%spike guard%', '%spike buster%', '%power guard%'], exclude: [] },
  { sub: 'Bulbs & Lighting', include: ['%led bulb%', '%led batten%', '%batten light%', '%tubelight%', '%tube light%', '%led tube%', '% bulb (%', '%w bulb%', '%cfl%'],
    exclude: ['%night lamp%', '%crystal%', '%3d %', '%diya%', '%galaxy%', '%astronaut%', '%doll%', '%decor%', '%toy%'] },
  { sub: 'Plugs & Switches', include: ['% multi plug%', '%multiplug%', '%plug top%', '%switch board%', '%modular switch%', '%wall socket%', '%power socket%'],
    exclude: ['%lip%', '%balm%', '%lipstick%', '%glitter%', '%primer +%', '%toy%', '%baby%', '%educational%', '%sensory%'] },
  { sub: 'Batteries', include: ['%inverter battery%', '%car battery%'], exclude: [] },
  { sub: 'Spray Paints & Brushes', include: ['%spray paint%', '%enamel paint%', '%wall paint %', '%wood primer%', '%metal primer%', '%paint brush%'],
    exclude: ['%nail%', '%wall painting%', '%artist%', '% art %', '%diy%', '%craft%', '%canvas%', '%poster%', '%fabric%', '%kit%', '%kids%', '%face%', '%body%', '%doodle%'] },
  { sub: 'Motor Oils & Lubes', include: ['%engine oil%', '%motor oil%', '%gear oil%', '%2t oil%'], exclude: ['%essential oil%', '%hair oil%', '%body oil%', '%cooking%', '%massage%', '%edible%'] },
  { sub: 'Car Cleaning', include: ['%car shampoo%', '%car polish%', '%car wax%', '%car wash%', '%tyre polish%', '%dashboard polish%', '%windshield washer%', '%windshield wiper%', '%wiper blade%', '%car cleaner%'],
    exclude: ['%mount%', '%holder%', '%cam %', '%cam(%', '% mic %', '%shade%', '%umbrella%', '%phone%', '%mobile%', '%glove%', '%cloth%'] },
  { sub: 'Bike Care', include: ['%bike chain%', '%chain lube%', '%chain cleaner%'], exclude: ['%shorts%', '%jersey%', '%apparel%'] },
  { sub: 'Helmets & Accessories', include: ['%full face helmet%', '%open face helmet%', '%motorcycle helmet%', '%motorbike helmet%', '%half face helmet%'],
    exclude: ['%baby%', '%skull cap%', '%action figure%', '%doll%', '%toy%', '%pencil%', '%cam%', '%cleaner%', '%kit%', '%cycle%', '%multisport%', '%light%', '%phone%', '%mount%', '%lock%'] },
];

async function main() {
  const elec = (await q(`SELECT id FROM "Vertical" WHERE name = $1`, VERT))[0];
  if (!elec) throw new Error('Electricals vertical not found');
  const subs = await q(`SELECT id, name FROM "Tier2Category" WHERE vertical_id = $1::uuid`, elec.id);
  const subId = new Map(subs.map((s) => [s.name, s.id]));

  // 1) Resolve the moves (ordered, first-match wins via the claimed set), capture before-state.
  const claimed = new Set<string>();
  const moves: { id: string; oldV: string | null; oldC: string | null; newSub: string; subId: string }[] = [];
  for (const r of RULES) {
    const tId = subId.get(r.sub);
    if (!tId) throw new Error(`subcategory not found: ${r.sub}`);
    const exc = r.exclude.length ? r.exclude : ['%__never__%'];
    const rows = await q(`
      SELECT pr.id, pr.vertical_id AS "oldV", pr.category_id AS "oldC"
      FROM "Product" pr LEFT JOIN "Vertical" v ON v.id = pr.vertical_id
      WHERE (pr.name ILIKE ANY($1::text[])) AND NOT (pr.name ILIKE ANY($2::text[]))
        AND (pr.vertical_id IS NULL OR v.name <> $3)`, r.include, exc, VERT);
    for (const row of rows) {
      if (claimed.has(row.id)) continue;
      claimed.add(row.id);
      moves.push({ id: row.id, oldV: row.oldV, oldC: row.oldC, newSub: r.sub, subId: tId });
    }
  }
  console.log(`[recat] resolved ${moves.length} products to move`);

  // 2) Write the rollback file BEFORE any write.
  fs.writeFileSync(ROLLBACK, JSON.stringify({ when: '2026-06-22', vertical: VERT, moves }, null, 2));
  console.log(`[recat] rollback snapshot written: ${ROLLBACK}`);

  // 3) Apply atomically — one UPDATE per subcategory bucket.
  const bySub = new Map<string, { subId: string; ids: string[] }>();
  for (const m of moves) {
    if (!bySub.has(m.newSub)) bySub.set(m.newSub, { subId: m.subId, ids: [] });
    bySub.get(m.newSub)!.ids.push(m.id);
  }
  await prisma.$transaction(async (tx) => {
    for (const [sub, { subId: tId, ids }] of bySub) {
      if (!ids.length) continue;
      await tx.$executeRawUnsafe(
        `UPDATE "Product" SET vertical_id = $1::uuid, category_id = $2::uuid WHERE id = ANY($3::text[])`,
        elec.id, tId, ids);
      console.log(`[recat]   ${sub}: ${ids.length} moved`);
    }
  });

  // 4) Verify.
  const after = (await q(`SELECT count(*)::int n FROM "Product" WHERE vertical_id = $1::uuid`, elec.id))[0].n;
  console.log(`\n[recat] ✓ done. "${VERT}" now has ${after} products (was 0).`);
  const perSub = await q(`
    SELECT t.name, count(pr.id)::int AS n FROM "Tier2Category" t
    LEFT JOIN "Product" pr ON pr.category_id = t.id
    WHERE t.vertical_id = $1::uuid GROUP BY t.name ORDER BY n DESC`, elec.id);
  perSub.forEach((s) => console.log(`         ${String(s.n).padStart(4)}  ${s.name}`));
}

main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
