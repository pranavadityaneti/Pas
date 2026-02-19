
-- Enable RLS and permissions for merchant_branches

-- 1. Enable RLS
ALTER TABLE "merchant_branches" ENABLE ROW LEVEL SECURITY;

-- 2. Grant Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "merchant_branches" TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE "merchant_branches_id_seq" TO authenticated; -- Removed: Table uses UUIDs, no sequence.

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Merchants can view their own branches" ON "merchant_branches";
DROP POLICY IF EXISTS "Merchants can insert their own branches" ON "merchant_branches";
DROP POLICY IF EXISTS "Merchants can update their own branches" ON "merchant_branches";
DROP POLICY IF EXISTS "Merchants can delete their own branches" ON "merchant_branches";

-- 4. Create Policies

-- SELECT: Can view own branches
CREATE POLICY "Merchants can view their own branches"
ON "merchant_branches"
FOR SELECT
TO authenticated
USING (merchant_id = auth.uid()::text);

-- INSERT: Can insert branches for themselves
CREATE POLICY "Merchants can insert their own branches"
ON "merchant_branches"
FOR INSERT
TO authenticated
WITH CHECK (merchant_id = auth.uid()::text);

-- UPDATE: Can update own branches
CREATE POLICY "Merchants can update their own branches"
ON "merchant_branches"
FOR UPDATE
TO authenticated
USING (merchant_id = auth.uid()::text)
WITH CHECK (merchant_id = auth.uid()::text);

-- DELETE: Can delete own branches
CREATE POLICY "Merchants can delete their own branches"
ON "merchant_branches"
FOR DELETE
TO authenticated
USING (merchant_id = auth.uid()::text);
