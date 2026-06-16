# Blinkit Bulk-Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the 141,405-row Blinkit CSV into the PAS master catalog (`Product` rows only) — categorized, veg-derived, idempotent, resumable — ready for the merchant picker.

**Architecture:** A local streaming Node CLI (`npx tsx`) parses the 165 MB CSV row-by-row with `csv-parse`, transforms each row via pure functions (category resolution, veg derivation, field mapping), and upserts in batches via the Prisma client keyed on `sourceProductId` (`@unique`). Pure transform logic lives in `src/blinkitLoader/` and is unit-tested with the built-in `node:test` runner; the CLI shell in `scripts/` is validated via `--dry-run` then `--limit`.

**Tech Stack:** TypeScript, `tsx` (via npx), `csv-parse` (new dep), Prisma (`@prisma/client` 5.22), `node:test` + `node:assert`, PostgreSQL.

**Spec:** `docs/blinkit-bulk-loader-spec-2026-06-16.html`

**Decisions baked in:** lazy/on-list image re-host (store grofers URL only) · siblings deferred (data → `extraData`) · default-VEG for unsignalled food · **skip** unmapped-category rows · `mrp`=ceiling, Blinkit `price`→`extraData.suggestedPrice` (clamped ≤ mrp) · veg stored in a new `Product.isVeg` tri-state column.

**Out of scope (separate work):** lazy re-host mechanism, sibling linkage UI, FSSAI listing gate, MRP-ceiling listing guard, the picker, the consumer veg filter.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/blinkitLoader/types.ts` | Shared types: `BlinkitRow`, `CategoryResolution`, `ProductUpsert`. |
| `apps/api/src/blinkitLoader/vegRules.ts` | Non-veg keyword/subcategory data + `hasNonVegSignal` + `deriveVeg` (pure). |
| `apps/api/src/blinkitLoader/vegRules.test.ts` | `node:test` unit tests for veg derivation. |
| `apps/api/src/blinkitLoader/transform.ts` | Pure helpers: `parseQuantity`, `clampSuggestedPrice`, `firstImage`, `safeJson`, `mapRowToProduct`. |
| `apps/api/src/blinkitLoader/transform.test.ts` | `node:test` unit tests for the transforms. |
| `apps/api/scripts/migrate_add_product_isveg.ts` | Additive migration: `Product.isVeg` column. |
| `apps/api/scripts/load_blinkit_catalog.ts` | CLI shell: args, CSV stream, CategoryMapping/Vertical preload, batched upsert, reporting. |

All commands run from `apps/api`.

---

## Task 1: Add the `csv-parse` dependency

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install csv-parse**

Run: `cd apps/api && npm install csv-parse@5`
Expected: `package.json` gains `"csv-parse": "^5.x"` under dependencies; no errors.

- [ ] **Step 2: Verify it imports**

Run: `cd apps/api && npx tsx -e "import {parse} from 'csv-parse'; console.log(typeof parse)"`
Expected: prints `function`

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json
git commit -m "chore(api): add csv-parse for the Blinkit bulk loader"
```

---

## Task 2: Add the `Product.isVeg` column (additive migration)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (Product model)
- Create: `apps/api/scripts/migrate_add_product_isveg.ts`

- [ ] **Step 1: Add the field to the Prisma schema**

In `apps/api/prisma/schema.prisma`, inside `model Product`, immediately after the `returnable` field, add:

```prisma
  // Phase 4 (2026-06-17): tri-state derived dietary flag. true=veg, false=non-veg,
  // NULL=unknown/non-food. Written by the Blinkit loader; the consumer veg filter
  // (sub-project 3) reads it. Replaces the older extraData.isVeg convention.
  isVeg            Boolean?          @map("is_veg")
```

- [ ] **Step 2: Write the migration script**

Create `apps/api/scripts/migrate_add_product_isveg.ts`:

