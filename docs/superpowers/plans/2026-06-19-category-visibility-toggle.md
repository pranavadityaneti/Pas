# Admin Category Enable/Disable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins toggle any category (Vertical) or subcategory (Tier2Category) on/off, so disabling one instantly hides it + all its products from every customer app, blocks new merchant listings in it, and auto-drops now-empty stores from discovery — all reversible.

**Architecture:** A `Vertical.is_active` flag (Tier2Category already has `active`) gated by **RESTRICTIVE Postgres RLS** policies (AND'd onto the existing permissive public-read policies) so `anon`/`authenticated` reads cascade-hide disabled categories + their products + listings, while `service_role` (admin API + merchant API) bypasses RLS. Admin toggles via role-gated API endpoints surfaced in a new "Categories" tab in Master Catalog. Merchant listing API rejects disabled categories. `get_nearby_stores` is made category-aware.

**Tech Stack:** Express + Prisma + Supabase Postgres (api); React/Vite (admin-web); React Native/Expo (consumer); `node:test` via `npx tsx --test`; `$executeRawUnsafe` tsx migration scripts.

**Spec:** `docs/category-visibility-toggle-spec-2026-06-19.html` (commit `3e86fd1c`). Tasks reference spec sections.

---
> ## ✅ SHIPPED — 2026-06-21
> All 8 tasks complete and live. Commits `39aedd0c` (T1 column) · `03a18f2d` (T2 RLS) · `d0f63da4` (T3 get_nearby_stores) · `0c0765a5` (T4 validate+unit) · `5fdfc981` (T5 admin API + merchant guard) · `bd6836aa` (T6 admin tab) · `ce571deb` (T7 order-gate + cart prune) · `f1cfbc01` (dist).
> **Deployed:** 3 DB migrations applied to prod; API on EB (`app-260621_224810548610`, verified `/admin/categories`→401, `/health`→200); admin Categories tab on Vercel (`pas-admin-web` build success).
> **Deferred:** consumer cart-prune (T7b) ships with the next consumer OTA — the server-side `POST /order-requests` gate (T7a) is the airtight backstop, so correctness does not depend on the OTA.
> **Audit:** no consumer service_role leak path; both toggles bite (139,965/140,174 products categorized); migrations intact (4 policies, column, RPC, 15/136 active). Accepted limitation: merchant can't see parked stock in a disabled category (intended coupling D2; "Paused by platform" badge deferred).
---

**Pre-flight facts:** 15 Verticals, 136 Tier2Categories, ~140k Products. RLS is ON for Vertical/Tier2Category/Product/StoreProduct with multiple **permissive** public-read SELECT policies (keep them). Consumer product reads use `Product!inner` joins. `service_role` bypasses RLS.

---

## File map

| Path | Purpose | Action |
|---|---|---|
| `apps/api/prisma/schema.prisma` | add `Vertical.is_active` | Modify |
| `apps/api/scripts/migrate_add_vertical_is_active.ts` | column + index migration | Create |
| `apps/api/scripts/migrate_category_visibility_rls.ts` | the 4 RESTRICTIVE RLS policies | Create |
| `apps/api/scripts/migrate_get_nearby_stores_category_aware.ts` | update the discovery RPC | Create |
| `apps/api/src/merchantCatalog/validate.ts` | add `validateCategoriesEnabled` | Modify |
| `apps/api/src/merchantCatalog/validate.test.ts` | unit test | Modify |
| `apps/api/src/index.ts` | `GET/PATCH /admin/categories*` + merchant guard | Modify |
| `apps/api/scripts/audit_category_visibility.ts` | adversarial DB audit | Create |
| `apps/admin-web/src/components/modules/catalog/MasterCatalog.tsx` | "Categories" tab | Modify |
| `apps/admin-web/src/components/modules/catalog/CategoriesTab.tsx` | the toggle UI | Create |
| `apps/consumer-app/src/context/CartContext.tsx` | drop/flag hidden cart items | Modify |

---

## Task 1 — DB migration: `Vertical.is_active` + index (spec §Data model)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (Vertical model)
- Create: `apps/api/scripts/migrate_add_vertical_is_active.ts`

- [ ] **Step 1: Add the column to the Prisma schema**

In `model Vertical`, after `requiresFssai   Boolean         @default(false)` add:
```prisma
  is_active       Boolean         @default(true)
```

- [ ] **Step 2: Write the migration script**

```typescript
// apps/api/scripts/migrate_add_vertical_is_active.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('[is_active] adding Vertical.is_active (default true) + index…');
  await prisma.$executeRawUnsafe(`ALTER TABLE public."Vertical" ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_vertical_is_active ON public."Vertical"(is_active);`);
  const r: any[] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n, count(*) FILTER (WHERE is_active)::int AS active FROM "Vertical"`);
  console.log('[is_active] verticals:', r[0].n, 'active:', r[0].active, '(want all active)');
  if (r[0].n !== r[0].active) throw new Error('some verticals defaulted inactive — abort');
  console.log('[is_active] done.');
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Apply (after Pranav's "yes" — it's a prod migration)**

