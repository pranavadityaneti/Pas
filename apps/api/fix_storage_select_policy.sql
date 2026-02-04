-- Allow public/authenticated users to SELECT from merchant-docs bucket
-- This is required for the client to read back the uploaded file metadata or download it.
DROP POLICY IF EXISTS "Merchant Docs Public Select" ON storage.objects;

CREATE POLICY "Merchant Docs Public Select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'merchant-docs');
