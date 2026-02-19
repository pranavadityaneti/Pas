
-- Enable RLS on merchant_branches if not already enabled
ALTER TABLE merchant_branches ENABLE ROW LEVEL SECURITY;

-- Allow merchants to insert their own branches
CREATE POLICY "Enable insert for users based on merchant_id" ON "public"."merchant_branches"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (((auth.uid())::text = merchant_id));

-- Allow merchants to view their own branches
CREATE POLICY "Enable read access for users based on merchant_id" ON "public"."merchant_branches"
AS PERMISSIVE FOR SELECT
TO public
USING (((auth.uid())::text = merchant_id));

-- Allow merchants to update their own branches
CREATE POLICY "Enable update for users based on merchant_id" ON "public"."merchant_branches"
AS PERMISSIVE FOR UPDATE
TO public
USING (((auth.uid())::text = merchant_id));

-- Allow merchants to delete their own branches
CREATE POLICY "Enable delete for users based on merchant_id" ON "public"."merchant_branches"
AS PERMISSIVE FOR DELETE
TO public
USING (((auth.uid())::text = merchant_id));

-- Ensure storage bucket 'merchant-docs' is public
UPDATE storage.buckets
SET public = true
WHERE id = 'merchant-docs';

-- Create policy to allow public read access to merchant-docs
CREATE POLICY "Give public access to merchant-docs" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'merchant-docs');