```ts
// Phase 4: additive Product.is_veg column (nullable tri-state). Reversible:
// ALTER TABLE "Product" DROP COLUMN is_veg;
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE public."Product" ADD COLUMN IF NOT EXISTS is_veg boolean;`
  );
  const col: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Product' AND column_name='is_veg';
  `);
  console.table(col);
  if (col[0]?.is_nullable !== 'YES') throw new Error('is_veg not added as nullable');
  console.log('  ✓ Product.is_veg added (nullable)');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Apply the migration (GATED — needs Pranav's explicit go)**

Run: `cd apps/api && npx tsx scripts/migrate_add_product_isveg.ts`
Expected: table prints `is_veg | boolean | YES`; logs `✓ Product.is_veg added (nullable)`.

- [ ] **Step 4: Regenerate the Prisma client + typecheck**

Run: `cd apps/api && npx prisma generate && npx tsc --noEmit`
Expected: client regenerated; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/scripts/migrate_add_product_isveg.ts
git commit -m "feat(api): Phase 4 — add Product.isVeg tri-state column (additive)"
```

---

## Task 3: Veg derivation (`vegRules.ts`) — TDD

**Files:**
- Create: `apps/api/src/blinkitLoader/vegRules.ts`
- Test: `apps/api/src/blinkitLoader/vegRules.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/blinkitLoader/vegRules.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert';
import { deriveVeg } from './vegRules';

test('non-food → NULL (no dot)', () => {
  assert.strictEqual(deriveVeg({ isFood: false, name: 'USB Cable', subcategory: 'Mobile Accessories' }), null);
});
test('food + chicken → false (non-veg)', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Chicken Curry Cut', subcategory: 'Chicken, Meat & Fish' }), false);
});
test('food + Eggs subcategory → false', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Farm Eggs 6 pcs', subcategory: 'Eggs' }), false);
});
test('food + "eggplant" → true (egg keyword must NOT match eggplant)', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Eggplant / Brinjal', subcategory: 'Fruits & Vegetables' }), true);
});
test('food + "eggless cake" → true', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Eggless Chocolate Cake', subcategory: 'Bakery' }), true);
});
test('food + plain dal → true (default veg)', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Tata Sampann Toor Dal', subcategory: 'Atta, Rice & Dal' }), true);
});
test('food + fish in name → false', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Fish Finger Frozen', subcategory: 'Frozen Veg' }), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && npx tsx --test src/blinkitLoader/vegRules.test.ts`
Expected: FAIL — `Cannot find module './vegRules'`.

- [ ] **Step 3: Implement `vegRules.ts`**

Create `apps/api/src/blinkitLoader/vegRules.ts`:

```ts
// Pure veg derivation for the Blinkit loader. Tri-state: true / false / null.
// Decision (spec §6): default-VEG for unsignalled food; non-food → null (no dot).

export const NON_VEG_SUBCATEGORIES = new Set<string>([
  'Chicken, Meat & Fish',
  'Frozen Non-Veg',
  'Fish & Seafood',
  'Sausages, Salami & Ham',
  'Eggs',
]);

// Word-boundary, case-insensitive. `eggs?` matches egg/eggs but NOT eggplant/eggless
// (no word boundary after "egg" in those). Tune via the dry-run distribution.
const NON_VEG_PATTERN =
  /\b(chicken|mutton|fish|prawns?|shrimps?|seafood|crabs?|meat|eggs?|anda|pork|bacon|hams?|sausages?|salami|keema|fillets?|lamb|tuna|squid|octopus)\b/i;

export function hasNonVegSignal(name: string, subcategory: string | null): boolean {
  if (subcategory && NON_VEG_SUBCATEGORIES.has(subcategory)) return true;
  return NON_VEG_PATTERN.test(`${name} ${subcategory ?? ''}`);
}

export function deriveVeg(args: { isFood: boolean; name: string; subcategory: string | null }): boolean | null {
  if (!args.isFood) return null;                                   // non-food → unknown, no dot
  if (hasNonVegSignal(args.name, args.subcategory)) return false;  // explicit non-veg signal
  return true;                                                     // default-veg for unsignalled food
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && npx tsx --test src/blinkitLoader/vegRules.test.ts`
Expected: PASS — `# pass 7`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/blinkitLoader/vegRules.ts apps/api/src/blinkitLoader/vegRules.test.ts
git commit -m "feat(api): Blinkit loader veg derivation (default-veg, word-boundary keywords)"
```

---

## Task 4: Types + transform helpers (`parseQuantity`, `clampSuggestedPrice`) — TDD

**Files:**
- Create: `apps/api/src/blinkitLoader/types.ts`
- Create: `apps/api/src/blinkitLoader/transform.ts`
- Test: `apps/api/src/blinkitLoader/transform.test.ts`

- [ ] **Step 1: Write the types**

Create `apps/api/src/blinkitLoader/types.ts`:

```ts
// Raw CSV row (csv-parse with columns:true yields string fields).
export interface BlinkitRow {
  product_id: string;
  name: string;
  mrp: string;
  price: string;
  brand: string;
  images: string;     // JSON array string of URLs
  deeplink: string;
  quantity: string;
  category: string;
  subcategory: string;
  data_dump: string;  // JSON string (siblings, rating, etc.)
}

