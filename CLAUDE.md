# PAS (Pick At Store) — Project Context

## Who is Pranav
Pranav builds with LLM coding agents. He is NOT a coder — he describes what he wants, the agent writes code. One issue at a time. Never ship code without explicit approval. Never bundle multiple changes.

## Project Structure
Monorepo with 3 apps:
- `apps/consumer-app` — Expo/React Native (customer-facing, iOS/Android)
- `apps/merchant-app` — Expo/React Native (merchant tablet)
- `apps/api` — Express + Prisma + Supabase (backend)

**Stack:** Expo Go (SDK 54), Supabase (Postgres + Realtime + Auth), Prisma ORM, Razorpay payments.

## Production Deployment
- **Consumer app:** v1.1.1 (build 15) on TestFlight + Android AAB (build 12) on Play Store internal testing. Last OTA: `8fea9228-91bb-4845-9342-2c90fd332bdc` (May 19, 2026 demo session) — covers tax invoice modal, Razorpay session-recovery in CheckoutScreen + DiningCheckoutScreen, on-screen error diagnostics. Published to **both iOS and Android**.
- **Merchant app:** v1.2.3 (build 14) on TestFlight — iOS OTA `0f761fad-8f4f-4de6-918b-d4a3dff2dfe9` pushed May 19, 2026 **from the main repo** (`/Users/pranavaditya/projects/pas-admin/apps/merchant-app/`) after an earlier worktree push catastrophically regressed all uncommitted features. Bundle contains: full FilterModal redesign (Pass 1–3), branch-level login, dashboard schedule banner, signup expo-file-system fix, dining branch settings, Bookings + Slot Config screens, AddMenuProductModal duplicate-name fix. **Bundle verified to contain `https://api.pickatstore.io`** (not local IP) AND feature markers (`MENU_SECTION_OPTIONS`, `toggleBoth`, `active_branch_id`, `bookings`, `slot-config`, etc.). Bundle size 3.12 MB. **Android push blocked until May 20** (Play Store window).
- **API:** `https://api.pickatstore.io` on AWS Elastic Beanstalk (`pas-api-prod-v2`, `ap-south-1`)

## OTA Updates
- Ship consumer OTA: `cd apps/consumer-app && npx eas-cli update --branch production --message "description"`
- Ship merchant OTA: `cd apps/merchant-app && npx eas-cli update --branch production --message "description"`
- For platform-specific pushes use `--platform ios` or `--platform android` (e.g. when one platform is gated by store review).
- OTA covers JS/TS changes only. Not: new packages, app.json, permissions, SDK upgrades.
- `eas.json` production env overrides `.env` for OTA builds **only when set there**. The merchant-app currently reads `.env` directly — see Pre-OTA .env Protocol below.

## ⚠️ Pre-OTA .env Protocol (CRITICAL)
Both `apps/consumer-app/.env` and `apps/merchant-app/.env` keep `EXPO_PUBLIC_API_URL` pointed at the local dev IP (`http://192.168.29.17:3000`) for day-to-day development. **`expo-updates` bakes the .env values into the JS bundle at push time** — pushing while .env is on the local IP will brick every production install.

**Before every OTA push (REVISED May 19, 2026 — see lessons learned at the bottom of this section):**

1. **Run `pwd` and `git status` first** at the directory you intend to push from. **Two things must be true:**
   - **`pwd` matches the working tree that contains the code you want to ship.** If you're inside `.claude/worktrees/<name>/apps/<app>/`, that worktree's branch + working tree is what EAS will bundle — NOT the main repo. Worktrees are independent working trees; they can be on different branches with totally different uncommitted state.
   - **`git status` shows the modified/untracked files you expect to be in the bundle.** If you've been editing files via absolute paths under `/Users/pranavaditya/projects/pas-admin/apps/<app>/` (main repo path) but `pwd` is a worktree, your edits are NOT visible to EAS — they live in the main repo's working tree, not the worktree's. **If `git status` looks suspiciously clean, you're about to regress production.** Switch to the main repo (or the worktree whose working tree has your changes) before pushing.
