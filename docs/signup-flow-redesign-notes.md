# Notes for the merchant signup flow redesign (~May 2026)

Living document. Things that came up during day-to-day work that deserve attention when the signup/branch/staff data model is restructured. Bring this up at the start of the redesign so we don't relearn the same lessons.

---

## 1. The "orphan staff-role" edge case

### Discovered
May 20, 2026, during the post-demo audit of the `fk_storeproduct_branch` fix (Layers 1–3).

### The happy path (what we expect)

1. Owner adds a manager (e.g., Ravi) to a specific branch.
2. The system writes a `staff_roles` row linking Ravi's `user_id` to that `branch_id`.
3. Ravi logs in via OTP. `StoreContext.fetchStore` runs the discovery logic, finds his `staff_roles` row, builds his `activeContext` with the assigned branch.
4. Ravi navigates to Inventory → adds products → `StoreProduct.branch_id` is set to his assigned branch UUID → FK passes → save succeeds.

**If this chain stays intact, no edge case exists.**

### How the chain can break

| # | Trigger | What's left in DB |
|---|---|---|
| 1 | Owner deletes a branch from Settings → Branches | `merchant_branches` row gone, but `staff_roles` row for Ravi still references the deleted branch_id |
| 2 | Owner manually unassigns Ravi | `staff_roles` row deleted, but if Ravi's session is already active, his cached `activeStoreId` keeps pointing to the now-stale branch until next force-quit |
| 3 | Admin runs raw SQL (`DELETE FROM merchant_branches WHERE …`) without considering downstream tables | Same as case 1 but more catastrophic |
| 4 | A partial transaction failure during branch updates leaves staff_roles dangling | Same |

In all four cases, the **app code is fine**. The system is in an inconsistent state from operations external to the running app.

### What happens to the user in this state

Ravi opens the app. `StoreContext.fetchStore` runs:
- `realBranchIds` populates from whatever rows still exist in `merchant_branches`
- `allBranches` only includes branches Ravi is allowed to access — if he has no valid assignment to anything, this is empty
- `activeStoreId` falls back to `merchant_id` (the legacy phantom-branch behavior)
- Layer 3 guard `hasRealBranch` is `true` because `realBranchIds.size > 0`
- Guard lets the save proceed
- `StoreProduct.branch_id = merchant_id` → FK violation → cryptic DB error

### Why this is rare today

Three conditions must coincide:
1. Merchant has multiple branches in `merchant_branches`
2. The user is a non-owner (owners get all branches by default)
3. That user's branch assignments got orphaned/deleted/never-restored

For the current customer base — small Indian retail/dining merchants, mostly single-store, mostly owner-only logins — this is a corner of the corner.

### Why it should still be addressed in the redesign

Two reasons:
1. As you onboard more multi-branch chains and add proper staff management, this stops being a corner case.
2. The fix is structural (one ALTER TABLE), not a client guard. Cleaner.

### Recommended fix at the schema level

```sql
-- Pseudo-SQL; verify exact column names from the migration
ALTER TABLE staff_roles
  ADD CONSTRAINT fk_staff_roles_branch
  FOREIGN KEY (store_id) REFERENCES merchant_branches(id)
  ON DELETE CASCADE;
```

With `ON DELETE CASCADE`, deleting a branch automatically purges its staff_roles. The orphan state becomes impossible by construction.

**Audit every FK during the redesign:**
- `staff_roles.store_id → merchant_branches.id` (ON DELETE CASCADE)
- `staff_roles.merchant_id → merchants.id` (ON DELETE CASCADE)
- `StoreProduct.branch_id → merchant_branches.id` (already exists — verify cascade semantics)
- Any other table that points at `merchant_branches` or `merchants`

### Optional client-side belt-and-suspenders

If for some reason schema cascade isn't feasible, the cleaner guard in the modals would be:

```typescript
// Instead of: if (!hasRealBranch)
if (!realBranchIds.has(targetBranchId)) {
    Alert.alert('No active branch', '...');
    return;
}
```

Requires exposing `realBranchIds` (the Set) through the StoreContext value. About 30 minutes of work. **Only do this if cascade can't be enforced at the DB level.**

---

## 2. Bundle the long-standing signup bugs into the redesign

These are all currently patched at the symptom level. The redesign is the right place to fix them at the source.

### a. "Main store treated as corporate office"

Reported a few days ago. The current 7-step signup conflates the merchant entity with their first physical store. As a result, the first store gets special status that "real" branches don't have. The new flow should treat **every** physical location as a peer `merchant_branches` row, with `merchants` being purely the corporate/legal entity.

### b. Missing `merchant_branches` row at signup (the May 19 demo bug)

**Patched as of May 20, 2026** — see Layer 2 in `apps/api/src/index.ts` around line 3929. Always creates a default branch in the signup transaction. The redesigned 5-step flow inherits this naturally if branch creation is a proper step instead of a derived side-effect of store info.

### c. Missing Prisma `User` row on consumer signup (the May 19 demo bug)

**Patched at the data level** (backfill ran), but the upstream bug at `apps/api/src/index.ts:3258–3284` is still there: the `prisma.user.upsert` is gated on `if (assignedBranch)` so consumers fall through. Move that upsert outside the conditional during the redesign — same call, just one less indirection.

### d. Defense-in-depth in StoreContext (the May 20 Layer 3)

`hasRealBranch` flag and modal guards. Useful while the legacy fallback (`activeStoreId = merchant_id` when no branches) is still in place. **Once the redesign removes that fallback entirely** (i.e., every merchant always has a real branch by construction), `hasRealBranch` and the guards become dead code and can be removed.

---

## 3. Redesign target — 5-step flow recap (from chat May 20)

| Step | Purpose | Why this order |
|---|---|---|
| 1. Profile | Owner name, phone, email | Identity comes first, before any commercial data |
| 2. KYC | PAN, Aadhaar, GST, FSSAI, bank | Required for regulatory; if KYC fails, no point collecting store data |
| 3. Category + Payment | Which vertical (grocery/dining/etc.) + subscription tier | Determines required fields downstream (FSSAI mandatory for food, etc.) |
| 4. Branch creation | First (and possibly additional) physical locations | Every branch is a peer entity; merchant_branches row created per location |
| 5. Review + submit | Confirm and create everything atomically | Single ACID transaction creates Prisma User + Merchant + MerchantBranch + Subscription |

Down from the current 7 steps. Cuts:
- "Store details" as a separate first step (merged into Branch creation)
- "Has branches?" toggle (every signup creates at least one branch; "add more" is just an in-step button)

---

## 4. Open questions to resolve at redesign-kickoff

- Should the API's `/auth/merchant/signup` endpoint be split into per-step `PATCH` calls (so partial completion can be resumed) or stay as a single all-at-once POST at the review step?
- What's the cascade strategy when a merchant deletes their account? Do we soft-delete (`is_deleted` flag) or hard-delete with cascade?
- Should `Merchant.id` and `User.id` continue to share the same UUID? (Currently they do — `id: userId` in both `tx.user.upsert` and `tx.merchant.create`. Confusing because they're different conceptual entities.)
- Where does branch-level authentication live in the new model? Right now it's a mix of phone-on-`merchant_branches` and `staff_roles` table — these overlap and create the orphan-staff-role edge case.

---

## How to use this file

When the redesign starts, read this top-to-bottom before opening any code. Resolve the open questions in section 4 first, then design schema with section 1's cascade rules in mind, then build the new flow on top with section 2's known bugs already fixed at the source rather than re-patched.
