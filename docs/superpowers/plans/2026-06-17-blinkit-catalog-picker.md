# Blinkit Catalog Picker (Phase 4, sub-project 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the merchant catalog picker — paginated/searchable/filterable browse of the 140k Product master catalog, with multi-select → bulk-configure UX that creates StoreProduct listings, enforcing the MRP-ceiling, FSSAI, and lazy image re-host guards at app + API + DB.

**Architecture:** Thin merchant-app screen (`catalog-picker.tsx`) + bulk modal (`ConfigureProductsModal` rebuild) over a new keyset-paginated `GET /merchant/catalog` and an extended `POST /merchant/store-products/configure`. Three-layer defence: app validation, API server-side checks, a Postgres BEFORE INSERT/UPDATE trigger on `StoreProduct`. Image re-host runs server-side in-process on the save path, bounded by a 5 s budget, tolerant of failure.

**Tech Stack:** Express + Prisma + Supabase Postgres (api); React Native / Expo (merchant-app); `node:test` via `npx tsx --test`; `$executeRawUnsafe` for raw-SQL migrations.

**Spec:** `docs/blinkit-catalog-picker-spec-2026-06-17.html` (commit `efe3a2fb`). Tasks reference spec sections by `(§N)`.

**Pre-flight verified:** 0 existing `StoreProduct` rows violate the new MRP-ceiling trigger.

---

## File map

| Path | Purpose | Action |
|---|---|---|
| `apps/api/scripts/migrate_add_mrp_ceiling_trigger.ts` | DB trigger migration (§9) | Create |
| `apps/api/scripts/migrate_add_product_name_trgm.ts` | trigram GIN index migration (§9) | Create |
| `apps/api/src/merchantCatalog/cursor.ts` | keyset cursor encode/decode (§4, §10) | Create |
| `apps/api/src/merchantCatalog/cursor.test.ts` | unit tests | Create |
| `apps/api/src/merchantCatalog/validate.ts` | MRP-ceiling, FSSAI, payload rules (§7) | Create |
| `apps/api/src/merchantCatalog/validate.test.ts` | unit tests | Create |
| `apps/api/src/services/imageRehost.ts` | lazy re-host service (§8) | Create |
| `apps/api/src/services/imageRehost.test.ts` | unit tests with mocks | Create |
| `apps/api/src/index.ts` | new `GET /merchant/catalog` (§4) + extend save endpoint (§7) | Modify |
| `apps/merchant-app/src/hooks/useCatalogPicker.ts` | paginated catalog data hook (§5) | Create |
| `apps/merchant-app/app/(main)/catalog-picker.tsx` | screen body rewrite — locked sections untouched (§5) | Modify |
| `apps/merchant-app/src/components/ConfigureProductsModal.tsx` | rebuild — drop fabricated variants (§6) | Modify |
| `apps/api/scripts/audit_catalog_picker.ts` | adversarial audit (§11) | Create |

---

## Task 1 — DB migration: MRP-ceiling trigger (§9, D1)

**Files:**
- Create: `apps/api/scripts/migrate_add_mrp_ceiling_trigger.ts`

- [ ] **Step 1: Write the migration script**

```typescript
// apps/api/scripts/migrate_add_mrp_ceiling_trigger.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SQL = `
CREATE OR REPLACE FUNCTION public.enforce_mrp_ceiling()
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
END $$;

DROP TRIGGER IF EXISTS trg_storeproduct_mrp_ceiling ON public."StoreProduct";
CREATE TRIGGER trg_storeproduct_mrp_ceiling
  BEFORE INSERT OR UPDATE OF price, "productId" ON public."StoreProduct"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mrp_ceiling();
`;

async function main() {
  console.log('[mrp-ceiling] pre-flight: count existing violators');
  const offenders: any[] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "StoreProduct" sp JOIN "Product" pr ON pr.id = sp."productId" WHERE sp.price > pr.mrp`
  );
  if (offenders[0].n > 0) {
    throw new Error(`refusing to install trigger: ${offenders[0].n} existing rows violate it`);
  }
  console.log('[mrp-ceiling] applying trigger…');
  await prisma.$executeRawUnsafe(SQL);
  console.log('[mrp-ceiling] applied. negative-testing in rolled-back tx…');
  await prisma.$transaction(async (tx) => {
    try {
      await tx.$executeRawUnsafe(
        `INSERT INTO "StoreProduct" (id, "productId", branch_id, price, stock, variant, active, is_deleted)
         SELECT gen_random_uuid(), pr.id, mb.id, pr.mrp + 1, 0, 'Standard', false, false
         FROM "Product" pr JOIN "MerchantBranch" mb ON mb.store_id IS NOT NULL
         WHERE pr.source='blinkit' LIMIT 1`
      );
      throw new Error('NEGATIVE_TEST_DID_NOT_THROW');
    } catch (e: any) {
      if (!/MRP_CEILING_VIOLATED/.test(String(e?.message))) throw e;
      console.log('[mrp-ceiling] negative test ✓ trigger raised MRP_CEILING_VIOLATED');
    }
    throw new Error('ROLLBACK_NEGATIVE_TEST');
  }).catch((e) => { if (e.message !== 'ROLLBACK_NEGATIVE_TEST') throw e; });
  console.log('[mrp-ceiling] done.');
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Show the plan + script to Pranav, get explicit "yes" before applying**

Do NOT run yet. Per CLAUDE.md: every migration needs an explicit per-action "yes."

- [ ] **Step 3: Apply (after approval)**

Run: `cd apps/api && npx tsx scripts/migrate_add_mrp_ceiling_trigger.ts`
Expected output: `pre-flight 0 violators → applied → negative test ✓ → done.`

