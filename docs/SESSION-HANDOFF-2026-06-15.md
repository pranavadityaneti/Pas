# PAS — Session Handoff (2026-06-15)

Paste the block below into a fresh Claude Code session (the new account on this same Mac).

---

You are picking up an in-progress engineering effort on **Pick At Store (PAS)**, an Indian quick-commerce / pickup marketplace. I'm Pranav — a founder, not a coder; I describe what I want and you implement, **one change at a time, showing diff + `tsc` after each, and STOPPING for my approval. Never bundle changes. Never deploy or run a DB migration without my explicit in-session "yes". Never use Haiku.** My global rules live in `~/.claude/CLAUDE.md` (already loaded for you on this Mac) — follow them.

## First, orient yourself (do this before anything else)
1. **Repo:** `/Users/pranavaditya/projects/pas-admin` (the **main checkout**, branch `feat/consumer-global-config-wiring`). NOTE: this session may show a `.claude/worktrees/...` cwd, but **all real work + files live in the main checkout** — operate there.
2. **Read `/Users/pranavaditya/projects/pas-admin/forlater.md`** — this is the master log. Read the sections "📦 Inventory + KYC Hardening", "🚨 INVENTORY ERROR-HUNT", and the Phase 1/2 DONE notes. It records every decision + what's done/pending.
3. **Read these HTML reports** (open or `Read` them) for full context:
   - `docs/inventory-error-hunt-2026-06-15.html` — the 34-defect audit + the **5-phase fix plan we are currently executing**.
   - `docs/inventory-kyc-hardening-plan-2026-06-15.html` — the broader 16-phase plan.
   - `docs/phase2-category-taxonomy-mapping-2026-06-15.html` — the Blinkit→PAS taxonomy.
   - `docs/merchant-customer-display-audit-2026-06-15.html` — customer-facing blockers (Phase 3 below).
   - `docs/merchant-agreements-compliance-review-2026-06-15.html` + `docs/merchant-payout-formula-v1-2026-06-15.html` — open legal/payout tracks (not blocking inventory).
4. **Verify current state yourself:** `git -C /Users/pranavaditya/projects/pas-admin log --oneline -8` and `cd apps/api && eb status` (should be Ready/Green, version `app-260616_015147794725` or newer).

## What's the project context (one paragraph)
We bought a **141,405-row Blinkit product CSV** (`/Users/pranavaditya/Desktop/WORK/ALL PROJECTS/PAS/Datasets/Blinkit Data.csv`) to replace expensive APIFY scraping. Before loading it, we audited the inventory module and found it would silently insert 0 rows + had a systemic category/vertical bug + customer-safety landmines. We're hardening it phase by phase, then we load the 141k. Current prod DB has only **294 Products / 44 StoreProducts** (141k NOT loaded yet).

## What's DONE + DEPLOYED to prod (verify via git/eb)
- **Phase 2 taxonomy (applied to prod):** `CategoryMapping` table (commit `e1c40367`) + 41 new Tier2Categories → **136 total** (`fcfd1735`) + **643 Blinkit→PAS mappings** (630 ACTIVE, 13 PENDING_DECISION) (`65d7002c`). The 15 finalized verticals are unchanged.
- **Phase 1 error-hunt (deployed `e86734f8`):** removed MOCK_PRODUCTS masking; fixed the importer's phantom `category` (was 0-rows-but-HTTP-200); removed the MRP ÷100 corruption.
- **Phase 2-code error-hunt (deployed `d5b1b81f`):** eliminated the category/vertical scalar→FK bug across 6 handlers (GET/PATCH/bulk-update products, consumer storefront/store-list/search, approve audit-log join). Verified live: `?vertical=Pharmacy & Wellness` returns named, filtered products, no 500.
- Earlier this session: catalog/product endpoints auth-gated + server-side min-order floor (`2609058a`); admin-web Template + "Refresh Import" buttons removed (UNCOMMITTED — rides the next admin-web push to Vercel; do NOT commit `apps/admin-web/vite.config.mts` — it has a local proxy override).

