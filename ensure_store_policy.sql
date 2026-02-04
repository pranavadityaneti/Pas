-- Ensure Store table has RLS enabled
ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;

-- 1. Allow Store Manager to UPDATE their own store
-- This policy allows a user to update rows in the "Store" table
-- where their User ID matches the store's "managerId".
DROP POLICY IF EXISTS "Managers can update their own store" ON "Store";

CREATE POLICY "Managers can update their own store"
ON "Store"
FOR UPDATE
USING (auth.uid()::text = "managerId")
WITH CHECK (auth.uid()::text = "managerId");

-- 2. Allow Store Manager to SELECT their own store 
-- (Usually exists, but good to ensure)
DROP POLICY IF EXISTS "Managers can view their own store" ON "Store";

CREATE POLICY "Managers can view their own store"
ON "Store"
FOR SELECT
USING (auth.uid()::text = "managerId");

-- 3. Allow Store Manager to INSERT their own store
DROP POLICY IF EXISTS "Managers can create their one store" ON "Store";

CREATE POLICY "Managers can create their one store"
ON "Store"
FOR INSERT
WITH CHECK (auth.uid()::text = "managerId");