Run: `cd apps/api && npx tsx scripts/migrate_add_vertical_is_active.ts`
Expected: `verticals: 15 active: 15`.

- [ ] **Step 4: Regenerate Prisma client + tsc**

Run: `cd apps/api && npx prisma generate && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/scripts/migrate_add_vertical_is_active.ts apps/api/dist/index.js 2>/dev/null
git commit -m "feat(db): add Vertical.is_active for category visibility toggle"
```

---

## Task 2 — RESTRICTIVE RLS policies (spec §2 — the instant-on-live-apps engine)

**Files:**
- Create: `apps/api/scripts/migrate_category_visibility_rls.ts`

- [ ] **Step 1: Write the migration + built-in rolled-back verification**

```typescript
// apps/api/scripts/migrate_category_visibility_rls.ts
// RESTRICTIVE SELECT policies for anon+authenticated, AND'd onto the existing
// permissive public-read. service_role bypasses RLS (admin/merchant API unaffected).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const POLICIES = [
  `DROP POLICY IF EXISTS cat_vis_vertical ON public."Vertical";`,
  `CREATE POLICY cat_vis_vertical AS RESTRICTIVE FOR SELECT TO anon, authenticated
     ON public."Vertical" USING (is_active = true);`,
  `DROP POLICY IF EXISTS cat_vis_tier2 ON public."Tier2Category";`,
  `CREATE POLICY cat_vis_tier2 AS RESTRICTIVE FOR SELECT TO anon, authenticated
     ON public."Tier2Category" USING (active = true AND EXISTS (SELECT 1 FROM public."Vertical" v WHERE v.id = vertical_id AND v.is_active));`,
  `DROP POLICY IF EXISTS cat_vis_product ON public."Product";`,
  `CREATE POLICY cat_vis_product AS RESTRICTIVE FOR SELECT TO anon, authenticated
     ON public."Product" USING (
       (vertical_id IS NULL OR EXISTS (SELECT 1 FROM public."Vertical" v WHERE v.id = vertical_id AND v.is_active))
       AND (category_id IS NULL OR EXISTS (SELECT 1 FROM public."Tier2Category" t WHERE t.id = category_id AND t.active)));`,
  `DROP POLICY IF EXISTS cat_vis_storeproduct ON public."StoreProduct";`,
  `CREATE POLICY cat_vis_storeproduct AS RESTRICTIVE FOR SELECT TO anon, authenticated
     ON public."StoreProduct" USING (EXISTS (SELECT 1 FROM public."Product" pr
       WHERE pr.id = "StoreProduct"."productId"
         AND (pr.vertical_id IS NULL OR EXISTS (SELECT 1 FROM public."Vertical" v WHERE v.id = pr.vertical_id AND v.is_active))
         AND (pr.category_id IS NULL OR EXISTS (SELECT 1 FROM public."Tier2Category" t WHERE t.id = pr.category_id AND t.active))));`,
];

async function main() {
  console.log('[rls] applying RESTRICTIVE category-visibility policies…');
  for (const sql of POLICIES) await prisma.$executeRawUnsafe(sql);
  const r: any[] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM pg_policies WHERE policyname LIKE 'cat_vis_%'`);
  console.log('[rls] policies present:', r[0].n, '(want 4)');
  if (r[0].n !== 4) throw new Error('expected 4 cat_vis policies');

  // Rolled-back test: as the ANON role, disabling a vertical must hide its products.
  console.log('[rls] rolled-back anon test…');
  await prisma.$transaction(async (tx) => {
    const v: any[] = await tx.$queryRawUnsafe(`SELECT id, name FROM "Vertical" WHERE is_active LIMIT 1`);
    const vid = v[0].id;
    const before: any[] = await tx.$queryRawUnsafe(`SET LOCAL ROLE anon; SELECT count(*)::int n FROM "Product" WHERE vertical_id = '${vid}'`);
    await tx.$executeRawUnsafe(`RESET ROLE; UPDATE "Vertical" SET is_active = false WHERE id = '${vid}'`);
    const after: any[] = await tx.$queryRawUnsafe(`SET LOCAL ROLE anon; SELECT count(*)::int n FROM "Product" WHERE vertical_id = '${vid}'`);
    const svc: any[] = await tx.$queryRawUnsafe(`RESET ROLE; SELECT count(*)::int n FROM "Product" WHERE vertical_id = '${vid}'`);
    console.log(`[rls]   "${v[0].name}" anon visible products: before=${before[0].n}, after-disable=${after[0].n}, service-role=${svc[0].n}`);
    if (after[0].n !== 0) throw new Error('FAIL: anon still sees products of a disabled vertical');
    if (svc[0].n === 0) throw new Error('FAIL: service-role lost visibility (should bypass RLS)');
    throw new Error('ROLLBACK');
  }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
  console.log('[rls] ✓ anon hidden, service-role unaffected, rolled back. done.');
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Apply (after Pranav's "yes")**

Run: `cd apps/api && npx tsx scripts/migrate_category_visibility_rls.ts`
Expected: `policies present: 4` then `anon hidden, service-role unaffected, rolled back`.
*(If `SET LOCAL ROLE anon` errors in the pooled connection, fall back to a single-statement form or run the verify via the Supabase SQL editor — note it in the run log.)*

- [ ] **Step 3: EXPLAIN a product read (perf at 140k)**

Run:
```bash
cd apps/api && NODE_PATH="$PWD/node_modules" node -e '
const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();
p.$queryRawUnsafe(`EXPLAIN ANALYZE SELECT id FROM "Product" WHERE vertical_id IS NOT NULL LIMIT 50`).then(r=>{console.log(r.map(x=>x["QUERY PLAN"]).join("\n"));p.$disconnect();})'
```
Expected: completes in a few ms (index usage on vertical_id); note timing.

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/migrate_category_visibility_rls.ts
git commit -m "feat(db): RESTRICTIVE RLS — hide disabled categories + products from customer reads"
```

---

## Task 3 — Make `get_nearby_stores` category-aware (spec §4, D7)

**Files:**
- Create: `apps/api/scripts/migrate_get_nearby_stores_category_aware.ts`

- [ ] **Step 1: Read the current function definition**

Run:
```bash
cd apps/api && NODE_PATH="$PWD/node_modules" node -e '
const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();
p.$queryRawUnsafe(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname=\x27get_nearby_stores\x27`).then(r=>{console.log(r[0].d);p.$disconnect();})'
```
Note the existing `EXISTS (... StoreProduct sp ... active ... is_deleted ...)` block — you will AND a category check into it.

- [ ] **Step 2: Write the migration that re-creates the function with the category-aware EXISTS**

```typescript
// apps/api/scripts/migrate_get_nearby_stores_category_aware.ts
// Re-creates get_nearby_stores: the "store has products" EXISTS now also requires
// the product's vertical (and subcategory) to be active, so empty-because-disabled
// stores auto-drop from discovery. PASTE the current body from Step 1, then AND in:
//    AND (pr.vertical_id IS NULL OR EXISTS (SELECT 1 FROM "Vertical" v WHERE v.id=pr.vertical_id AND v.is_active))
//    AND (pr.category_id  IS NULL OR EXISTS (SELECT 1 FROM "Tier2Category" t WHERE t.id=pr.category_id AND t.active))
// inside the StoreProduct EXISTS (joining StoreProduct sp -> Product pr on pr.id = sp."productId").
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const SQL = `CREATE OR REPLACE FUNCTION public.get_nearby_stores(... /* full signature + body from Step 1, with the category-aware EXISTS */ ...) ...;`;
async function main() {
  // Safety: keep the original definition for rollback
  const orig: any[] = await prisma.$queryRawUnsafe(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='get_nearby_stores'`);
  require('fs').writeFileSync(__dirname + '/_get_nearby_stores_original.sql', orig[0].d);
  console.log('[discovery] original saved for rollback. applying category-aware version…');
  await prisma.$executeRawUnsafe(SQL);
  console.log('[discovery] applied. (verify with a rolled-back disable test below.)');
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Apply (after Pranav's "yes") + verify with a rolled-back disable**

Run: `cd apps/api && npx tsx scripts/migrate_get_nearby_stores_category_aware.ts`
Then a rolled-back check: pick a store, count its `get_nearby_stores` appearance; disable the vertical of ALL its products in a tx; confirm it drops; rollback. Write this check inline in the script's tail or a sibling `verify_*.ts`. Expected: a single-category store drops; a multi-category store stays.

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/migrate_get_nearby_stores_category_aware.ts apps/api/scripts/_get_nearby_stores_original.sql
git commit -m "feat(db): get_nearby_stores category-aware — empty-because-disabled stores auto-drop"
```

---

## Task 4 — `validateCategoriesEnabled` unit (spec §3 merchant guard)

**Files:**
- Modify: `apps/api/src/merchantCatalog/validate.ts`
- Modify: `apps/api/src/merchantCatalog/validate.test.ts`

- [ ] **Step 1: Write the failing tests (append to validate.test.ts)**

```typescript
import { validateCategoriesEnabled } from './validate';

test('validateCategoriesEnabled: disabled vertical → blocked', () => {
  const items = [{ productId: 'a' }];
  const products = new Map([['a', { verticalActive: false, subcategoryActive: true }]]);
  const r = validateCategoriesEnabled(items, products);
  assert.equal(r.ok, false);
  assert.equal((r as any).code, 'CATEGORY_DISABLED');
});
test('validateCategoriesEnabled: disabled subcategory → blocked', () => {
  const r = validateCategoriesEnabled([{ productId: 'a' }], new Map([['a', { verticalActive: true, subcategoryActive: false }]]));
  assert.equal(r.ok, false);
  assert.equal((r as any).code, 'CATEGORY_DISABLED');
});
test('validateCategoriesEnabled: all enabled → ok', () => {
  const r = validateCategoriesEnabled([{ productId: 'a' }], new Map([['a', { verticalActive: true, subcategoryActive: true }]]));
  assert.equal(r.ok, true);
});
```

- [ ] **Step 2: Run — should FAIL (function not exported)**

Run: `cd apps/api && npx tsx --test src/merchantCatalog/validate.test.ts`
Expected: 3 new tests fail (not a function).

- [ ] **Step 3: Implement (append to validate.ts)**

```typescript
export function validateCategoriesEnabled(
  items: { productId: string }[],
  products: Map<string, { verticalActive: boolean; subcategoryActive: boolean }>,
): ValidationResult {
  const offenders = items
    .filter((it) => { const p = products.get(it.productId); return p && (!p.verticalActive || !p.subcategoryActive); })
    .map((it) => it.productId);
  return offenders.length ? { ok: false, code: 'CATEGORY_DISABLED', offenders } : { ok: true };
}
```

- [ ] **Step 4: Run — should PASS**

Run: `cd apps/api && npx tsx --test src/merchantCatalog/validate.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/merchantCatalog/validate.ts apps/api/src/merchantCatalog/validate.test.ts
git commit -m "feat(api): validateCategoriesEnabled guard unit"
```

---

## Task 5 — Admin category endpoints + merchant guard wiring (spec §3)

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add the admin endpoints near other `/admin/*` handlers**

```typescript
// GET all categories + subcategories with active flags + product counts (service-role).
app.get('/admin/categories', async (req, res) => {
  const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
  try {
    const verticals = await prisma.vertical.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, is_active: true,
        tier2Categories: { orderBy: { name: 'asc' }, select: { id: true, name: true, active: true } },
        _count: { select: { Product: true } } },
    });
    res.json({ data: verticals });
  } catch (e) { return handleApiError(res, e, { area: 'admin.categories.list', userMessage: 'Failed to load categories' }); }
});

app.patch('/admin/categories/vertical/:id', async (req, res) => {
  const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
  try {
    const isActive = !!req.body?.isActive;
    await prisma.vertical.update({ where: { id: req.params.id }, data: { is_active: isActive } });
    logAudit(req.params.id, isActive ? 'CATEGORY_ENABLE' : 'CATEGORY_DISABLE', 'vertical.is_active', null, String(isActive)).catch(() => {});
    res.json({ ok: true });
  } catch (e) { return handleApiError(res, e, { area: 'admin.categories.vertical', extra: { id: req.params.id }, userMessage: 'Failed to toggle category' }); }
});

app.patch('/admin/categories/subcategory/:id', async (req, res) => {
  const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
  try {
    const active = !!req.body?.active;
    await prisma.tier2Category.update({ where: { id: req.params.id }, data: { active } });
    logAudit(req.params.id, active ? 'SUBCATEGORY_ENABLE' : 'SUBCATEGORY_DISABLE', 'tier2.active', null, String(active)).catch(() => {});
    res.json({ ok: true });
  } catch (e) { return handleApiError(res, e, { area: 'admin.categories.subcategory', extra: { id: req.params.id }, userMessage: 'Failed to toggle subcategory' }); }
});
```

- [ ] **Step 2: Wire the merchant guard into `POST /merchant/store-products/configure`**

In the configure handler, right after the FSSAI check (`if (!fssaiCheck.ok) …`), add:
```typescript
import { validateCategoriesEnabled } from './merchantCatalog/validate';
// … inside the handler, reuse guardProducts but extend the select to include the active flags:
//   select: { id:true, mrp:true, Vertical:{select:{requiresFssai:true, is_active:true}}, Tier2Category:{select:{active:true}} }
const catMap = new Map(guardProducts.map((p: any) => [p.id, {
  verticalActive: p.Vertical ? !!p.Vertical.is_active : true,
  subcategoryActive: p.Tier2Category ? !!p.Tier2Category.active : true,
}]));
const catCheck = validateCategoriesEnabled(itemList, catMap);
if (!catCheck.ok) return res.status(403).json({ error: (catCheck as any).code, offenders: (catCheck as any).offenders });
```
(Extend the existing `guardProducts` query's `select` to add `Vertical.is_active` + `Tier2Category.active`; reuse `itemList`.)

- [ ] **Step 3: tsc**

Run: `cd apps/api && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Smoke (rolled-back) — disable a vertical, confirm configure 403**

Create `apps/api/scripts/smoke_category_guard.ts`: in a tx, disable a vertical, build an item from one of its products, call the same validate logic + a `storeProduct.create` attempt; expect the guard catches it (or, simpler, assert `validateCategoriesEnabled` returns CATEGORY_DISABLED for a product in the disabled vertical). Rollback.
Run: `cd apps/api && npx tsx scripts/smoke_category_guard.ts`
Expected: `CATEGORY_DISABLED` reported; rolled back.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/scripts/smoke_category_guard.ts
git commit -m "feat(api): GET/PATCH /admin/categories + CATEGORY_DISABLED merchant guard"
```

---

## Task 6 — Admin "Categories" tab (spec §5)

**Files:**
- Create: `apps/admin-web/src/components/modules/catalog/CategoriesTab.tsx`
- Modify: `apps/admin-web/src/components/modules/catalog/MasterCatalog.tsx`

- [ ] **Step 1: Create CategoriesTab.tsx**

A component that: fetches `GET /admin/categories` (via the admin API client used elsewhere in admin-web), renders each Vertical as a row with name + product count + a toggle (`is_active`), expandable to its `tier2Categories` (each name + `active` toggle). On toggle → `PATCH /admin/categories/vertical/:id {isActive}` or `…/subcategory/:id {active}`; optimistic update + refetch on error. Disabling shows a confirm dialog: "This hides the category and all its products from customers and blocks new merchant listings. Continue?" Match the existing admin design-system styling (look at a sibling module, e.g. `RolesPermissions.tsx`, for the table/toggle pattern + the API client import).

- [ ] **Step 2: Add the tab to MasterCatalog**

In `MasterCatalog.tsx`, add a "Categories" tab alongside Global / Merchant Requests / Sync Queue (the existing tab state + switcher), rendering `<CategoriesTab/>` when selected. Do not disturb the `@lock`'d / live-taxonomy logic already there — this is a new tab only.

- [ ] **Step 3: Type-check (NOT `npx tsc` — it's a stub here)**

Run: `cd apps/admin-web && node_modules/.bin/tsc --noEmit` (or `npm run build`)
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin-web/src/components/modules/catalog/CategoriesTab.tsx" "apps/admin-web/src/components/modules/catalog/MasterCatalog.tsx"
git commit -m "feat(admin): Categories tab — enable/disable verticals + subcategories"
```

---

## Task 7 — Consumer cart guard (spec §6)

**Files:**
- Modify: `apps/consumer-app/src/context/CartContext.tsx`

- [ ] **Step 1: Drop/flag hidden items at cart load**

When the cart hydrates / refreshes its line items from the DB (the existing read that resolves each cart item's StoreProduct/Product), items whose product is no longer returned (RLS-hidden because its category was disabled) should be **removed from the active cart** with a one-time toast/notice ("Some items are no longer available and were removed"). Because the customer reads via RLS, a hidden product simply won't come back in the refresh — detect the missing line and prune it. Keep the change minimal + within CartContext; do not touch checkout math beyond removing the pruned item.

- [ ] **Step 2: tsc verify (consumer)**

Run: `cd apps/consumer-app && node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/consumer-app/src/context/CartContext.tsx
git commit -m "feat(consumer): prune cart items whose category was disabled (rides OTA)"
```

---

## Task 8 — Adversarial audit + deploy

**Files:**
- Create: `apps/api/scripts/audit_category_visibility.ts`

- [ ] **Step 1: Write the audit (rolled-back, anon-vs-service-role)**

`audit_category_visibility.ts`: for a sample vertical AND a sample subcategory, in a rolled-back tx — disable it, then as `anon` confirm: the category row is hidden, its products count→0, its StoreProducts count→0; as service-role confirm all still visible; confirm `get_nearby_stores` drops a single-category store; re-state nothing persisted. Print ✓/✗ per check.

- [ ] **Step 2: Run the full suite**

Run:
```bash
cd apps/api
npx tsx --test src/merchantCatalog/validate.test.ts
npx tsc --noEmit
npx tsx scripts/audit_category_visibility.ts
```
Expected: all green.

- [ ] **Step 3: Build + deploy (after Pranav's explicit "yes")**

Run: `cd apps/api && npm run build && eb status` (confirm Ready/Green) → `eb deploy`.
Verify: `curl -s -o /dev/null -w "%{http_code}\n" https://api.pickatstore.io/admin/categories` → 401 (gated). Note the version id.

- [ ] **Step 4: Update forlater + commit**

Append a "category visibility shipped" note (DB live, API deployed, admin tab rides main-merge, consumer cart guard rides OTA) and commit.

---

## Out of scope (do NOT build here)

- Two-toggle split (customer-hidden vs merchant-allowed) — future.
- "Paused by platform" badge styling in the merchant app — the *block* is server-side (Task 5); the badge rides the next merchant build.
- Category reorder / icon / banner management in the tab.

## Rollback

| Layer | Action |
|---|---|
| RLS | `DROP POLICY cat_vis_vertical ON "Vertical";` (×4) |
| Discovery | re-apply `apps/api/scripts/_get_nearby_stores_original.sql` |
| API | revert the commits + `eb deploy` |
| Column | `Vertical.is_active` is additive — harmless if left |
| Admin/consumer | revert the commits (admin rides main-merge; consumer rides OTA) |
