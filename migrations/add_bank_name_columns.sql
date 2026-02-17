-- Add bank_name and bank_beneficiary_name columns to merchants table
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_beneficiary_name TEXT;
