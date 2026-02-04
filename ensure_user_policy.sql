-- Ensure User table has RLS enabled
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- 1. Allow Users to UPDATE their own profile
-- This matches the auth.uid() with the User.id
DROP POLICY IF EXISTS "Users can update own profile" ON "User";

CREATE POLICY "Users can update own profile"
ON "User"
FOR UPDATE
USING (auth.uid()::text = id)
WITH CHECK (auth.uid()::text = id);

-- 2. Allow Users to SELECT their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON "User";

CREATE POLICY "Users can view own profile"
ON "User"
FOR SELECT
USING (auth.uid()::text = id);

-- 3. Allow Users to INSERT their own profile (if not already handled by triggers)
DROP POLICY IF EXISTS "Users can insert own profile" ON "User";

CREATE POLICY "Users can insert own profile"
ON "User"
FOR INSERT
WITH CHECK (auth.uid()::text = id);
