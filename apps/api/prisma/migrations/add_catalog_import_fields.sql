-- Migration: Add Catalog Import Fields to Product table
-- This adds fields needed to support bulk JSON catalog data ingestion

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "source_product_id" TEXT UNIQUE;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unit_price" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "uom" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "avg_rating" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "number_of_ratings" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "is_sold_out" BOOLEAN DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "product_url" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "country_code" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "catalog_name" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shipping_charges" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "extra_data" JSONB;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product"("category");
CREATE INDEX IF NOT EXISTS "Product_source_idx" ON "Product"("source");
CREATE INDEX IF NOT EXISTS "Product_subcategory_idx" ON "Product"("subcategory");
