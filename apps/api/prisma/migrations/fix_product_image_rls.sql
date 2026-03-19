-- @lock — Do NOT overwrite. Approved RLS fix as of Mar 16, 2026.
-- Fix RLS policy for ProductImage table
-- This allows all CRUD operations on the ProductImage table to bypass RLS restrictions.

ALTER TABLE "ProductImage" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for ProductImage" ON "ProductImage";

CREATE POLICY "Allow all operations for ProductImage" ON "ProductImage"
FOR ALL
USING (true)
WITH CHECK (true);