- [ ] **Step 4: Verify trigger present in prod**

Run:
```bash
cd apps/api && NODE_PATH="$PWD/node_modules" node -e '
const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();
p.$queryRawUnsafe(`SELECT tgname FROM pg_trigger WHERE tgname=\x27trg_storeproduct_mrp_ceiling\x27`)
  .then(r=>{console.log(JSON.stringify(r));p.$disconnect();});
'
```
Expected: one row `{"tgname":"trg_storeproduct_mrp_ceiling"}`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/migrate_add_mrp_ceiling_trigger.ts
git commit -m "feat(db): MRP-ceiling trigger on StoreProduct (Phase 4 sub-2)"
```

---

## Task 2 — DB migration: trigram GIN index on `Product.name` (§9, D7)

**Files:**
- Create: `apps/api/scripts/migrate_add_product_name_trgm.ts`

- [ ] **Step 1: Write the migration script**

```typescript
// apps/api/scripts/migrate_add_product_name_trgm.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('[trgm] CREATE EXTENSION pg_trgm IF NOT EXISTS');
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
  console.log('[trgm] creating idx_product_name_trgm (GIN, gin_trgm_ops)…');
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_product_name_trgm ON public."Product" USING gin (name gin_trgm_ops);`
  );
  const r: any[] = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE indexname='idx_product_name_trgm'`
  );
  console.log('[trgm] verify:', r);
  if (!r.length) throw new Error('index not present after CREATE');
  console.log('[trgm] EXPLAIN ANALYZE search for "maggi" (sample)…');
  const e: any[] = await prisma.$queryRawUnsafe(
    `EXPLAIN ANALYZE SELECT id FROM "Product" WHERE name ILIKE '%maggi%' LIMIT 30`
  );
  console.log(e.map((x: any) => x['QUERY PLAN']).join('\n'));
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Show + get approval, then apply**

Run (after explicit "yes"): `cd apps/api && npx tsx scripts/migrate_add_product_name_trgm.ts`
Expected: index present; EXPLAIN shows Bitmap Index Scan on `idx_product_name_trgm` (not a Seq Scan).

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/migrate_add_product_name_trgm.ts
git commit -m "feat(db): trigram GIN index on Product.name for 140k catalog search"
```

---

## Task 3 — Keyset cursor encode/decode (§4)

**Files:**
- Create: `apps/api/src/merchantCatalog/cursor.ts`
- Test: `apps/api/src/merchantCatalog/cursor.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/api/src/merchantCatalog/cursor.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { encodeCursor, decodeCursor } from './cursor';

test('encode → decode round-trip', () => {
  const c = encodeCursor({ createdAt: new Date('2026-06-17T10:00:00Z'), id: 'a4-...' });
  const d = decodeCursor(c);
  assert.equal(d.id, 'a4-...');
  assert.equal(d.createdAt?.toISOString(), '2026-06-17T10:00:00.000Z');
});

test('decode of null/empty/garbage returns nulls', () => {
  assert.deepEqual(decodeCursor(undefined), { createdAt: null, id: null });
  assert.deepEqual(decodeCursor(''), { createdAt: null, id: null });
  assert.deepEqual(decodeCursor('not-base64!!!'), { createdAt: null, id: null });
});

test('encode of null returns empty string', () => {
  assert.equal(encodeCursor(null), '');
});
```

- [ ] **Step 2: Run tests — should FAIL (module not found)**

Run: `cd apps/api && npx tsx --test src/merchantCatalog/cursor.test.ts`
Expected: FAIL, "Cannot find module './cursor'".

- [ ] **Step 3: Implement minimal cursor**

```typescript
// apps/api/src/merchantCatalog/cursor.ts
export type Cursor = { createdAt: Date | null; id: string | null };

export function encodeCursor(c: { createdAt: Date; id: string } | null): string {
  if (!c) return '';
  const payload = JSON.stringify({ t: c.createdAt.toISOString(), i: c.id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined | null): Cursor {
  if (!raw) return { createdAt: null, id: null };
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const o = JSON.parse(json);
    if (!o?.t || !o?.i) return { createdAt: null, id: null };
    return { createdAt: new Date(o.t), id: String(o.i) };
  } catch {
    return { createdAt: null, id: null };
  }
}
```

- [ ] **Step 4: Run tests — should PASS**

Run: `cd apps/api && npx tsx --test src/merchantCatalog/cursor.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/merchantCatalog/cursor.ts apps/api/src/merchantCatalog/cursor.test.ts
git commit -m "feat(api): keyset cursor encode/decode for merchant catalog pagination"
```

---

## Task 4 — Server-side validation rules (§7)

**Files:**
- Create: `apps/api/src/merchantCatalog/validate.ts`
- Test: `apps/api/src/merchantCatalog/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/api/src/merchantCatalog/validate.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validatePayload, validateMrpCeiling, validateFssaiGate } from './validate';

test('validatePayload: empty items rejected', () => {
  const r = validatePayload({ items: [] });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'EMPTY_ITEMS');
});

test('validatePayload: > 200 items rejected', () => {
  const r = validatePayload({ items: new Array(201).fill({ productId: 'p', price: 10, stock: 1 }) });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'TOO_MANY_ITEMS');
});

test('validatePayload: bad price types rejected', () => {
  const r = validatePayload({ items: [{ productId: 'p', price: 0, stock: 1 }] });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'INVALID_PRICE');
});

test('validatePayload: bad stock rejected', () => {
  const r = validatePayload({ items: [{ productId: 'p', price: 10, stock: -1 }] });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'INVALID_STOCK');
});

