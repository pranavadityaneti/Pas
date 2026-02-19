
-- Fix permissions for the notifications table
-- Issue: 'authenticated' role was denied access.

-- 1. Grant basic table permissions
GRANT ALL ON TABLE public.notifications TO service_role;
GRANT ALL ON TABLE public.notifications TO postgres;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;

-- 2. Ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. create policies
-- Users can see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = user_id::text);

-- Users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = user_id::text);
