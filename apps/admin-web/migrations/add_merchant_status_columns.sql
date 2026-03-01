-- Migration: Add is_online and last_active columns to merchants table
-- Purpose: Enable real-time merchant status tracking in admin dashboard

-- Add is_online column
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Add last_active column  
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;

-- Create index for efficient online status queries
CREATE INDEX IF NOT EXISTS idx_merchants_is_online ON merchants(is_online) WHERE is_online = true;

-- Create index for last_active sorting
CREATE INDEX IF NOT EXISTS idx_merchants_last_active ON merchants(last_active DESC NULLS LAST);

-- Temporarily disable the sync trigger
ALTER TABLE merchants DISABLE TRIGGER trg_sync_merchant_data;

-- Initialize last_active for existing merchants to their created_at date
UPDATE merchants SET last_active = created_at WHERE last_active IS NULL;

-- Re-enable the trigger
ALTER TABLE merchants ENABLE TRIGGER trg_sync_merchant_data;



