-- Allow authenticated users (Admins) to INSERT into merchants table
-- This overrides the previous strict "uid = id" check for inserts
DROP POLICY IF EXISTS "Users can insert own merchant profile" ON merchants;

CREATE POLICY "Enable insert for authenticated users"
ON merchants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users (Admins) to UPDATE merchants
DROP POLICY IF EXISTS "Users can update own merchant profile" ON merchants;
-- (Note: You might need to check if this policy exists first, if not just create the new one)

CREATE POLICY "Enable update for authenticated users"
ON merchants
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users (Admins) to DELETE merchants
CREATE POLICY "Enable delete for authenticated users"
ON merchants
FOR DELETE
TO authenticated
USING (true);

-- Also fix branches just in case
DROP POLICY IF EXISTS "Users can insert own branches" ON merchant_branches;

CREATE POLICY "Enable branch insert for authenticated users"
ON merchant_branches
FOR INSERT
TO authenticated
WITH CHECK (true);
