-- 1. Open merchant_branches for Public Discovery
DROP POLICY IF EXISTS "Enable public read for active branches" ON public.merchant_branches;
CREATE POLICY "Enable public read for active branches"
ON public.merchant_branches
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Enable RLS if not already enabled (safety measure)
ALTER TABLE public.merchant_branches ENABLE ROW LEVEL SECURITY;

-- 2. Open merchants for Public Discovery (Nested Joins)
DROP POLICY IF EXISTS "Enable public read for active merchants" ON public.merchants;
CREATE POLICY "Enable public read for active merchants"
ON public.merchants
FOR SELECT
TO anon, authenticated
USING (status = 'active' OR status IS NULL);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

-- 3. Open Vertical table for Public Discovery
DROP POLICY IF EXISTS "Enable public read for verticals" ON public."Vertical";
CREATE POLICY "Enable public read for verticals"
ON public."Vertical"
FOR SELECT
TO anon, authenticated
USING (true);

ALTER TABLE public."Vertical" ENABLE ROW LEVEL SECURITY;
