-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Ensure the 'products' bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing restrictive policies (optional, but cleaner)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;

-- 3. Create permissive policies for the 'products' bucket
-- Allow anyone to read images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- Allow anyone (including anon) to upload images
CREATE POLICY "Public Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'products' );

-- Allow anyone to update/delete (Caution: effectively public)
-- You might want to restrict this in production, but for Admin Dashboard dev, it's fine.
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'products' );

CREATE POLICY "Public Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'products' );


-- ==========================================
-- MERCHANT DOCS BUCKET SETUP
-- ==========================================

-- 1. Ensure the 'merchant-docs' bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-docs', 'merchant-docs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create permissive policies for the 'merchant-docs' bucket
-- Allow anyone to read documents
CREATE POLICY "Merchant Docs Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'merchant-docs' );

-- Allow anyone (including anon) to upload documents
CREATE POLICY "Merchant Docs Public Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'merchant-docs' );

-- Allow updates/deletes
CREATE POLICY "Merchant Docs Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'merchant-docs' );

CREATE POLICY "Merchant Docs Public Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'merchant-docs' );

-- ==========================================
-- UPDATE MERCHANTS TABLE SCHEMA (COMPREHENSIVE)
-- ==========================================
ALTER TABLE merchants
-- Basic & Operational
ADD COLUMN IF NOT EXISTS branch_name TEXT,
ADD COLUMN IF NOT EXISTS has_branches BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS operating_hours TEXT,
ADD COLUMN IF NOT EXISTS operating_days TEXT[],
-- KYC Data
ADD COLUMN IF NOT EXISTS pan_number TEXT,
ADD COLUMN IF NOT EXISTS aadhar_number TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS ifsc_code TEXT,
ADD COLUMN IF NOT EXISTS turnover_range TEXT,
-- Documents & Status
ADD COLUMN IF NOT EXISTS pan_doc_url TEXT,
ADD COLUMN IF NOT EXISTS aadhar_front_url TEXT,
ADD COLUMN IF NOT EXISTS aadhar_back_url TEXT,
ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending';
