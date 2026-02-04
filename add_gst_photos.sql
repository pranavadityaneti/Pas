-- Add GST fields and Store Photos to merchants table
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS gst_number TEXT,
ADD COLUMN IF NOT EXISTS gst_certificate_url TEXT,
ADD COLUMN IF NOT EXISTS store_photos TEXT[];

-- Update comments for clarity
COMMENT ON COLUMN merchants.store_photos IS 'Array of URLs for store photos (minimum 2 required by application logic)';
COMMENT ON COLUMN merchants.gst_number IS 'GSTIN - Mandatory if turnover > 20L';