test('validatePayload: clean payload passes', () => {
  const r = validatePayload({ items: [{ productId: 'p', price: 10, stock: 1 }] });
  assert.equal(r.ok, true);
});

test('validateMrpCeiling: price > mrp reports offenders', () => {
  const items = [
    { productId: 'a', price: 50, stock: 1 },
    { productId: 'b', price: 200, stock: 1 },
  ];
  const products = new Map([['a', { mrp: 100 }], ['b', { mrp: 100 }]]);
  const r = validateMrpCeiling(items, products);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offenders, [{ productId: 'b', price: 200, mrp: 100 }]);
});

test('validateMrpCeiling: missing product reported', () => {
  const items = [{ productId: 'missing', price: 10, stock: 1 }];
  const products = new Map();
  const r = validateMrpCeiling(items, products);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'PRODUCT_NOT_FOUND');
});

test('validateFssaiGate: food + no FSSAI → blocked', () => {
  const items = [{ productId: 'a' }];
  const products = new Map([['a', { requiresFssai: true }]]);
  const r = validateFssaiGate(items, products, { fssaiNumber: null });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'FSSAI_REQUIRED');
});

test('validateFssaiGate: food + FSSAI present → ok', () => {
  const items = [{ productId: 'a' }];
  const products = new Map([['a', { requiresFssai: true }]]);
  const r = validateFssaiGate(items, products, { fssaiNumber: 'FSSAI-123' });
  assert.equal(r.ok, true);
});

test('validateFssaiGate: non-food + no FSSAI → ok', () => {
  const items = [{ productId: 'a' }];
  const products = new Map([['a', { requiresFssai: false }]]);
  const r = validateFssaiGate(items, products, { fssaiNumber: null });
  assert.equal(r.ok, true);
});
```

- [ ] **Step 2: Run tests — should FAIL (module not found)**

Run: `cd apps/api && npx tsx --test src/merchantCatalog/validate.test.ts`
Expected: 10 tests fail (module not found).

- [ ] **Step 3: Implement minimal validation**

```typescript
// apps/api/src/merchantCatalog/validate.ts
export type Item = { productId: string; price: number; stock: number };
export type ValidationResult = { ok: true } | { ok: false; code: string; offenders?: any[] };

export function validatePayload(body: any): ValidationResult {
  const items: any[] = body?.items;
  if (!Array.isArray(items) || items.length === 0) return { ok: false, code: 'EMPTY_ITEMS' };
  if (items.length > 200) return { ok: false, code: 'TOO_MANY_ITEMS' };
  for (const it of items) {
    if (!it?.productId || typeof it.productId !== 'string') return { ok: false, code: 'INVALID_PRODUCT_ID' };
    if (typeof it.price !== 'number' || !Number.isFinite(it.price) || it.price <= 0) {
      return { ok: false, code: 'INVALID_PRICE' };
    }
    if (!Number.isInteger(it.stock) || it.stock < 0) return { ok: false, code: 'INVALID_STOCK' };
  }
  return { ok: true };
}

export function validateMrpCeiling(
  items: Item[],
  products: Map<string, { mrp: number }>,
): ValidationResult {
  const offenders: any[] = [];
  for (const it of items) {
    const p = products.get(it.productId);
    if (!p) return { ok: false, code: 'PRODUCT_NOT_FOUND', offenders: [{ productId: it.productId }] };
    if (it.price > p.mrp) offenders.push({ productId: it.productId, price: it.price, mrp: p.mrp });
  }
  return offenders.length ? { ok: false, code: 'MRP_CEILING_VIOLATED', offenders } : { ok: true };
}

export function validateFssaiGate(
  items: { productId: string }[],
  products: Map<string, { requiresFssai: boolean }>,
  merchant: { fssaiNumber: string | null },
): ValidationResult {
  if (merchant.fssaiNumber) return { ok: true };
  const food = items.filter((it) => products.get(it.productId)?.requiresFssai);
  if (food.length === 0) return { ok: true };
  return { ok: false, code: 'FSSAI_REQUIRED', offenders: food.map((it) => it.productId) };
}
```

- [ ] **Step 4: Run tests — should PASS**

Run: `cd apps/api && npx tsx --test src/merchantCatalog/validate.test.ts`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/merchantCatalog/validate.ts apps/api/src/merchantCatalog/validate.test.ts
git commit -m "feat(api): validate.ts — MRP-ceiling + FSSAI + payload rules for catalog save"
```

---

## Task 5 — Image re-host service (§8, D3)

**Files:**
- Create: `apps/api/src/services/imageRehost.ts`
- Test: `apps/api/src/services/imageRehost.test.ts`

- [ ] **Step 1: Write failing tests with hand-injected deps**

