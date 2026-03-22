-- ==========================================
-- ADMIN DASHBOARD LOGIN FIX
-- ==========================================
-- This script enables Row Level Security (RLS) on the "User" table
-- and allows authenticated users to see their own profile.
-- Run this in the Supabase SQL Editor.

-- Enable RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- 1. Allow users to read their own record (Crucial for login)
DROP POLICY IF EXISTS "Users can read own profile" ON "User";
CREATE POLICY "Users can read own profile"
ON "User"
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Allow Super Admins to read all records (Crucial for Dashboard modules)
DROP POLICY IF EXISTS "Super Admins can read all profiles" ON "User";
CREATE POLICY "Super Admins can read all profiles"
ON "User"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "User"
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  )
);

-- 3. Allow Super Admins to update records (For managing users/roles)
DROP POLICY IF EXISTS "Super Admins can update all profiles" ON "User";
CREATE POLICY "Super Admins can update all profiles"
ON "User"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "User"
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "User"
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  )
);
