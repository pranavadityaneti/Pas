
-- Secure Store and StoreProduct with proper RLS

-- 1. Helper function (idempotent)
CREATE OR REPLACE FUNCTION is_store_manager(_store_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Store"
    WHERE id = _store_id
    AND "managerId" = auth.uid()::text
  );
$$;

-- 2. StoreProduct Policies
ALTER TABLE "StoreProduct" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read StoreProduct" ON "StoreProduct";
DROP POLICY IF EXISTS "Manager Write StoreProduct" ON "StoreProduct";
-- Drop legacy/bad policies if any
DROP POLICY IF EXISTS "Allow Authenticated Select StoreProduct" ON "StoreProduct";
DROP POLICY IF EXISTS "Allow Authenticated Insert StoreProduct" ON "StoreProduct";
DROP POLICY IF EXISTS "Allow Authenticated Update StoreProduct" ON "StoreProduct";
DROP POLICY IF EXISTS "Allow Authenticated Delete StoreProduct" ON "StoreProduct";

-- Anyone can view products (for global search/consumer app)
CREATE POLICY "Public Read StoreProduct"
ON "StoreProduct" FOR SELECT
USING (true);

-- Only Manager can Modify
CREATE POLICY "Manager Write StoreProduct"
ON "StoreProduct"
FOR ALL
USING (is_store_manager("storeId"))
WITH CHECK (is_store_manager("storeId"));


-- 3. Store Policies
ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Store" ON "Store";
DROP POLICY IF EXISTS "Manager Update Store" ON "Store";

-- Anyone can view stores
CREATE POLICY "Public Read Store"
ON "Store" FOR SELECT
USING (true);

-- Only Manager can Update their own store
CREATE POLICY "Manager Update Store"
ON "Store" FOR UPDATE
USING ("managerId" = auth.uid()::text)
WITH CHECK ("managerId" = auth.uid()::text);