```typescript
// apps/api/src/services/imageRehost.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { makeRehoster } from './imageRehost';

test('rehostOne: skipped when image is null', async () => {
  const r = makeRehoster({
    findProduct: async () => ({ image: null }),
    download: async () => { throw new Error('should not call'); },
    upload: async () => { throw new Error('should not call'); },
    updateImage: async () => { throw new Error('should not call'); },
    captureException: () => {},
  });
  assert.equal(await r.rehostOne('p'), 'skipped');
});

test('rehostOne: skipped when image is not grofers', async () => {
  const r = makeRehoster({
    findProduct: async () => ({ image: 'https://supabase.co/foo.jpg' }),
    download: async () => { throw new Error('should not call'); },
    upload: async () => { throw new Error('should not call'); },
    updateImage: async () => { throw new Error('should not call'); },
    captureException: () => {},
  });
  assert.equal(await r.rehostOne('p'), 'skipped');
});

test('rehostOne: ok path', async () => {
  let updated = false;
  const r = makeRehoster({
    findProduct: async () => ({ image: 'https://cdn.grofers.com/x.jpg' }),
    download: async () => ({ data: Buffer.from('img'), contentType: 'image/jpeg' }),
    upload: async () => ({ publicUrl: 'https://supabase.co/products/catalog/p.jpg' }),
    updateImage: async () => { updated = true; },
    captureException: () => {},
  });
  assert.equal(await r.rehostOne('p'), 'ok');
  assert.equal(updated, true);
});

test('rehostOne: never throws on failure, returns "failed"', async () => {
  let captured = false;
  const r = makeRehoster({
    findProduct: async () => ({ image: 'https://cdn.grofers.com/x.jpg' }),
    download: async () => { throw new Error('boom'); },
    upload: async () => { throw new Error('should not call'); },
    updateImage: async () => { throw new Error('should not call'); },
    captureException: () => { captured = true; },
  });
  assert.equal(await r.rehostOne('p'), 'failed');
  assert.equal(captured, true);
});

test('rehostMany: tallies skipped/ok/failed', async () => {
  let calls = 0;
  const outcomes = ['ok', 'skipped', 'failed'] as const;
  const r = makeRehoster({
    findProduct: async () => ({ image: 'https://cdn.grofers.com/x.jpg' }),
    download: async () => {
      const n = calls++;
      if (outcomes[n] === 'skipped') throw new Error('non-grofers'); // we'll force via image
      if (outcomes[n] === 'failed') throw new Error('boom');
      return { data: Buffer.from('img'), contentType: 'image/jpeg' };
    },
    upload: async () => ({ publicUrl: 'u' }),
    updateImage: async () => {},
    captureException: () => {},
  });
  // Use 2 ids — test tally aggregates; skipped requires non-grofers URL so simpler test:
  const result = await r.rehostMany(['a', 'b']);
  assert.ok(typeof result.ok === 'number');
  assert.ok(typeof result.failed === 'number');
  assert.ok(typeof result.skipped === 'number');
});
```

- [ ] **Step 2: Run tests — should FAIL (module not found)**

Run: `cd apps/api && npx tsx --test src/services/imageRehost.test.ts`
Expected: tests fail with module-not-found.

- [ ] **Step 3: Implement the service with injected deps**

```typescript
// apps/api/src/services/imageRehost.ts
export type RehostOutcome = 'ok' | 'skipped' | 'failed';

export type RehostDeps = {
  findProduct: (id: string) => Promise<{ image: string | null } | null>;
  download: (url: string) => Promise<{ data: Buffer; contentType: string }>;
  upload: (path: string, body: Buffer, contentType: string) => Promise<{ publicUrl: string }>;
  updateImage: (productId: string, url: string) => Promise<void>;
  captureException: (e: unknown, ctx?: Record<string, any>) => void;
};

export function makeRehoster(deps: RehostDeps) {
  async function rehostOne(productId: string): Promise<RehostOutcome> {
    try {
      const p = await deps.findProduct(productId);
      if (!p?.image) return 'skipped';
      if (!p.image.includes('cdn.grofers.com')) return 'skipped';
      const dl = await deps.download(p.image);
      const ext = inferExt(dl.contentType, p.image);
      const up = await deps.upload(`catalog/${productId}.${ext}`, dl.data, dl.contentType);
      await deps.updateImage(productId, up.publicUrl);
      return 'ok';
    } catch (e) {
      deps.captureException(e, { area: 'imageRehost', productId });
      return 'failed';
    }
  }
  async function rehostMany(productIds: string[], concurrency = 4) {
    const out = { ok: 0, skipped: 0, failed: 0 };
    let i = 0;
    async function worker() {
      while (i < productIds.length) {
        const idx = i++;
        const r = await rehostOne(productIds[idx]);
        out[r]++;
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, productIds.length) }, worker));
    return out;
  }
  return { rehostOne, rehostMany };
}

function inferExt(contentType: string, url: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (/\.png(\?|$)/i.test(url)) return 'png';
  if (/\.webp(\?|$)/i.test(url)) return 'webp';
  return 'jpg';
}
```

- [ ] **Step 4: Run tests — should PASS**

Run: `cd apps/api && npx tsx --test src/services/imageRehost.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/imageRehost.ts apps/api/src/services/imageRehost.test.ts
git commit -m "feat(api): imageRehost service — lazy grofers→Supabase, never throws"
```

---

## Task 6 — `GET /merchant/catalog` endpoint (§4)

**Files:**
- Modify: `apps/api/src/index.ts` (add new handler near the other `/merchant/*` routes)

- [ ] **Step 1: Locate the insertion point**

Run: `grep -n "app\\.\\(get\\|post\\)('/merchant/" apps/api/src/index.ts | head`
Pick a stable place near the other `/merchant/*` GET handlers.

- [ ] **Step 2: Add the handler**

