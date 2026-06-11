-- Phase 8 (2026-06-11) — RLS lockdown.
-- Closes the two real PostgREST exposures + adds defense-in-depth on 5
-- sensitive tables. Pre-snapshot at scripts/p8_rls_snapshot.ts +
-- /tmp/p8_pre.txt (also committed to scripts/).
--
-- Real exposures fixed:
--   1. "User"          — RLS off, full grants to anon+authenticated, plus an
--                        "Allow public read for debug" policy with qual=true.
--                        Any PostgREST JWT could read every user's email,
--                        phone, role, isAdmin status.
--   2. order_items     — RLS off, full grants to anon+authenticated, only an
--                        INSERT policy was attached (dormant). Anyone could
--                        SELECT any customer's items.
--
-- Defense-in-depth (already grants=[] pre-migration; lockdown so a future
-- accidental GRANT doesn't open them):
--   audit_log, commission_rules, merchant_settlement_profiles,
--   settlement_cycles, settlement_lines
--
-- Verified pre-migration:
--   - handle_new_user() is SECURITY DEFINER → trigger bypasses RLS so signup
--     keeps working.
--   - Every direct supabase-js User read (UserContext, settings/{index,
--     notifications,profile}, AuthContext) is either id=auth.uid() (covered
--     by self_read) or done by a SUPER_ADMIN (covered by the existing
--     "Super Admins can read all profiles" / "Super Admins manage all"
--     policies that stay).
--   - createAdmin INSERTs (not UPDATEs) so column-level UPDATE revoke does
--     not affect it — the "Super Admins manage all" ALL policy covers the
--     insert path.
--   - Merchant settings updates touch only notification_preferences (not
--     in REVOKE list) and name+email (not in REVOKE list).
--   - No app reads order_items via PostgREST (only the API does, via
--     service_role which bypasses RLS).

-- ═══════════════════════════════════════════════════════════════════════
-- 1. "User" — close the wide-open SELECT, enable RLS, add self-scope policies
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow public read for debug" ON public."User";

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

-- Self-read: a user can see their own row.
-- SUPER_ADMINs see all rows via the pre-existing
-- "Super Admins can read all profiles" + "Super Admins manage all" policies.
CREATE POLICY "self_read" ON public."User" FOR SELECT
    USING (id = auth.uid());

-- Self-update: a user can update their own row. WITH CHECK is identical so
-- they cannot change `id` to another user's. Privilege-escalation columns
-- are blocked by REVOKE below.
CREATE POLICY "self_update" ON public."User" FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Column-level lockdown. A regular authenticated user — including a
-- malicious one with a stolen JWT — cannot promote themselves to SUPER_ADMIN
-- or unsuspend themselves through PostgREST. Role assignment / suspension
-- must go through the API (service_role bypasses RLS + column grants).
REVOKE UPDATE ("role", "isAdmin", "status", "suspended_at", "suspended_reason")
    ON public."User" FROM authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. order_items — enable RLS, self-orders SELECT policy
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Customer can read items belonging to their own orders. The existing
-- INSERT policy "Users can insert their own order items" stays attached and
-- now activates.
CREATE POLICY "select_own_order_items" ON public.order_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id
          AND (o.user_id)::text = (auth.uid())::text
    ));

-- No UPDATE / DELETE policies on order_items — the API (service_role) is
-- the only authorized mutator. RLS-on without a policy for a command =
-- deny-all to non-service_role.

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Defense-in-depth: enable RLS + REVOKE on 5 sensitive tables
-- ═══════════════════════════════════════════════════════════════════════
-- Grants are already empty pre-migration; this is belt-and-braces so a
-- future accidental GRANT (e.g. someone adding a Supabase Studio role
-- or a migration that copies grants from another table) doesn't silently
-- open these. RLS-on with no policy = deny-all to non-service_role.

ALTER TABLE public.audit_log                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_settlement_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_cycles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_lines             ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_log                    FROM anon, authenticated;
REVOKE ALL ON public.commission_rules             FROM anon, authenticated;
REVOKE ALL ON public.merchant_settlement_profiles FROM anon, authenticated;
REVOKE ALL ON public.settlement_cycles            FROM anon, authenticated;
REVOKE ALL ON public.settlement_lines             FROM anon, authenticated;
