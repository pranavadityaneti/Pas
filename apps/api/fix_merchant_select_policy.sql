-- Allow authenticated users (Admins) to SELECT from merchants table
-- Previous policy restricted them to only seeing rows where id = auth.uid()
DROP POLICY IF EXISTS "Users can view own merchant profile" ON merchants;

CREATE POLICY "Enable select for authenticated users"
ON merchants
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to SELECT from merchant_branches
-- Previous policy: auth.uid() = merchant_id
DROP POLICY IF EXISTS "Users can view own branches" ON merchant_branches;

CREATE POLICY "Enable select branches for authenticated users"
ON merchant_branches
FOR SELECT
TO authenticated
USING (true);

-- Also ensure UPDATE/DELETE policies on branches depend on the same broad access if needed
-- But for now, fixing SELECT is critical for the "Insert + Return" flow.
DROP POLICY IF EXISTS "Users can update own branches" ON merchant_branches;
CREATE POLICY "Enable update branches for authenticated users"
ON merchant_branches
FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can delete own branches" ON merchant_branches;
CREATE POLICY "Enable delete branches for authenticated users"
ON merchant_branches
FOR DELETE
TO authenticated
USING (true);