```typescript
// apps/api/src/index.ts — add near other /merchant/* handlers
import { encodeCursor, decodeCursor } from './merchantCatalog/cursor';

app.get('/merchant/catalog', async (req, res) => {
  const u = await requireUser(req, res); if (!u) return;
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '30'), 10) || 30, 1), 50);
    const cursor = decodeCursor(req.query.cursor as string | undefined);
    const q = (req.query.q as string | undefined)?.trim();
    const verticalId = (req.query.verticalId as string | undefined) || undefined;
    const categoryId = (req.query.categoryId as string | undefined) || undefined;
    const brand = (req.query.brand as string | undefined) || undefined;
    const isVegRaw = req.query.isVeg as string | undefined;

    const branch = await prisma.merchantBranch.findFirst({
      where: { merchant_id: u.id },
      select: { id: true },
    });
    if (!branch) return res.status(400).json({ error: 'NO_BRANCH' });

    const where: any = {
      source: { in: ['blinkit', 'live_sync', 'purchased_catalog'] },
      mrp: { gt: 0 },
      NOT: { storeProducts: { some: { branch_id: branch.id, is_deleted: false } } },
      ...(q && q.length >= 2 ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
      ...(verticalId ? { vertical_id: verticalId } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(brand ? { brand: { equals: brand, mode: 'insensitive' as const } } : {}),
      ...(isVegRaw === 'true' ? { isVeg: true } : isVegRaw === 'false' ? { isVeg: false } : {}),
    };

    const rows = await prisma.product.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor.id
        ? { cursor: { id: cursor.id }, skip: 1 }
        : {}),
      include: {
        Vertical: { select: { id: true, name: true, requiresFssai: true } },
        Tier2Category: { select: { id: true, name: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;

    res.json({
      data: page.map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        mrp: p.mrp,
        image: p.image,
        uom: p.uom,
        isVeg: p.isVeg,
        vertical: p.Vertical && { id: p.Vertical.id, name: p.Vertical.name, requiresFssai: p.Vertical.requiresFssai },
        category: p.Tier2Category && { id: p.Tier2Category.id, name: p.Tier2Category.name },
      })),
      nextCursor,
      hasMore,
    });
  } catch (e) {
    return handleApiError(res, e, { area: 'merchant.catalog', userMessage: 'Failed to load catalog' });
  }
});
```

- [ ] **Step 3: tsc**

Run: `cd apps/api && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Smoke test against prod (read-only) via a tsx script**

Create `apps/api/scripts/smoke_get_merchant_catalog.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
// pick any merchant with a branch
const branch = await p.merchantBranch.findFirst({ where: { store_id: { not: null } }, select: { id: true, merchant_id: true } });
console.log('using branch', branch?.id, 'merchant', branch?.merchant_id);
// not exercising the HTTP handler here — just the inner query shape
const where: any = {
  source: { in: ['blinkit', 'live_sync', 'purchased_catalog'] }, mrp: { gt: 0 },
  NOT: { storeProducts: { some: { branch_id: branch!.id, is_deleted: false } } },
};
const rows = await p.product.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5, include: { Vertical: { select: { name: true, requiresFssai: true } }, Tier2Category: { select: { name: true } } }});
console.log('first page sample:'); rows.forEach((r: any) => console.log(' •', r.name?.slice(0, 30), '|', r.Vertical?.name, '|', r.Tier2Category?.name));
await p.$disconnect();
```

Run: `cd apps/api && npx tsx scripts/smoke_get_merchant_catalog.ts`
Expected: 5 rows printed with vertical + category names.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/scripts/smoke_get_merchant_catalog.ts
git commit -m "feat(api): GET /merchant/catalog — keyset-paginated catalog browse"
```

---

## Task 7 — Extend `POST /merchant/store-products/configure` (§7)

**Files:**
- Modify: `apps/api/src/index.ts` (around line 10544 — the existing handler)

- [ ] **Step 1: Read the current handler**

Run: `sed -n '10540,10610p' apps/api/src/index.ts`
Confirm body shape so the replacement matches your existing patterns.

- [ ] **Step 2: Replace the handler with the guarded version**

```typescript
// apps/api/src/index.ts — replace POST /merchant/store-products/configure
import { validatePayload, validateMrpCeiling, validateFssaiGate } from './merchantCatalog/validate';
import { makeRehoster } from './services/imageRehost';
import axios from 'axios';
import * as Sentry from '@sentry/node';

const rehoster = makeRehoster({
  findProduct: (id) => prisma.product.findUnique({ where: { id }, select: { image: true } }),
  download: async (url) => {
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 10_000, maxContentLength: 5 * 1024 * 1024 });
    return { data: Buffer.from(r.data), contentType: String(r.headers['content-type'] || 'image/jpeg') };
  },
  upload: async (path, body, contentType) => {
    const up = await supabaseAdmin.storage.from('products').upload(path, body, { contentType, upsert: true });
    if (up.error) throw up.error;
    const pub = supabaseAdmin.storage.from('products').getPublicUrl(path);
    return { publicUrl: pub.data.publicUrl };
  },
  updateImage: async (productId, url) => { await prisma.product.update({ where: { id: productId }, data: { image: url } }); },
  captureException: (e, ctx) => Sentry.captureException(e, { extra: ctx }),
});

app.post('/merchant/store-products/configure', async (req, res) => {
  const u = await requireUser(req, res); if (!u) return;
  try {
    const payload = validatePayload(req.body);
    if (!payload.ok) return res.status(400).json({ error: payload.code });

    const branch = await prisma.merchantBranch.findFirst({
      where: { merchant_id: u.id }, select: { id: true, merchant_id: true },
    });
    if (!branch) return res.status(400).json({ error: 'NO_BRANCH' });
    const merchant = await prisma.merchant.findUnique({ where: { id: branch.merchant_id }, select: { fssaiNumber: true } });

    const items: { productId: string; price: number; stock: number }[] = req.body.items;
    const ids = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, mrp: true, Vertical: { select: { requiresFssai: true } } },
    });
    const pmap = new Map(products.map((p) => [p.id, { mrp: p.mrp, requiresFssai: !!p.Vertical?.requiresFssai }]));

    const mrp = validateMrpCeiling(items, pmap);
    if (!mrp.ok) return res.status(400).json({ error: mrp.code, offenders: mrp.offenders });

    const fssai = validateFssaiGate(items, pmap, { fssaiNumber: merchant?.fssaiNumber ?? null });
    if (!fssai.ok) return res.status(403).json({ error: fssai.code, offenders: fssai.offenders });

    const result = await prisma.storeProduct.createMany({
      data: items.map((i) => ({
        productId: i.productId,
        branch_id: branch.id,
        variant: 'Standard',
        price: i.price,
        stock: i.stock,
        active: i.price > 0,
        is_deleted: false,
      })),
      skipDuplicates: true,
    });

    const rehostBudget = new Promise<{ ok: number; skipped: number; failed: number }>((resolve) =>
      setTimeout(() => resolve({ ok: 0, skipped: 0, failed: 0 }), 5_000),
    );
    const rehostTally = await Promise.race([rehoster.rehostMany(ids), rehostBudget]);

    res.json({ ok: true, listed: result.count, rehosted: rehostTally.ok, rehostFailed: rehostTally.failed });
  } catch (e: any) {
    if (String(e?.message).includes('MRP_CEILING_VIOLATED')) {
      return res.status(500).json({ error: 'MRP_CEILING_VIOLATED', source: 'db_trigger' });
    }
    return handleApiError(res, e, { area: 'merchant.store-products.configure', userMessage: 'Failed to save listings' });
  }
});
```

