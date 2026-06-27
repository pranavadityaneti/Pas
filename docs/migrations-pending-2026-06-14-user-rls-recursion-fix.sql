-- ════════════════════════════════════════════════════════════════════════
-- FIX: infinite recursion in public."User" RLS policies   (2026-06-14, HOTFIX)
--
-- The "Super Admins can read all profiles" (SELECT) and "Super Admins manage
-- all" (ALL) policies each ran  EXISTS (SELECT 1 FROM "User" WHERE id=auth.uid()
-- AND role='SUPER_ADMIN')  — a subquery on "User" from inside a "User" policy.
-- Any read of "User" (e.g. admin login's profile fetch) → Postgres 42P17
-- "infinite recursion detected in policy for relation User".
--
-- Fix: a SECURITY DEFINER helper that checks the caller's role with RLS BYPASSED
-- (owned by postgres), so the policy no longer self-references. self_read /
-- self_update are unaffected. Atomic.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "Super Admins can read all profiles" ON public."User";
CREATE POLICY "Super Admins can read all profiles" ON public."User"
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admins manage all" ON public."User";
CREATE POLICY "Super Admins manage all" ON public."User"
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

COMMIT;

-- Verify:
--   SELECT policyname, qual FROM pg_policies WHERE schemaname='public' AND tablename='User';
--     -> the two Super Admin policies should read  is_super_admin()  (no SELECT FROM "User")
