-- Enable RLS on Store
ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Store" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Store" TO service_role;

-- 1. Policy for SELECT (Managers can view their own store)
DROP POLICY IF EXISTS "Managers can view their own store" ON "Store";
CREATE POLICY "Managers can view their own store"
ON "Store"
FOR SELECT
TO authenticated
USING ( "managerId" = auth.uid()::text );

-- 2. Policy for UPDATE (Managers can update their own store)
DROP POLICY IF EXISTS "Managers can update their own store" ON "Store";
CREATE POLICY "Managers can update their own store"
ON "Store"
FOR UPDATE
TO authenticated
USING ( "managerId" = auth.uid()::text )
WITH CHECK ( "managerId" = auth.uid()::text );

-- 3. Policy for INSERT (Managers can create a store)
DROP POLICY IF EXISTS "Managers can create store" ON "Store";
CREATE POLICY "Managers can create store"
ON "Store"
FOR INSERT
TO authenticated
WITH CHECK ( "managerId" = auth.uid()::text );
