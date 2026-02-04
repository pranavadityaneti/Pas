-- Fix StoreStaff RLS policies using a SECURITY DEFINER function
-- This avoids issues where the user might not have direct access to query the Store table context in the subquery

-- 1. Create a helper function to check management rights
CREATE OR REPLACE FUNCTION is_store_manager(_store_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Runs with privileges of the creator (admin), bypassing RLS on Store
SET search_path = public -- Secure search path
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Store"
    WHERE id = _store_id
    AND "managerId" = auth.uid()::text
  );
$$;

-- 2. Drop existing policies to be clean
DROP POLICY IF EXISTS "Managers can view their staff" ON "StoreStaff";
DROP POLICY IF EXISTS "Managers can add staff" ON "StoreStaff";
DROP POLICY IF EXISTS "Managers can update their staff" ON "StoreStaff";
DROP POLICY IF EXISTS "Managers can delete their staff" ON "StoreStaff";

-- 3. Re-create policies using the helper function

-- SELECT
CREATE POLICY "Managers can view their staff"
ON "StoreStaff"
FOR SELECT
USING (is_store_manager(store_id));

-- INSERT
CREATE POLICY "Managers can add staff"
ON "StoreStaff"
FOR INSERT
WITH CHECK (is_store_manager(store_id));

-- UPDATE
CREATE POLICY "Managers can update their staff"
ON "StoreStaff"
FOR UPDATE
USING (is_store_manager(store_id))
WITH CHECK (is_store_manager(store_id));

-- DELETE
CREATE POLICY "Managers can delete their staff"
ON "StoreStaff"
FOR DELETE
USING (is_store_manager(store_id));

-- Ensure RLS is enabled
ALTER TABLE "StoreStaff" ENABLE ROW LEVEL SECURITY;