// Result of resolving a (category, subcategory) pair against CategoryMapping.
export interface CategoryResolution {
  vertical_id: string;
  category_id: string;
  requiresFssai: boolean;
}

// The payload we upsert into Product (Prisma field names).
export interface ProductUpsert {
  name: string;
  mrp: number;
  brand: string | null;
  image: string | null;
  uom: string | null;
  unitType: string | null;
  unitValue: number | null;
  subcategory: string | null;
  source: 'blinkit';
  sourceProductId: string;
  vertical_id: string;
  category_id: string;
  isVeg: boolean | null;
  productUrl: string | null;
  avgRating: number | null;
  numberOfRatings: number | null;
  extraData: Record<string, unknown>;
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/blinkitLoader/transform.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert';
import { parseQuantity, clampSuggestedPrice } from './transform';

test('parseQuantity "500 g"', () => {
  assert.deepStrictEqual(parseQuantity('500 g'), { uom: '500 g', unitValue: 500, unitType: 'g' });
});
test('parseQuantity "1.5 kg"', () => {
  assert.deepStrictEqual(parseQuantity('1.5 kg'), { uom: '1.5 kg', unitValue: 1.5, unitType: 'kg' });
});
test('parseQuantity unparseable keeps raw uom', () => {
  assert.deepStrictEqual(parseQuantity('Combo Pack'), { uom: 'Combo Pack', unitValue: null, unitType: null });
});
test('parseQuantity null → all null', () => {
  assert.deepStrictEqual(parseQuantity(null), { uom: null, unitValue: null, unitType: null });
});
test('clampSuggestedPrice keeps discounted price', () => {
  assert.strictEqual(clampSuggestedPrice(349, 649), 349);
});
test('clampSuggestedPrice clamps price>mrp to mrp', () => {
  assert.strictEqual(clampSuggestedPrice(700, 500), 500);
});
test('clampSuggestedPrice junk/zero falls back to mrp', () => {
  assert.strictEqual(clampSuggestedPrice(0, 500), 500);
  assert.strictEqual(clampSuggestedPrice(NaN, 500), 500);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/api && npx tsx --test src/blinkitLoader/transform.test.ts`
Expected: FAIL — `Cannot find module './transform'`.

- [ ] **Step 4: Implement the helpers in `transform.ts`**

Create `apps/api/src/blinkitLoader/transform.ts`:

```ts
import { BlinkitRow, CategoryResolution, ProductUpsert } from './types';
import { deriveVeg } from './vegRules';

export function parseQuantity(raw: string | null): { uom: string | null; unitValue: number | null; unitType: string | null } {
  if (!raw || !raw.trim()) return { uom: null, unitValue: null, unitType: null };
  const uom = raw.trim();
  const m = uom.match(/^([\d.]+)\s*(kg|g|gm|gms|ml|l|ltr|litre|pcs|pc|piece|pieces|pack)\b/i);
  if (!m) return { uom, unitValue: null, unitType: null };
  const unitValue = parseFloat(m[1]);
  return { uom, unitValue: Number.isFinite(unitValue) ? unitValue : null, unitType: m[2].toLowerCase() };
}

export function clampSuggestedPrice(price: number, mrp: number): number {
  if (!Number.isFinite(price) || price <= 0) return mrp;  // junk → fall back to the ceiling
  return Math.min(price, mrp);                            // never above mrp
}

export function firstImage(imagesRaw: string | null): string | null {
  const arr = safeJson<unknown>(imagesRaw);
  if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') return arr[0] as string;
  if (typeof imagesRaw === 'string' && imagesRaw.startsWith('http')) return imagesRaw.trim();
  return null;
}

export function safeJson<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/api && npx tsx --test src/blinkitLoader/transform.test.ts`
Expected: PASS — `# pass 7`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/blinkitLoader/types.ts apps/api/src/blinkitLoader/transform.ts apps/api/src/blinkitLoader/transform.test.ts
git commit -m "feat(api): Blinkit loader transform helpers (quantity, price clamp, image, json)"
```

---

## Task 5: `mapRowToProduct` — TDD

**Files:**
- Modify: `apps/api/src/blinkitLoader/transform.ts`
- Modify: `apps/api/src/blinkitLoader/transform.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `apps/api/src/blinkitLoader/transform.test.ts`:

```ts
import { mapRowToProduct } from './transform';
import { BlinkitRow, CategoryResolution } from './types';

const ROW: BlinkitRow = {
  product_id: 'blk_123', name: ' Tata Toor Dal ', mrp: '244.00', price: '210.00', brand: 'Tata Sampann',
  images: '["https://cdn.grofers.com/a.jpg","https://cdn.grofers.com/b.jpg"]',
  deeplink: 'https://blinkit.com/prn/x/prid/123', quantity: '1 kg', category: 'Atta, Rice & Dal',
  subcategory: 'Toor & Arhar Dal',
  data_dump: '{"siblings":["blk_123","blk_999"],"parentIndex":0,"childIndex":1,"rating":4.3,"ratingCount":58}',
};
const CAT: CategoryResolution = { vertical_id: 'v-1', category_id: 'c-1', requiresFssai: true };

test('mapRowToProduct maps + derives correctly', () => {
  const p = mapRowToProduct(ROW, CAT);
  assert.strictEqual(p.name, 'Tata Toor Dal');
  assert.strictEqual(p.mrp, 244);
  assert.strictEqual(p.sourceProductId, 'blk_123');
  assert.strictEqual(p.source, 'blinkit');
  assert.strictEqual(p.vertical_id, 'v-1');
  assert.strictEqual(p.category_id, 'c-1');
  assert.strictEqual(p.image, 'https://cdn.grofers.com/a.jpg');     // first image only
  assert.strictEqual(p.uom, '1 kg');
  assert.strictEqual(p.unitValue, 1);
  assert.strictEqual(p.unitType, 'kg');
  assert.strictEqual(p.isVeg, true);                                // food + no non-veg signal
  assert.strictEqual(p.productUrl, 'https://blinkit.com/prn/x/prid/123');
  assert.strictEqual(p.avgRating, 4.3);
  assert.strictEqual(p.numberOfRatings, 58);
  assert.strictEqual((p.extraData as any).suggestedPrice, 210);     // price ≤ mrp
  assert.deepStrictEqual((p.extraData as any).siblings, ['blk_123', 'blk_999']);
  assert.strictEqual((p.extraData as any).childIndex, 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx tsx --test src/blinkitLoader/transform.test.ts`
Expected: FAIL — `mapRowToProduct is not a function` (or import error).

- [ ] **Step 3: Implement `mapRowToProduct`**

Append to `apps/api/src/blinkitLoader/transform.ts`:

```ts
function numOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
}

export function mapRowToProduct(row: BlinkitRow, cat: CategoryResolution): ProductUpsert {
  const mrp = parseFloat(row.mrp);
  const suggestedPrice = clampSuggestedPrice(parseFloat(row.price), mrp);
  const { uom, unitValue, unitType } = parseQuantity(row.quantity);
  const dump = safeJson<Record<string, unknown>>(row.data_dump) ?? {};
  return {
    name: (row.name || '').trim(),
    mrp,
    brand: row.brand?.trim() || null,
    image: firstImage(row.images),
    uom, unitType, unitValue,
    subcategory: row.subcategory?.trim() || null,
    source: 'blinkit',
    sourceProductId: row.product_id,
    vertical_id: cat.vertical_id,
    category_id: cat.category_id,
    isVeg: deriveVeg({ isFood: cat.requiresFssai, name: row.name || '', subcategory: row.subcategory?.trim() || null }),
    productUrl: row.deeplink?.trim() || null,
    avgRating: numOrNull(dump.rating),
    numberOfRatings: intOrNull((dump as any).ratingCount ?? (dump as any).rating_count),
    extraData: {
      suggestedPrice,
      siblings: (dump as any).siblings ?? null,
      parentIndex: (dump as any).parentIndex ?? null,
      childIndex: (dump as any).childIndex ?? null,
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/api && npx tsx --test src/blinkitLoader/transform.test.ts`
Expected: PASS — all transform tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/blinkitLoader/transform.ts apps/api/src/blinkitLoader/transform.test.ts
git commit -m "feat(api): Blinkit loader mapRowToProduct (full Blinkit→Product mapping)"
```

---

## Task 6: The loader CLI (`load_blinkit_catalog.ts`)

**Files:**
- Create: `apps/api/scripts/load_blinkit_catalog.ts`

This is the integration shell — validated by dry-run (Task 7), not a unit test.

- [ ] **Step 1: Write the CLI**

Create `apps/api/scripts/load_blinkit_catalog.ts`:

```ts
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

async function flush(batch: ProductUpsert[]) {
  if (DRY_RUN || batch.length === 0) return;
  try {
    await prisma.$transaction(batch.map((p) => prisma.product.upsert({
      where: { sourceProductId: p.sourceProductId },
      create: p as any,
      update: {
        name: p.name, mrp: p.mrp, brand: p.brand, image: p.image, uom: p.uom, unitType: p.unitType,
        unitValue: p.unitValue, subcategory: p.subcategory, vertical_id: p.vertical_id,
        category_id: p.category_id, isVeg: p.isVeg, productUrl: p.productUrl, avgRating: p.avgRating,
        numberOfRatings: p.numberOfRatings, extraData: p.extraData as any, updatedAt: new Date(),
      },
    })));
  } catch (e: any) {
    // Isolate the offender: retry row-by-row so one bad row doesn't lose the batch.
    for (const p of batch) {
      try {
        await prisma.product.upsert({ where: { sourceProductId: p.sourceProductId }, create: p as any,
          update: { name: p.name, mrp: p.mrp, isVeg: p.isVeg, extraData: p.extraData as any, updatedAt: new Date() } });
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
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/load_blinkit_catalog.ts
git commit -m "feat(api): Blinkit bulk-loader CLI (streaming, batched upsert, dry-run)"
```

---

## Task 7: Dry-run on the full file → review (GATE)

**Files:** none (read-only run).

- [ ] **Step 1: Dry-run the full CSV**

Run: `cd apps/api && npx tsx scripts/load_blinkit_catalog.ts --file "/Users/pranavaditya/Desktop/WORK/ALL PROJECTS/PAS/Datasets/Blinkit Data.csv" --dry-run`
Expected: a summary with `mode DRY-RUN`, `rows read 141405`, a `loaded` count, an `skipped unmapped` count, and a veg distribution. **No DB writes.**

- [ ] **Step 2: Review the report (decision point)**

Check with Pranav:
- **Category hit-rate** = loaded / (loaded + skippedUnmapped). If a large fraction is unmapped (beyond the known ~325 NULL + 13 pending), extend `CategoryMapping` before the real load rather than dropping data.
- **Veg distribution** — does veg/non-veg/unknown look sane? If non-veg is suspiciously low, tune `NON_VEG_PATTERN`/`NON_VEG_SUBCATEGORIES` in `vegRules.ts` (re-run dry-run; the unit tests guard regressions).

No commit (read-only).

---

## Task 8: `--limit 100` real load → spot-check (GATE)

**Files:** none (writes 100 rows).

- [ ] **Step 1: Load the first 100 rows for real (GATED — explicit go)**

Run: `cd apps/api && npx tsx scripts/load_blinkit_catalog.ts --file "/Users/pranavaditya/Desktop/WORK/ALL PROJECTS/PAS/Datasets/Blinkit Data.csv" --limit 100`
Expected: `mode LIVE`, ~100 loaded (minus any unmapped), 0 errors.

- [ ] **Step 2: Spot-check the inserted rows**

Run:
```bash
cd apps/api && npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); (async()=>{ const r=await p.\$queryRawUnsafe(\`SELECT name, mrp, is_veg, vertical_id, category_id, uom, image, extra_data->>'suggestedPrice' AS sugg FROM \\\"Product\\\" WHERE source='blinkit' ORDER BY \\\"createdAt\\\" DESC LIMIT 10\`); console.table(r); const c=await p.\$queryRawUnsafe(\`SELECT COUNT(*)::int n, COUNT(vertical_id)::int with_vert, COUNT(is_veg)::int with_veg FROM \\\"Product\\\" WHERE source='blinkit'\`); console.log(c[0]); await p.\$disconnect(); })()"
```
Expected: rows show real names, mrp, is_veg (t/f/null), non-null vertical_id/category_id, a uom, a grofers image URL, a suggestedPrice ≤ mrp.

- [ ] **Step 3: Idempotency check — re-run the same 100**

Run: `cd apps/api && npx tsx scripts/load_blinkit_catalog.ts --file "/Users/pranavaditya/Desktop/WORK/ALL PROJECTS/PAS/Datasets/Blinkit Data.csv" --limit 100`
Then re-run the count from Step 2.
Expected: the `blinkit` product count is **unchanged** (upsert, no duplicates).

No commit (data only).

---

## Task 9: Full load (GATED — Pranav's explicit go only)

**Files:** none.

- [ ] **Step 1: Run the full load**

Run: `cd apps/api && npx tsx scripts/load_blinkit_catalog.ts --file "/Users/pranavaditya/Desktop/WORK/ALL PROJECTS/PAS/Datasets/Blinkit Data.csv" --skip-existing`
Expected: streams all 141,405; final summary with the loaded total + skip/error counts. Resumable — re-run with `--skip-existing` if interrupted.

- [ ] **Step 2: Verify final state**

Run:
```bash
cd apps/api && npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); (async()=>{ const c=await p.\$queryRawUnsafe(\`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE is_veg=true)::int veg, COUNT(*) FILTER (WHERE is_veg=false)::int nonveg, COUNT(*) FILTER (WHERE is_veg IS NULL)::int unk, COUNT(DISTINCT vertical_id)::int verticals FROM \\\"Product\\\" WHERE source='blinkit'\`); console.log(c[0]); await p.\$disconnect(); })()"
```
Expected: totals match the dry-run prediction; veg distribution + vertical count sane.

- [ ] **Step 3: Record outcome**

Update `forlater.md` Phase 4 section with the final loaded/skipped counts. Note the deferred "delete old `source='zepto'` data" can now proceed (separate task). Commit the doc update.

```bash
git add forlater.md
git commit -m "docs: record Blinkit full-load outcome (Phase 4 sub-project 1)"
```

---

## Self-Review

- **Spec coverage:** streaming CLI (Task 6) ✓ · category resolution + skip-unmapped (Task 6) ✓ · veg derivation (Task 3) ✓ · field mapping incl. mrp/suggestedPrice/uom/image/siblings (Task 5) ✓ · `Product.isVeg` column (Task 2) ✓ · idempotency/resume via sourceProductId (Task 6) ✓ · per-batch commit (Task 6 `flush`) ✓ · dry-run + reporting (Task 6/7) ✓ · error isolation (Task 6 `flush` catch) ✓ · reversibility (`source='blinkit'`, Task 9 note) ✓ · testing plan (Tasks 7–9) ✓. Out-of-scope items (lazy re-host mechanism, siblings UI, FSSAI gate, MRP-ceiling guard) are intentionally absent.
- **Placeholder scan:** no TBD/TODO; every code step has complete code; every command is exact.
- **Type consistency:** `BlinkitRow`/`CategoryResolution`/`ProductUpsert` defined in Task 4 are used unchanged in Tasks 5–6; `deriveVeg` signature matches across Task 3 and Task 5; Prisma field names (`vertical_id`, `category_id`, `isVeg`, `sourceProductId`, `productUrl`, `avgRating`, `numberOfRatings`, `extraData`) verified against the live schema.

---

## Notes for the executor

- All `node:test` files run with `npx tsx --test <file>` (the project's established pattern — no jest/vitest).
- Tasks 2, 8, 9 touch the **production DB** — apply only on Pranav's explicit per-step go (the migration-confirmation rule).
- The full load (Task 9) is the only heavy operation; everything before it is fast or read-only.
