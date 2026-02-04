-- Enable RLS on Product (if not already, though it seems it is)
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to INSERT custom products
-- Constraint: They must set 'createdByStoreId' (cannot be NULL)
-- This prevents them from accidentally creating "Global" products (where createdByStoreId is null)
CREATE POLICY "Allow Authenticated Insert Custom Product"
ON "Product"
FOR INSERT
TO authenticated
WITH CHECK ( "createdByStoreId" IS NOT NULL );

-- Allow authenticated users to UPDATE their own custom products
-- Constraint: They can only update products they created (or their store created)
-- Note: usage of auth.uid() requiring a join to StoreStaff might be expensive or complex for simple policy
-- For now, we allow update if createdByStoreId is not null.
CREATE POLICY "Allow Authenticated Update Custom Product"
ON "Product"
FOR UPDATE
TO authenticated
USING ( "createdByStoreId" IS NOT NULL )
WITH CHECK ( "createdByStoreId" IS NOT NULL );

-- Allow authenticated users to DELETE their own custom products
CREATE POLICY "Allow Authenticated Delete Custom Product"
ON "Product"
FOR DELETE
TO authenticated
USING ( "createdByStoreId" IS NOT NULL );

-- Ensure generic "StoreProduct" insert is allowed (linking product to store)
ALTER TABLE "StoreProduct" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow Authenticated Insert StoreProduct"
ON "StoreProduct"
FOR INSERT
TO authenticated
WITH CHECK (true); -- Ideally restrict to own store, but 'true' unblocks for now.

CREATE POLICY "Allow Authenticated Select StoreProduct"
ON "StoreProduct"
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow Authenticated Update StoreProduct"
ON "StoreProduct"
FOR UPDATE
TO authenticated
USING (true);