2. **Check cwd's `.env` directly.** `.env` is gitignored, so each worktree + the main repo have independent `.env` files. The one EAS reads is the one at `cwd/.env`, not at any sibling location. If the worktree has no `.env`, EAS bundles `process.env.EXPO_PUBLIC_API_URL` as whatever's in the shell environment (often nothing useful).
3. Flip the relevant `.env` `EXPO_PUBLIC_API_URL` → `https://api.pickatstore.io` (at the cwd's `.env`, creating it if necessary).
4. Run `npx eas-cli update --branch production --platform <ios|android> --message "..." --clear-cache`
   - **`--clear-cache` is mandatory whenever env vars change.** Metro caches bundles by source-hash, not env-hash; without `--clear-cache` a previous broken bundle is re-uploaded under a new update ID, leaving the bug in place. Symptom: the launchAsset URL stays identical across pushes.
5. **Verify the bundle before telling the user to relaunch.** Download the launchAsset from EAS CDN and grep for:
   - **The expected URL** (`https://api.pickatstore.io` present, `192.168.*` absent)
   - **Feature markers** — unique identifier strings from the features you expect to be in this push (e.g. constants `MENU_SECTION_OPTIONS`, function names like `toggleBoth`, route paths like `bookings`/`slot-config`, or screen names). The bundle size also goes up when features are added — note it and compare across pushes.
   ```
   # Pull manifest, extract launchAsset URL + bearer, download, strings-grep
   curl -sS -H "expo-platform: ios" -H "expo-runtime-version: <version>" -H "expo-channel-name: production" -H "expo-accept-signature: false" "https://u.expo.dev/update/<ios-update-id>"
   # then download launchAsset with its EAS-HMAC-SHA256 Authorization header
   strings bundle.hbc | grep -oE "https?://[a-zA-Z0-9._-]+(:[0-9]+)?" | sort -u
   strings bundle.hbc | grep -oE "<marker1>|<marker2>|<marker3>" | sort -u
   ```
   Only after BOTH checks pass, tell the user to force-quit and relaunch.
6. **Immediately** revert `.env` `EXPO_PUBLIC_API_URL` back to `http://192.168.29.17:3000` at the same path you edited in step 3.
7. If you created a worktree `.env` solely for the push, delete it after revert — keeps state clean.

### Lessons learned the hard way (May 19, 2026)
- **Worktree-vs-main-repo gotcha (catastrophic):** I pushed an OTA from a worktree whose branch was at clean `origin/main`, while ALL the recent features (FilterModal Pass 1-3, dashboard schedule banner, branch-level login, dining settings, Bookings + Slot Config screens, my own session's InvoiceModal work) were uncommitted in the **main repo's** working tree. EAS bundled the worktree's old code, the OTA shipped, and TestFlight users lost every recent feature in one push. **Always run `git status` in the cwd before pushing.** If it shows no uncommitted features you expect to ship, you're in the wrong directory. The fix was a clean re-push from `/Users/pranavaditya/projects/pas-admin/apps/merchant-app/` (main repo) verified by `strings`-grepping for feature markers.
- **Worktree-.env gotcha:** I once pushed an OTA from a worktree where I had only flipped the main-repo `.env`. The worktree had no `.env`, Metro bundled with local IP, the OTA shipped broken, and merchant TestFlight users saw "Network request failed" on Send OTP. Verification step caught it; clean re-push with `--clear-cache` fixed it.
- **Metro cache gotcha:** Without `--clear-cache`, the second OTA push had the IDENTICAL launchAsset hash (`5rvGJ_jsot__...`) as the broken first push — proof Metro served from cache.
- **Always grep the bundle.** "I pushed the OTA" ≠ "the OTA contains what I expect". One curl + strings is the only honest verification — for BOTH the env URL AND for feature markers. Bundle size delta is a useful sanity check too.

## Known Pre-existing TypeScript Errors (ignore these)
- API: 3 errors at lines 1702, 1833, 1841 in `index.ts`
- Consumer: 3 errors in `DiningCheckoutScreen.tsx` at lines 143 (x2), 355

## ⚠️ Known Backend Bugs (need permanent fix — flagged May 19, 2026 demo)

### Missing Prisma `User` row on customer OTP signup (CRITICAL)
**Symptom:** Customer pays via Razorpay successfully, then `POST /orders` returns 500 with `Foreign key constraint violated: fk_orders_user (index)`. Money charged, order not created. UI shows "Order Sync Failed". This took out the demo until a manual backfill.

**Root cause:** `apps/api/src/index.ts:3258-3284` — the OTP login handler only calls `prisma.user.upsert(...)` if the phone matches a `merchantBranch`. Customers (no branch match) get a Supabase Auth user but NO row in the Prisma `User` table. Any FK from `orders.userId → User.id` then fails on first order.

**Workaround applied during demo:** Direct backfill script ran via API's `prisma.user.create()` against every Supabase Auth user not present in the `User` table. 16 rows inserted. Pattern below; reuse if it happens again.

```js
// Run from apps/api/ with the API .env loaded (has SUPABASE_SERVICE_ROLE_KEY + DATABASE_URL)
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");
const prisma = new PrismaClient();
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supa.auth.admin.listUsers({ perPage: 1000 });
const existing = new Set((await prisma.user.findMany({ select: { id: true } })).map(u => u.id));
for (const u of data.users.filter(u => !existing.has(u.id))) {
  await prisma.user.create({ data: { id: u.id, email: u.email || `${u.id}@phone.pickatstore.app`, phone: u.phone || null, role: "CONSUMER" } });
}
```

**Permanent fix needed (next session):**
1. Move the `prisma.user.upsert` block in `apps/api/src/index.ts` OUT of the `if (assignedBranch)` conditional so it runs for **every** OTP login regardless of merchant-branch match. Default `role: 'CONSUMER'` when no branch is assigned.
2. Defense in depth: add `prisma.user.upsert(...)` at the top of the `POST /orders` handler (~line 1876) so `/orders` is self-healing if a user slipped through.
3. Add an automated regression test that signs up a fresh customer via OTP, places a paid order, and asserts both the Razorpay payment AND the `orders` row land — to catch this class of bug before another demo.

### Missing `merchant_branches` row on merchant signup
**Symptom:** New merchant tries to add products → `insert or update on table "StoreProduct" violates foreign key constraint "fk_storeproduct_branch"`.

**Root cause:** `apps/merchant-app/app/(auth)/signup.tsx` does not create a `merchant_branches` row when a merchant signs up. StoreContext falls back to using `merchant_id` as `activeStoreId`, which violates the `StoreProduct.branch_id → merchant_branches.id` FK on save.

**Workaround for affected merchants:** Settings → Branches → Add Branch (via the in-app UI), then force-quit + reopen.

**Permanent fix needed:** Auto-create a default `merchant_branches` row at signup time using the merchant_id (or change StoreContext to call an API endpoint that ensures one exists before letting product saves proceed).

## Detailed State
See `PAS_HANDOFF.md` for full current state, bugs, and next steps — updated after every change.

## Merchant Signup Flow Redesign — READ BEFORE TOUCHING SIGNUP CODE
`docs/signup-flow-redesign-notes.md` accumulates issues to bundle into the planned redesign (~late May 2026): the orphan-staff-role edge case + recommended `ON DELETE CASCADE` schema rules, the still-unfixed Prisma User upsert gating, the patched-but-symptom-level bugs that should be re-solved at the source, and the proposed 5-step flow. Read it first; do not re-patch any of those bugs piecemeal — bring them into the redesign.

## Workflow Protocol
1. Claude writes the EXACT task — prescriptive, one change at a time
2. Every task ends with "STOP after this. Wait for approval."
3. Agent makes the change, shows diff + tsc output
4. Claude reviews before approving
5. Never let the agent bundle multiple changes
6. Always verify `tsc --noEmit` after every change
7. **Stay inside the feature you were asked to change.** When working on one feature, do NOT modify code attached to a different feature. If touching adjacent code is genuinely necessary (shared util, type, hook), STOP first and tell Pranav: (a) which other code needs to change, (b) why it's necessary, (c) what could break in the other feature as a result. Wait for explicit approval before touching it. No silent scope creep.

## Model Policy
- **Never use Haiku.** Only Claude Opus 4.6 or Opus 4.7. This applies to the primary assistant, all sub-agents, and any spawned tasks.
- If a tool, agent, or spawned session would default to Haiku, override it to Opus 4.6/4.7. If override isn't possible, stop and tell Pranav before proceeding.

## Communication Style
- **Always provide a plain-English explanation alongside the technical one.** Whenever you give a technical answer (code paths, SQL, RLS, audit findings, fix proposals, status reports), also include a short "in plain English" version that a non-engineer founder would understand. Pranav is technical but values both layers — the technical for verification, the English for decisions.
- Example: after explaining a code fix in terms of `useEffect` + Supabase Realtime + AppState, also add a "What the merchant will experience after this lands" or "In plain English" section.
- Don't bury the English under jargon. Lead with the user-visible effect when the user-visible effect is the point.

## Mandatory Session Logging
- **`SESSION_LOG.md`** — Updated every ~30 minutes during active work, and ALWAYS before a session ends.
- Captures: timeline of changes, decisions made, errors encountered, open threads, and files modified.
- Each context window picks up from where the last left off by reading this file.
- **`PAS_handoff.md`** — Comprehensive technical reference. Updated at end of every session with all changes made.

## Deferred Work Queue (`forlater.md`)
- **Read `forlater.md` at the start of every session** — surface a short summary to Pranav: "You have N items queued — top 3 are X, Y, Z. Want to tackle any?" Treat this as a hard rule, same priority as reading `SESSION_LOG.md`.
- **Re-surface the queue at natural phase breaks during a session**: after closing a task, when Pranav asks "what next", when a thread wraps up, before a long break. Do NOT silently skip these checkpoints. A strict wall-clock hourly timer is not feasible inside the conversation harness — phase-break checkpoints are the workable substitute.
- **When a queued item becomes active**, move it from "Active queue" → "In progress" inside `forlater.md`. When done, move to "Done — archived" with completion date. Never silently delete.
- **When a new item is deferred**, add it to `forlater.md` immediately with: title, what + why, scope, status, date, originated-from. Do not rely on memory — write it down.
- **Do not bypass the queue** by re-introducing a deferred item into the current change scope. Honor Pranav's "not now" decisions.

## OTA Update Tracking
- **`OTA_Updates.md`** — Every JS/TS change that can ship via OTA is logged here immediately after implementation.
- After **6 new changes accumulate**, Claude MUST remind: "⚠️ 6+ OTA changes queued. Should we push an OTA update before continuing?"
- OTA covers JS/TS changes ONLY. Not: app.json, native packages, permissions, SDK upgrades.
- Consumer OTA: `cd apps/consumer-app && npx eas-cli update --branch production --message "description"`
- Merchant OTA: `cd apps/merchant-app && npx eas-cli update --branch production --message "description"` (unblocked May 19, 2026; iOS shipping, Android pending May 20).

## Locked Files (`@lock` convention)
Files marked with `// @lock` at the top **must not be edited without explicit chat-confirmed permission from Pranav**. If a task seems to require editing one, stop and ask first. Layout/cosmetic edits to other parts of the file are fine — the lock comment describes its specific protected scope.

### Merchant app
- `src/components/FilterModal.tsx` — **entire file** locked (Pass 3, May 19 2026). Dining/pickup sidebar split, canonical option lists ("Both" dietary shortcut), shape-tolerant `cascadedBrands`, Android keyboard via percentage modal height + `softwareKeyboardLayoutMode: "resize"`.
- `app/(main)/inventory.tsx` — **filter-wiring section** locked. `DEFAULT_FILTERS` shape, `availableCategories` useMemo, FilterModal props, dining matching logic, conditional Availability branch, conditional quick-filter chips, `CATEGORY_MAP`.
- `app/(main)/catalog-picker.tsx` — **`DEFAULT_FILTERS` + FilterModal invocation** locked. Must stay in sync with `FilterState` interface; `isGlobalInventory` + `verticalPills` props are required for the global catalog flow.
- `app/(auth)/signup.tsx`, `app/(main)/settings/store-details.tsx`, `app/(main)/settings/staff.tsx`, `app/(main)/settings/payouts.tsx`, `src/components/AddCustomProductModal.tsx` — pre-existing locks from earlier sessions.

### Consumer app
- `src/context/CartContext.tsx` — cart merge logic locked (auth listener merges guest cart on SIGNED_IN or any first-session event including TOKEN_REFRESHED).
- `src/screens/AuthScreen.tsx` — KAV `behavior="padding"` lock (regular screen, not Modal).
- `src/components/TransactionalAuthModal.tsx` — manual `Keyboard` listener lock (Modal-based bottom sheet, KAV unreliable here).
- `src/screens/DiningCheckoutScreen.tsx` — **hard lock** (May 19, 2026 demo): sticky header + flex CTA + Android picker dismiss + `handlePaymentSuccess` session-recovery (`refreshSession` before `getSession` reads).
- `src/screens/CheckoutScreen.tsx` — **hard lock** (May 19, 2026 demo): sticky CTA layout + `handlePaymentSuccess` session-recovery (`effectiveUser` pattern: refresh + getSession to recover from Razorpay WebView session eviction) + `errorDiagnostic` state + on-screen red diagnostic box that surfaces the actual exception message (this was what found the missing-Prisma-User-row bug live during the demo — do NOT remove the diagnostic UI without replacing with an equivalent logging mechanism).
- `src/components/BookingModal.tsx` — pinned header/footer + scrollable middle lock.
- `src/components/InvoiceModal.tsx` — **entire file** locked (V1 invoice approved May 19, 2026). Bottom-sheet tax invoice; seller block with merchant GSTIN; pickup vs dine-in branching; PDF download deferred to next EAS Build with `expo-print` + `expo-sharing`.
- `src/screens/YourOrdersScreen.tsx` — **invoice-related sections** locked. The `fetchOrders` Supabase select (must keep the `branch.merchant.gst_number` join), the order card's `onPress` handler that opens InvoiceModal, the `selectedOrder` / `invoiceVisible` state, and the `<InvoiceModal />` render at the bottom of the tree. Other parts (card layout, statuses, refresh logic) remain freely editable.
- `src/hooks/useOrderRequests.ts` — **entire file** locked (May 25, 2026). Polling fallback + AppState reconnect for Supabase Realtime; verified working on Android pickup orders. Order acceptance UX hangs on this hook. Do not edit without explicit approval.
- Plus pre-existing locks on: AuthContext, LocationContext, MainTabNavigator, supabase.ts, OnboardingScreen, ProfileScreen, ProfileSetupScreen, HomeScreen, HomeFeedScreen, StorefrontScreen, CartScreen, DiningScreen, LocationPickerScreen, SupportScreen, CartSummaryBar, dataTransformer, useProducts, useProductFavorites, useStores, useFavorites.

### How locks work
- A `@lock` header doesn't prevent the agent from technically editing the file — it's an institutional flag.
- When Claude opens a locked file in any subsequent session, it must read the lock comment, stop, and ask the user "this file is locked for [reason]; do you want me to override the lock to make [specific change]?"
- The user's explicit "yes proceed" in chat is the override. After editing, refresh the lock comment to reflect the new approved state and date.

---

## Operating Rules (added 2026-05-29 — apply every session, no exceptions)

### 1. Honesty about uncertainty
If you are uncertain about any fact, statistic, approach, execution, plan, or idea — **say so explicitly before including it.** "I'm not certain about this" is always better than presenting a guess as fact. **Never fill gaps with plausible-sounding information.**

### 2. End every execution with a brief status summary (not a recap)
- **General tasks:** end with — **What changed · What was left untouched · What needs your attention.** Keep it short.
- **Coding tasks:** end with — **Files changed** (one line per file, what was modified) · **Files intentionally not touched** · **Follow-up needed.** Keep it short.

### 3. Maintain ERRORS.md
When an approach takes **more than 2 attempts** to work, log in `ERRORS.md`: what didn't work, what worked, and what to remember next time. **Check `ERRORS.md` before suggesting approaches to similar tasks.**

### 4. Strict scope — touch only what the task needs
Only modify the files, functions, and lines **directly related to the current task.** Do **not** refactor, rename, or "improve" anything not explicitly asked. If you notice something worth fixing elsewhere — **mention it, do not touch it. Ever.**

### 5. Stop before anything irreversible
Before deleting any file, overwriting existing code, dropping DB records, or any change that **cannot be trivially undone** — **stop completely. List exactly what will be affected. Ask for explicit confirmation. Proceed only after an explicit "yes" in the current message.**

### 6. Actions requiring explicit in-session confirmation (no exceptions)
- Deploying to any environment
- Running migrations on any database
- Sending any email or external API call
- Executing any command with irreversible external side effects
