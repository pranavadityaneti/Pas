-- ════════════════════════════════════════════════════════════════════════════
-- Phase 8 — merchant_branches WRITE lockdown  (STAGED — DO NOT APPLY YET)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⛔ GATING CONDITION (hard): apply ONLY after the merchant-app OTA carrying the
--    Phase 8 branch-CRUD refactor (commit a1cac38d, services/branches.ts +
--    StoreContext + settings screens) has PROPAGATED to the merchant fleet.
--    Until then, old merchant installs still write merchant_branches directly
--    via supabase-js; revoking the grant now would break their branch
--    management, online/offline toggle, and store-timings save instantly.
--
--    This mirrors the REQUIRE_COUPON_TOKEN flip discipline: code ships first,
--    propagates, THEN the enforcement lands.
--
-- WHY THIS IS SAFE ONCE GATED:
--   - All merchant_branches WRITES now go through the API:
--       merchant-app  → services/branches.ts → POST/PUT/DELETE /merchant/branches
--       admin-web     → useMerchants.ts      → POST/DELETE /merchant/branches
--     (verified: exhaustive grep shows ZERO direct supabase-js writes remain.)
--   - The API uses service_role, which BYPASSES grants + RLS — unaffected.
--   - READS stay open (SELECT grant + policies untouched): the consumer
--     storefront (anon) and the merchant discovery flow (login.tsx,
--     StoreContext.tsx) both SELECT merchant_branches via supabase-js, and
--     branch data is semi-public (name/address/location already on the
--     storefront). The security hole was WRITE access, not read.
--
-- WHAT THIS CLOSES:
--   Before: qual=true RLS policies on INSERT/UPDATE/DELETE meant ANY
--   authenticated user (incl. any logged-in consumer) could modify or delete
--   ANY merchant's branch. After: only the API (service_role) can write.
--
-- HOW TO APPLY (when gated condition met):
--   1. mkdir prisma/migrations/<ts>_phase8_branch_write_lockdown
--   2. cp this file there as migration.sql (strip the STAGED header)
--   3. npx prisma migrate deploy
--   4. npx ts-node scripts/phase8_branch_lockdown_verify.ts   (all checks pass)
--   5. Smoke: merchant app online/offline toggle + branch edit still work
--      (they hit the API now); a raw supabase-js write returns permission denied.
-- ════════════════════════════════════════════════════════════════════════════

-- Revoke write grants from the PostgREST roles. SELECT is intentionally kept.
REVOKE INSERT, UPDATE, DELETE ON public.merchant_branches FROM anon, authenticated;

-- Drop the now-moot over-permissive write policies (hygiene — the grant revoke
-- above is the load-bearing change; these qual=true policies become dead once
-- the grant is gone, but removing them keeps the policy list honest).
DROP POLICY IF EXISTS "Enable insert for users based on merchant_id" ON public.merchant_branches;
DROP POLICY IF EXISTS "Enable branch insert for authenticated users"  ON public.merchant_branches;
DROP POLICY IF EXISTS "Enable update branches for authenticated users" ON public.merchant_branches;
DROP POLICY IF EXISTS "Enable delete branches for authenticated users" ON public.merchant_branches;
-- NOTE: keep the scoped owner policies + the public is_active SELECT policy +
-- the authenticated SELECT policy (discovery). Only the qual=true WRITE policies
-- and the write GRANTS are removed.

-- ROLLBACK (if needed):
--   GRANT INSERT, UPDATE, DELETE ON public.merchant_branches TO authenticated;
--   (the dropped policies can be recreated from this file's git history, but the
--    grant alone restores the pre-lockdown behavior.)
