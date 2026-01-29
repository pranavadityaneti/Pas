-- Enhanced Merchant Schema for Full Onboarding
-- Run this in Supabase SQL Editor

-- Add new columns to merchants table
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS has_branches BOOLEAN DEFAULT false;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS aadhar_number TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS ifsc_code TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS turnover_range TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS msme_number TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pan_document_url TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS aadhar_front_url TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS aadhar_back_url TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS msme_certificate_url TEXT;

-- Create merchant_branches table
CREATE TABLE IF NOT EXISTS merchant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL,
    address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for branches
ALTER TABLE merchant_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own branches" 
ON merchant_branches FOR SELECT 
USING (auth.uid() = merchant_id);

CREATE POLICY "Users can insert own branches" 
ON merchant_branches FOR INSERT 
WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Users can update own branches" 
ON merchant_branches FOR UPDATE 
USING (auth.uid() = merchant_id);

CREATE POLICY "Users can delete own branches" 
ON merchant_branches FOR DELETE 
USING (auth.uid() = merchant_id);

-- Create storage bucket for merchant documents (run in Storage section or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('merchant-documents', 'merchant-documents', true);