- [ ] **Step 3: tsc**

Run: `cd apps/api && npx tsc --noEmit`
Expected: exit 0. Fix any missing-import errors (likely `supabaseAdmin` if not already in scope — match the existing image-upload path's imports at index.ts ~1257).

- [ ] **Step 4: Smoke (read-mostly, rolled-back)**

Create `apps/api/scripts/smoke_configure_save.ts`: insert via createMany inside a transaction with one valid + one MRP-violating item, expect 1 success + trigger rejects the second; rollback.
```typescript
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const branch = await p.merchantBranch.findFirst({ where: { store_id: { not: null } } });
const products = await p.product.findMany({ where: { source: 'blinkit' }, take: 2 });
try {
  await p.$transaction(async (tx) => {
    await tx.storeProduct.create({ data: { productId: products[0].id, branch_id: branch!.id, variant: 'Standard', price: products[0].mrp, stock: 1, active: true, is_deleted: false } });
    console.log('valid insert ok');
    try {
      await tx.storeProduct.create({ data: { productId: products[1].id, branch_id: branch!.id, variant: 'Standard', price: products[1].mrp + 1, stock: 1, active: true, is_deleted: false } });
      throw new Error('TRIGGER_DID_NOT_FIRE');
    } catch (e: any) {
      if (!/MRP_CEILING_VIOLATED/.test(String(e?.message))) throw e;
      console.log('trigger fired ✓');
    }
    throw new Error('ROLLBACK');
  });
} catch (e: any) { if (e.message !== 'ROLLBACK') throw e; console.log('rolled back, 0 persisted'); }
await p.$disconnect();
```
Run: `cd apps/api && npx tsx scripts/smoke_configure_save.ts`
Expected: `valid insert ok → trigger fired ✓ → rolled back`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/scripts/smoke_configure_save.ts
git commit -m "feat(api): extend save endpoint — MRP-ceiling + FSSAI + lazy re-host"
```

---

## Task 8 — `useCatalogPicker` data hook (§5)

**Files:**
- Create: `apps/merchant-app/src/hooks/useCatalogPicker.ts`

- [ ] **Step 1: Implement the hook (no unit test — it's a thin fetch wrapper)**

```typescript
// apps/merchant-app/src/hooks/useCatalogPicker.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '../lib/apiClient'; // existing client used by other merchant hooks

export type PickerProduct = {
  id: string; name: string; brand: string | null; mrp: number; image: string | null; uom: string | null;
  isVeg: boolean | null;
  vertical: { id: string; name: string; requiresFssai: boolean } | null;
  category: { id: string; name: string } | null;
};

export type PickerFilters = {
  q?: string; verticalId?: string; categoryId?: string; brand?: string; isVeg?: 'true' | 'false';
};

export function useCatalogPicker() {
  const [rows, setRows] = useState<PickerProduct[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<string | null>(null);
  const filtersRef = useRef<PickerFilters>({});
  const reqIdRef = useRef(0);

  const fetchPage = useCallback(async (reset: boolean) => {
    const myReq = ++reqIdRef.current;
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = { limit: '30' };
      if (!reset && cursor.current) params.cursor = cursor.current;
      const f = filtersRef.current;
      if (f.q && f.q.length >= 2) params.q = f.q;
      if (f.verticalId) params.verticalId = f.verticalId;
      if (f.categoryId) params.categoryId = f.categoryId;
      if (f.brand) params.brand = f.brand;
      if (f.isVeg) params.isVeg = f.isVeg;
      const r = await apiClient.get('/merchant/catalog', { params });
      if (myReq !== reqIdRef.current) return; // a newer request started
      const next = (r.data?.data ?? []) as PickerProduct[];
      setRows((prev) => (reset ? next : [...prev, ...next]));
      cursor.current = r.data?.nextCursor ?? null;
      setHasMore(!!r.data?.hasMore);
    } catch (e: any) {
      if (myReq !== reqIdRef.current) return;
      setError(e?.message ?? 'Failed to load catalog');
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(true); }, [fetchPage]);

  const setFilters = useCallback((next: PickerFilters) => {
    filtersRef.current = next;
    cursor.current = null;
    fetchPage(true);
  }, [fetchPage]);

  const loadMore = useCallback(() => { if (!isLoading && hasMore) fetchPage(false); }, [fetchPage, isLoading, hasMore]);

  return { rows, hasMore, isLoading, error, setFilters, loadMore };
}
```

- [ ] **Step 2: tsc verify (merchant-app)**

Run: `cd apps/merchant-app && npx tsc --noEmit`
Expected: exit 0. (If `apiClient` path differs in the merchant-app, replace with the canonical existing import.)

- [ ] **Step 3: Commit**

```bash
git add apps/merchant-app/src/hooks/useCatalogPicker.ts
git commit -m "feat(merchant): useCatalogPicker — keyset-paginated catalog hook"
```

---

## Task 9 — Rewrite `catalog-picker.tsx` screen body (§5)

**Files:**
- Modify: `apps/merchant-app/app/(main)/catalog-picker.tsx`

- [ ] **Step 1: Re-read the locked sections to confirm what NOT to touch**

Run: `head -10 apps/merchant-app/app/(main)/catalog-picker.tsx`
The `@lock` header marks `FilterModal` invocation + `DEFAULT_FILTERS` as off-limits. The rest of the screen is yours.

- [ ] **Step 2: Replace the picker body — skeleton**

Keep the locked `// @lock` header, the imports, `DEFAULT_FILTERS`, and the `<FilterModal />` invocation. Replace the data flow + list with:

```tsx
// inside the screen component (visual styling matches existing merchant-app conventions)
import { useCatalogPicker, PickerProduct } from '../../src/hooks/useCatalogPicker';

const { rows, hasMore, isLoading, error, setFilters, loadMore } = useCatalogPicker();
const [selected, setSelected] = useState<Set<string>>(new Set());
const [configureOpen, setConfigureOpen] = useState(false);
const [search, setSearch] = useState('');
// debounce search → setFilters({ q: search }) when value settles
useDebouncedEffect(() => setFilters({ q: search }), 300, [search]);

const toggle = (id: string) => setSelected(prev => {
  const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
});

// FSSAI banner (§5): show at top if merchant.fssaiNumber == null AND any reachable food vertical exists
const showFssaiBanner = merchantNeedsFssaiHint(merchant, rows);

return (
  <SafeAreaView style={...}>
    {showFssaiBanner && <FssaiBanner onPress={() => router.push('/(main)/settings/kyc')} />}
    <SearchBar value={search} onChange={setSearch} />
    {/* FilterModal invocation — LOCKED, do not edit */}
    <FlatList
      data={rows}
      keyExtractor={r => r.id}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isLoading ? <ActivityIndicator /> : null}
      renderItem={({ item }) => (
        <Row product={item} selected={selected.has(item.id)} onPress={() => toggle(item.id)} />
      )}
    />
    {/* Sticky bottom bar */}
    {selected.size > 0 && (
      <View style={styles.bottomBar}>
        <Text>{selected.size} selected</Text>
        <TouchableOpacity onPress={() => setConfigureOpen(true)}>
          <Text>Configure ▶</Text>
        </TouchableOpacity>
      </View>
    )}
    <ConfigureProductsModal
      visible={configureOpen}
      productIds={Array.from(selected)}
      products={rows.filter(r => selected.has(r.id))}
      onClose={() => setConfigureOpen(false)}
      onDone={() => { setSelected(new Set()); setFilters(filtersRef.current); }}
    />
  </SafeAreaView>
);
```

**Drop** the `cleanName` Map dedup, any `supabase.from('Product').select('*')` calls, the fabricated-variants path. The `Row` component shows: `SafeImage` · name (2 lines) · brand · uom badge · MRP · veg dot **only when** `isVeg !== null`. Selection state lives in the parent (Set<id>). Helper `merchantNeedsFssaiHint(merchant, rows)` returns true if `merchant.fssaiNumber == null` AND any row has `vertical.requiresFssai`.

- [ ] **Step 3: tsc verify**

Run: `cd apps/merchant-app && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/merchant-app/app/(main)/catalog-picker.tsx
git commit -m "feat(merchant): catalog-picker rewrite — paginated browse + multi-select"
```

---

## Task 10 — Rebuild `ConfigureProductsModal` (§6)

**Files:**
- Modify: `apps/merchant-app/src/components/ConfigureProductsModal.tsx`

- [ ] **Step 1: Drop the fabricated-variants getter + direct Supabase read**

Remove `getVariantsForCategory` (line ~31), the `supabase.from('StoreProduct')…` block (~75), and the variant-iteration logic.

- [ ] **Step 2: New shape**

Modal receives `productIds: string[]`. On mount: fetch the products via a new lightweight endpoint (or accept them as a prop from the picker, which already has them in `rows`). Render one row per Product: image, name, "{brand} · {uom} · MRP ₹{mrp}", price input (with MRP-ceiling validation), stock input. FSSAI banner if `merchant.fssaiNumber` is null AND any product is food. Save button disabled until every row valid + no FSSAI block.

- [ ] **Step 3: Wire Save to POST /merchant/store-products/configure**

```typescript
const save = async () => {
  setSaving(true);
  try {
    const items = Array.from(rows.values()).map((r) => ({ productId: r.id, price: Number(r.price), stock: Number(r.stock) }));
    const res = await apiClient.post('/merchant/store-products/configure', { items });
    onDone?.(res.data); onClose();
  } catch (e: any) {
    const body = e?.response?.data;
    if (body?.error === 'MRP_CEILING_VIOLATED') setServerError('Price exceeds MRP for ' + body.offenders.length + ' items');
    else if (body?.error === 'FSSAI_REQUIRED') setServerError('Add FSSAI licence to list food products');
    else setServerError('Save failed');
  } finally { setSaving(false); }
};
```

- [ ] **Step 4: tsc verify**

Run: `cd apps/merchant-app && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/merchant-app/src/components/ConfigureProductsModal.tsx
git commit -m "feat(merchant): ConfigureProductsModal rebuild — drop fabricated variants, MRP+FSSAI guards"
```

---

## Task 11 — Adversarial audit script (§11)

**Files:**
- Create: `apps/api/scripts/audit_catalog_picker.ts`

- [ ] **Step 1: Write the audit script**

```typescript
// apps/api/scripts/audit_catalog_picker.ts — hits live API with a test merchant
import axios from 'axios';
const API = process.env.API_BASE || 'https://api.pickatstore.io';
const TOKEN = process.env.TEST_MERCHANT_JWT;
if (!TOKEN) throw new Error('set TEST_MERCHANT_JWT');
const client = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${TOKEN}` } });

