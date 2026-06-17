// READ-ONLY adversarial audit of the Blinkit loader against the real CSV + DB.
// Hunts for silent-corruption bugs before the 139,880-row prod write.
import fs from 'node:fs';
import { parse } from 'csv-parse';
import { PrismaClient } from '@prisma/client';
import { BlinkitRow } from '../src/blinkitLoader/types';
import { mapRowToProduct, safeJson, firstImage } from '../src/blinkitLoader/transform';

const prisma = new PrismaClient();
const FILE = '/Users/pranavaditya/Desktop/WORK/ALL PROJECTS/PAS/Datasets/Blinkit Data.csv';
const norm = (s: string) => (s ?? '').trim().toLowerCase();

async function main() {
  // ---- DB side ----
  const cmRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT cm.source_category, cm.source_subcategory, cm.vertical_id::text AS vertical_id,
           cm.category_id::text AS category_id, COALESCE(v."requiresFssai",false) AS requires_fssai
    FROM "CategoryMapping" cm JOIN "Vertical" v ON v.id = cm.vertical_id
    WHERE cm.source_platform='BLINKIT' AND cm.status='ACTIVE' AND cm.vertical_id IS NOT NULL AND cm.category_id IS NOT NULL;`);
  const exact = new Map<string, any>();
  const normed = new Map<string, any>();
  for (const r of cmRows) {
    exact.set(`${r.source_category}|||${r.source_subcategory}`, r);
    normed.set(`${norm(r.source_category)}|||${norm(r.source_subcategory)}`, r);
  }
  console.log(`CategoryMapping: ${exact.size} exact keys`);

  console.log('\n=== A. Vertical requiresFssai map (food = true) — veg derivation depends on this ===');
  const verts: any[] = await prisma.$queryRawUnsafe(`SELECT name, "requiresFssai" FROM "Vertical" ORDER BY "requiresFssai" DESC, name;`);
  console.table(verts);

  // ---- CSV side ----
  let header: string[] = [];
  const stats = {
    rows: 0,
    mrpComma: 0, mrpNaN: 0, priceComma: 0, priceNaN: 0,
    dumpParseFail: 0, dumpHasSiblings: 0, dumpHasRating: 0, dumpHasParentIdx: 0,
    imgFail: 0,
    unmappedExact: 0, recoverableNormalized: 0, trulyUnmapped: 0,
    invalidNameOrMrp: 0,
  };
  const sample = { mrpComma: [] as string[], dumpFail: [] as string[], recoverable: [] as string[], truly: new Map<string, number>(), dumpKeys: new Set<string>() };

  const parser = fs.createReadStream(FILE).pipe(parse({ columns: (h) => { header = h; return h; }, relax_quotes: true, skip_empty_lines: true }));

  for await (const row of parser as AsyncIterable<BlinkitRow>) {
    stats.rows++;
    // numeric integrity
    if (/,/.test(row.mrp || '')) { stats.mrpComma++; if (sample.mrpComma.length < 8) sample.mrpComma.push(`${row.name} | mrp="${row.mrp}"`); }
    if (!Number.isFinite(parseFloat(row.mrp))) stats.mrpNaN++;
    if (/,/.test(row.price || '')) stats.priceComma++;
    if (!Number.isFinite(parseFloat(row.price))) stats.priceNaN++;
    // data_dump
    const dump = safeJson<any>(row.data_dump);
    if (row.data_dump && dump === null) { stats.dumpParseFail++; if (sample.dumpFail.length < 5) sample.dumpFail.push((row.data_dump || '').slice(0, 120)); }
    if (dump) { Object.keys(dump).forEach(k => sample.dumpKeys.add(k)); if (dump.siblings) stats.dumpHasSiblings++; if (dump.rating != null) stats.dumpHasRating++; if (dump.parentIndex != null) stats.dumpHasParentIdx++; }
    // images
    if (!firstImage(row.images)) stats.imgFail++;
    // category match
    const key = `${row.category}|||${row.subcategory}`;
    if (!exact.has(key)) {
      stats.unmappedExact++;
      if (normed.has(`${norm(row.category)}|||${norm(row.subcategory)}`)) {
        stats.recoverableNormalized++;
        if (sample.recoverable.length < 10) sample.recoverable.push(`"${row.category}" / "${row.subcategory}"`);
      } else {
        stats.trulyUnmapped++;
        const k = `${row.category} / ${row.subcategory}`;
        sample.truly.set(k, (sample.truly.get(k) || 0) + 1);
      }
    }
    // validity (loader's skip condition)
    if (!row.name?.trim() || !Number.isFinite(parseFloat(row.mrp)) || parseFloat(row.mrp) <= 0) stats.invalidNameOrMrp++;
  }

  console.log('\n=== B. Header (csv-parse keys) ===');
  console.log(header.join(', '));

  console.log('\n=== C. Numeric integrity (parseFloat comma/NaN corruption) ===');
  console.log(`rows=${stats.rows}  mrp-with-comma=${stats.mrpComma}  mrp-NaN=${stats.mrpNaN}  price-with-comma=${stats.priceComma}  price-NaN=${stats.priceNaN}`);
  if (sample.mrpComma.length) console.log('  mrp-comma samples:\n   ' + sample.mrpComma.join('\n   '));

  console.log('\n=== D. data_dump JSON parsing ===');
  console.log(`parse-fail=${stats.dumpParseFail}  hasSiblings=${stats.dumpHasSiblings}  hasRating=${stats.dumpHasRating}  hasParentIndex=${stats.dumpHasParentIdx}`);
  console.log('  observed data_dump keys:', [...sample.dumpKeys].slice(0, 40).join(', '));
  if (sample.dumpFail.length) console.log('  parse-fail samples:\n   ' + sample.dumpFail.join('\n   '));

  console.log('\n=== E. images first-URL extraction ===');
  console.log(`image-extract-fail=${stats.imgFail} of ${stats.rows}`);

  console.log('\n=== F. Category resolution ===');
  console.log(`unmapped(exact)=${stats.unmappedExact}  recoverable-if-normalized=${stats.recoverableNormalized}  truly-unmapped=${stats.trulyUnmapped}`);
  if (sample.recoverable.length) console.log('  RECOVERABLE (whitespace/case near-miss — would map if normalized!):\n   ' + sample.recoverable.join('\n   '));
  console.log('  top truly-unmapped (category / subcategory):');
  [...sample.truly.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, c]) => console.log(`   ${String(c).padStart(5)}  ${k}`));

  console.log('\n=== G. Invalid (name empty or mrp<=0/NaN) ===');
  console.log(`invalid=${stats.invalidNameOrMrp}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
