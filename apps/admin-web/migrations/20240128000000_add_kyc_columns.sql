-- Add new columns for KYC and Bank Details
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS pan_number TEXT,
ADD COLUMN IF NOT EXISTS aadhar_number TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS ifsc_code TEXT,
ADD COLUMN IF NOT EXISTS turnover_range TEXT;

-- Grant permissions for these new columns (if RLS is enabled)
-- Note: 'GRANT ALL ON merchants' usually covers new columns, but good to double check.
-- If you have specific column grants, run:
-- GRANT UPDATE (pan_number, aadhar_number, bank_account_number, ifsc_code, turnover_range) ON merchants TO anon;
-- GRANT UPDATE (pan_number, aadhar_number, bank_account_number, ifsc_code, turnover_range) ON merchants TO authenticated;