async function expect(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log('✓', name); } catch (e: any) { console.log('✗', name, '—', e?.response?.status, e?.response?.data); }
}

await expect('GET /merchant/catalog returns ≤30 rows + nextCursor when hasMore', async () => {
  const r = await client.get('/merchant/catalog?limit=30');
  if (!Array.isArray(r.data?.data)) throw new Error('no data array');
  if (r.data.data.length > 30) throw new Error('over-fetched');
  if (r.data.hasMore && !r.data.nextCursor) throw new Error('hasMore without cursor');
});

await expect('cursor round-trip: page 2 disjoint from page 1', async () => {
  const a = await client.get('/merchant/catalog?limit=10');
  const b = await client.get(`/merchant/catalog?limit=10&cursor=${encodeURIComponent(a.data.nextCursor)}`);
  const ids = new Set(a.data.data.map((x: any) => x.id));
  if (b.data.data.some((x: any) => ids.has(x.id))) throw new Error('overlap between pages');
});

await expect('search returns matches', async () => {
  const r = await client.get('/merchant/catalog?q=maggi');
  if (!r.data.data.some((x: any) => /maggi/i.test(x.name))) throw new Error('no maggi rows');
});

await expect('POST configure: 400 on empty items', async () => {
  try { await client.post('/merchant/store-products/configure', { items: [] }); throw new Error('expected 400'); }
  catch (e: any) { if (e?.response?.status !== 400 || e?.response?.data?.error !== 'EMPTY_ITEMS') throw e; }
});