## YOUR IMMEDIATE NEXT TASK — Phase 2 FINAL item
**The `storeId` / `branch_id` FK fix.** The audit found `StoreProduct.storeId` is being set to a *branch* id with no FK enforced → **26 of 44 merchant listings are orphaned, only 2 of 4 stores return inventory** (this is why the catalog looks sparse). Refs from the audit: `schema.prisma` StoreProduct `storeId`, and the write at `apps/api/src/index.ts` ~`10452`.
- **Step 1 (read-only): investigate** the real Store ↔ branch ↔ StoreProduct relationship + enumerate the 26 orphans. Don't guess the keying.
- **Step 2:** propose the migration (FK/constraint) + the backfill SQL, **show it to me, and STOP** before applying.
- Then I confirm, you apply + verify, commit.

## After that — the remaining roadmap (each phase, fix-by-fix, my approval per step)
- **Phase 3 — Customer safety (MUST land before ANY Blinkit row is visible to customers):** veg/non-veg default is `?? true` so all food shows "veg" — fix to tri-state "unknown = no dot" in `apps/consumer-app/.../useProducts.ts:82` (**this file is `@lock` — I've pre-approved editing it; still show me the diff**); block ₹0 live listings; **re-host grofers.com images** to our Supabase bucket (hotlinked competitor CDN); add `is_deleted:false` to consumer queries; gate food verticals behind FSSAI; **hide stores with 0 active products from discovery** (I approved this — it's a `get_nearby_stores` change). Also: the veg/non-veg filter feature (food-only dots, food-store-only filter, a synced customer filter button) — Blinkit data has NO veg flag, so derive it (meat/fish/egg subcats → non-veg, else unknown).
- **Phase 4 — Scale:** server-paginated catalog picker (merchant app is capped at ~1000 rows + a `cleanName` dedup that hides pack sizes); the **streaming bulk-load CLI** for the 141k (do NOT use the in-memory `bulk-import-json` for 141k; resolve category via `CategoryMapping`; load rows **inactive + zero-stock + re-hosted images**).
- **Phase 5 — Polish** + then **the actual 141k load** + **data cleanup** of the current 294 (176 null vertical / 209 null category → recategorise; backfill 26 orphans; MRP-corrupted rows).
- **Deferred (not blocking):** after the Blinkit load is verified, delete old `source='zepto'` rows (134). Agreement v1.1 clauses for counsel (1.9% gateway fee + GST/TDS not yet papered). Merchant 1.2.5 + Consumer 1.1.2 native builds + the eSign/Global-Config OTAs are pending.

## Operational must-knows (we learned these the hard way)
- **API deploy (EB):** `cd /Users/pranavaditya/projects/pas-admin/apps/api && npm run build && eb deploy`. Confirm `eb status` is **Ready/Green** first. Commit `src/index.ts` + the tracked `dist/index.js`. Verify live with `curl https://api.pickatstore.io/...`. **Deploy only after I explicitly say so.**
- **DB migrations:** apply raw SQL via the **Prisma client `$executeRawUnsafe`** in a small node script (run from `apps/api`, `NODE_PATH="$PWD/node_modules"`), NOT `prisma db execute` (it choked on big JOIN-VALUES inserts, misleadingly reporting "table does not exist"). Verify with **rolled-back transactions** (create/update → read back → throw to roll back → 0 persisted). Migrations need my explicit "yes".
- **admin-web** deploys via `git push` → Vercel. Dev server: `cd apps/admin-web && VITE_API_PROXY=https://api.pickatstore.io npm run dev` → http://localhost:3001.
- Package managers: api=npm, admin-web=npm, consumer-app=yarn, merchant-app=npm.
- Communication: give me **plain-English + technical** layers. Save any docs as **self-contained HTML** in `docs/`. Keep `forlater.md` updated.

Start by orienting (steps 1-4), then begin the **`storeId` investigation** (read-only) and report what you find before proposing the migration.
