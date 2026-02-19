
-- Fix permissions for the subscriptions table
-- Issue: 'authenticated' role was denied access even with RLS enabled because basic GRANTs were missing.

-- 1. Grant basic table permissions
GRANT ALL ON TABLE public.subscriptions TO service_role;
GRANT ALL ON TABLE public.subscriptions TO postgres;
GRANT SELECT, INSERT ON TABLE public.subscriptions TO authenticated;

-- 2. Ensure RLS is enabled (redundant but safe)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Re-apply Policies (Drop first to avoid errors if they exist)
DROP POLICY IF EXISTS "Enable insert for merchants" ON public.subscriptions;
CREATE POLICY "Enable insert for merchants" ON public.subscriptions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = merchant_id::text);

DROP POLICY IF EXISTS "Enable select for owner" ON public.subscriptions;
CREATE POLICY "Enable select for owner" ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = merchant_id::text);