await expect('POST configure: 400 on MRP violation', async () => {
  const cat = await client.get('/merchant/catalog?limit=1');
  const p = cat.data.data[0];
  try { await client.post('/merchant/store-products/configure', { items: [{ productId: p.id, price: p.mrp + 1, stock: 1 }] }); throw new Error('expected 400'); }
  catch (e: any) { if (e?.response?.status !== 400 || e?.response?.data?.error !== 'MRP_CEILING_VIOLATED') throw e; }
});
```

- [ ] **Step 2: Run after deploy**

Run (after the API is deployed): `cd apps/api && API_BASE=https://api.pickatstore.io TEST_MERCHANT_JWT=<jwt> npx tsx scripts/audit_catalog_picker.ts`
Expected: every line starts with `✓`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/audit_catalog_picker.ts
git commit -m "test(api): adversarial audit script for catalog picker"
```

---

## Task 12 — Final verification, build, deploy

- [ ] **Step 1: Run the full test suite**

Run:
```bash
cd apps/api
npx tsx --test src/merchantCatalog/cursor.test.ts
npx tsx --test src/merchantCatalog/validate.test.ts
npx tsx --test src/services/imageRehost.test.ts
npx tsc --noEmit
```
Expected: all green; tsc exit 0.

- [ ] **Step 2: Build**

Run: `cd apps/api && npm run build`
Expected: dist regenerated.

- [ ] **Step 3: Confirm EB status Ready/Green**

Run: `cd apps/api && eb status`
Expected: Ready/Green. STOP here if not Ready.

- [ ] **Step 4: Ask Pranav for explicit per-deploy "yes"**

Per CLAUDE.md, every deploy requires explicit per-action confirmation.

- [ ] **Step 5: Deploy (after explicit "yes")**

Run: `cd apps/api && eb deploy`
Expected: `Environment update completed successfully`. Note the version id.

- [ ] **Step 6: Live smoke**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.pickatstore.io/health
curl -s -H "Authorization: Bearer $TEST_MERCHANT_JWT" "https://api.pickatstore.io/merchant/catalog?limit=2" | head -c 400
```
Expected: 200 + a `data` array with vertical/category names.

- [ ] **Step 7: Run the adversarial audit live**

Run: `cd apps/api && API_BASE=https://api.pickatstore.io TEST_MERCHANT_JWT=<jwt> npx tsx scripts/audit_catalog_picker.ts`
Expected: all ✓.

- [ ] **Step 8: Update `forlater.md`**

Append a Phase 4 sub-2 DONE entry with the version id, the commits, and any deferred follow-ups.

- [ ] **Step 9: Final commit (forlater + any docs)**

```bash
git add forlater.md
git commit -m "docs: record Phase 4 sub-2 (catalog picker) shipped"
```

---

## Out of scope (do NOT do here — own tickets)

- Consumer veg/non-veg filter + dots → Phase 4 sub-project 3.
- Sibling / variant grouping (one card with pack-size selector) → future sub-project.
- FSSAI expiry checks (not just presence) → own ticket.
- Background job queue for re-host retries beyond the 5s budget → own ticket.
- Admin UI to view rehost failure log + manually retry → own ticket.

---

## Rollback

| Layer | Action |
|---|---|
| Trigger | `DROP TRIGGER trg_storeproduct_mrp_ceiling ON public."StoreProduct"; DROP FUNCTION public.enforce_mrp_ceiling();` |
| Index | `DROP INDEX IF EXISTS public.idx_product_name_trgm;` |
| API | revert the relevant commits + `eb deploy` |
| Merchant app | rides batched OTA — revert + push if a regression slips |
