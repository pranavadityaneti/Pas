-- =============================================
-- RLS Policies for Notifications System
-- Run this in the Supabase SQL Editor
-- =============================================

-- 1. NOTIFICATIONS TABLE
-- =============================================

-- Enable RLS (safe to run even if already enabled)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

-- SELECT: Merchants can only read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- UPDATE: Merchants can only mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NOTE: No INSERT policy for authenticated users.
-- The API server inserts notifications using the service_role key (bypasses RLS).


-- 2. MERCHANT PUSH TOKENS TABLE
-- =============================================

-- Enable RLS
ALTER TABLE public.merchant_push_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Users can read own push tokens" ON public.merchant_push_tokens;
DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.merchant_push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON public.merchant_push_tokens;
DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.merchant_push_tokens;

-- SELECT: Users can only read their own tokens
CREATE POLICY "Users can read own push tokens"
  ON public.merchant_push_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can only register tokens for themselves
CREATE POLICY "Users can insert own push tokens"
  ON public.merchant_push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own tokens (e.g., set is_active = false)
CREATE POLICY "Users can update own push tokens"
  ON public.merchant_push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can remove their own tokens (logout cleanup)
CREATE POLICY "Users can delete own push tokens"
  ON public.merchant_push_tokens FOR DELETE
  USING (auth.uid() = user_id);
