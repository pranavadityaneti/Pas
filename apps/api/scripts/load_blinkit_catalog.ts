// Phase 4 Blinkit bulk-loader. Streams the CSV, resolves category via
// CategoryMapping, derives veg, maps fields, upserts Product by sourceProductId.
// Usage:
//   npx tsx scripts/load_blinkit_catalog.ts --file "<path>" --dry-run
//   npx tsx scripts/load_blinkit_catalog.ts --file "<path>" --limit 100
//   npx tsx scripts/load_blinkit_catalog.ts --file "<path>" --skip-existing
import fs from 'node:fs';
import { parse } from 'csv-parse';
import { PrismaClient } from '@prisma/client';
import { BlinkitRow, CategoryResolution, ProductUpsert } from '../src/blinkitLoader/types';
import { mapRowToProduct } from '../src/blinkitLoader/transform';

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (flag: string) => process.argv.includes(flag);

const FILE = arg('--file');
const DRY_RUN = has('--dry-run');
const LIMIT = arg('--limit') ? parseInt(arg('--limit')!, 10) : Infinity;
const BATCH = arg('--batch-size') ? parseInt(arg('--batch-size')!, 10) : 500;
const SKIP_EXISTING = has('--skip-existing');

async function preloadCategoryMap(): Promise<Map<string, CategoryResolution>> {
  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT cm.source_category, cm.source_subcategory, cm.vertical_id::text AS vertical_id,
           cm.category_id::text AS category_id, COALESCE(v."requiresFssai", false) AS requires_fssai
    FROM "CategoryMapping" cm
    JOIN "Vertical" v ON v.id = cm.vertical_id
    WHERE cm.source_platform = 'BLINKIT' AND cm.status = 'ACTIVE'
      AND cm.vertical_id IS NOT NULL AND cm.category_id IS NOT NULL;
  `);
  const map = new Map<string, CategoryResolution>();
  for (const r of rows) {
    map.set(`${r.source_category}|||${r.source_subcategory}`,
      { vertical_id: r.vertical_id, category_id: r.category_id, requiresFssai: !!r.requires_fssai });
  }
  return map;
}

async function preloadExistingIds(): Promise<Set<string>> {
  if (!SKIP_EXISTING) return new Set();
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT source_product_id FROM "Product" WHERE source = 'blinkit' AND source_product_id IS NOT NULL;`
  );
  return new Set(rows.map((r) => r.source_product_id));
}

const stats = { read: 0, loaded: 0, skippedUnmapped: 0, skippedDup: 0, skippedInvalid: 0, errors: 0,
  veg: 0, nonVeg: 0, unknownVeg: 0, perVertical: {} as Record<string, number>, errorSamples: [] as string[] };

// Bulk insert — ONE multi-row INSERT per batch (one DB round-trip), not 500
// individual upserts (which over remote latency took minutes/batch). skipDuplicates
// makes it idempotent on the sourceProductId unique key: a re-run skips rows already
// loaded. This is INSERT-only (no update of existing rows) — correct for the initial
// fresh load. A future "refresh Blinkit data" that must UPDATE existing rows would
// need a raw `INSERT ... ON CONFLICT DO UPDATE` path; out of scope for the first load.
async function flush(batch: ProductUpsert[]) {
  if (DRY_RUN || batch.length === 0) return;
  try {
    await prisma.product.createMany({ data: batch as any, skipDuplicates: true });
  } catch (e: any) {
    // Batch failed on something other than a duplicate (skipDuplicates handles dups
    // silently) — isolate the offender row-by-row so one bad row doesn't lose the batch.
    for (const p of batch) {
      try {
        await prisma.product.createMany({ data: [p as any], skipDuplicates: true });
      } catch (rowErr: any) {
        stats.errors++;
        if (stats.errorSamples.length < 20) stats.errorSamples.push(`${p.sourceProductId}: ${rowErr?.message?.split('\n')[0]}`);
      }
    }
  }
}

async function main() {
  if (!FILE) throw new Error('--file <path> is required');
  console.log(`Blinkit loader — file=${FILE} dryRun=${DRY_RUN} limit=${LIMIT} batch=${BATCH} skipExisting=${SKIP_EXISTING}`);

  const catMap = await preloadCategoryMap();
  console.log(`  CategoryMapping: ${catMap.size} active BLINKIT pairs`);
  const existing = await preloadExistingIds();
  if (SKIP_EXISTING) console.log(`  preloaded ${existing.size} existing blinkit ids to skip`);

  const seen = new Set<string>();
  let batch: ProductUpsert[] = [];

  const parser = fs.createReadStream(FILE).pipe(parse({ columns: true, relax_quotes: true, skip_empty_lines: true }));

  for await (const row of parser as AsyncIterable<BlinkitRow>) {
    if (stats.read >= LIMIT) break;
    stats.read++;

    // in-file dedup + resume skip
    if (!row.product_id) { stats.skippedInvalid++; continue; }
    if (seen.has(row.product_id)) { stats.skippedDup++; continue; }
    seen.add(row.product_id);
    if (SKIP_EXISTING && existing.has(row.product_id)) { continue; }

    // category resolution (skip unmapped)
    const cat = catMap.get(`${row.category}|||${row.subcategory}`);
    if (!cat) { stats.skippedUnmapped++; continue; }

    // validity
    const mrp = parseFloat(row.mrp);
    if (!row.name?.trim() || !Number.isFinite(mrp) || mrp <= 0) { stats.skippedInvalid++; continue; }

    const product = mapRowToProduct(row, cat);
    if (product.isVeg === true) stats.veg++; else if (product.isVeg === false) stats.nonVeg++; else stats.unknownVeg++;
    stats.perVertical[cat.vertical_id] = (stats.perVertical[cat.vertical_id] || 0) + 1;
    stats.loaded++;

    batch.push(product);
    if (batch.length >= BATCH) { await flush(batch); batch = []; }
    if (stats.read % 10000 === 0) console.log(`  …${stats.read} read / ${stats.loaded} loaded / ${stats.skippedUnmapped} unmapped`);
  }
  await flush(batch);

  console.log('\n==== BLINKIT LOAD SUMMARY ====');
  console.log(`mode ................. ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);
  console.log(`rows read ............ ${stats.read}`);
  console.log(`loaded (upserts) ..... ${stats.loaded}`);
  console.log(`skipped unmapped ..... ${stats.skippedUnmapped}`);
  console.log(`skipped dup-in-file .. ${stats.skippedDup}`);
  console.log(`skipped invalid ...... ${stats.skippedInvalid}`);
  console.log(`errors ............... ${stats.errors}`);
  console.log(`veg / non-veg / unk .. ${stats.veg} / ${stats.nonVeg} / ${stats.unknownVeg}`);
  console.log(`distinct verticals ... ${Object.keys(stats.perVertical).length}`);
  if (stats.errorSamples.length) console.log('error samples:\n  ' + stats.errorSamples.join('\n  '));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
