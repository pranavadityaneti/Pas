-- Coupon theme — single curated-preset column. Admin picks one of
-- 'classic' | 'bold' | 'modern' | 'festive'; CouponCard maps the id to
-- (cardStyle, shape, accent, radius, density) in code. The validation is
-- app-side (POST/PATCH /coupon), not a DB enum, so adding/removing themes
-- later doesn't need a schema migration.

ALTER TABLE "public"."coupons"
  ADD COLUMN IF NOT EXISTS "theme" text NOT NULL DEFAULT 'classic';
