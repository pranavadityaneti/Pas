-- Phase 8 — safe RLS write-locks (subset of the broad RLS sweep, forlater #8).
-- These 4 tables are NOT written by any app via supabase-js (verified by
-- exhaustive grep across consumer/merchant/admin), so revoking anon/authenticated
-- writes closes the exposure with zero read-path risk. The remaining exposed
-- tables (merchants, Store, StoreProduct, Product, ProductImage) ARE written
-- directly by the apps and need the route-through-API treatment first — they are
-- NOT touched here.
--
-- Exposure closed:
--   City            — "Enable all access for all users" (qual=true) let anyone write cities
--   table_bookings  — "tb_service_all" (ALL qual=true)
--   ProductAuditLog — RLS off + anon/auth write grants (an audit log anyone could forge)
--   _prisma_migrations — RLS off + anon/auth grants (migration history, must be server-only)

-- City + table_bookings: RLS already on. Revoke WRITES only; keep SELECT (consumer
-- location list + booking reads). The qual=true ALL policies also serve reads, so
-- they stay — removing the write GRANT blocks writes at the privilege layer before
-- any policy is evaluated.
REVOKE INSERT, UPDATE, DELETE ON public."City"          FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public."table_bookings" FROM anon, authenticated;

-- ProductAuditLog + _prisma_migrations: no app touches them at all. Enable RLS +
-- revoke ALL → service_role (the API/migration tooling) only. RLS-on with no
-- policy = deny-all to anon/authenticated, which is exactly right for these.
ALTER TABLE public."ProductAuditLog"   ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ProductAuditLog" FROM anon, authenticated;

ALTER TABLE public."_prisma_migrations"   ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."_prisma_migrations" FROM anon, authenticated;

-- ROLLBACK (if ever needed):
--   GRANT INSERT, UPDATE, DELETE ON public."City" TO authenticated;
--   GRANT INSERT, UPDATE, DELETE ON public."table_bookings" TO authenticated;
--   ALTER TABLE public."ProductAuditLog" DISABLE ROW LEVEL SECURITY;
--   GRANT ALL ON public."ProductAuditLog" TO authenticated;  (+ anon as needed)
--   ALTER TABLE public."_prisma_migrations" DISABLE ROW LEVEL SECURITY;
