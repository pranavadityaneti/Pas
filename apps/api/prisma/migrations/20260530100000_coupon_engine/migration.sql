-- Coupon engine — extend `coupons` + add `coupon_redemptions`.
-- APPLY THIS BEFORE deploying the coupon API (the generated Prisma client already expects these).
-- Run in Supabase SQL editor (or `prisma migrate deploy`).
-- NOTE: ALTER TYPE ... ADD VALUE adds the enum value; it just can't be *used* in the same
-- transaction it's added in — fine here, since we only add it.

ALTER TYPE "public"."DiscountType" ADD VALUE IF NOT EXISTS 'BOGO';

ALTER TABLE "public"."coupons"
  ADD COLUMN IF NOT EXISTS "min_order"          double precision,
  ADD COLUMN IF NOT EXISTS "per_customer_limit" integer,
  ADD COLUMN IF NOT EXISTS "bogo_buy"           integer,
  ADD COLUMN IF NOT EXISTS "bogo_get"           integer,
  ADD COLUMN IF NOT EXISTS "title"              text,
  ADD COLUMN IF NOT EXISTS "brand_name"         text,
  ADD COLUMN IF NOT EXISTS "description"        text,
  ADD COLUMN IF NOT EXISTS "show_logo"          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "logo_url"           text,
  ADD COLUMN IF NOT EXISTS "auto_code"          boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "public"."coupon_redemptions" (
  "id"          text        NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id"   text        NOT NULL,
  "user_id"     uuid        NOT NULL,
  "order_id"    uuid,
  "issued_code" text,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupon_redemptions_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CouponRedemption_coupon_id_idx" ON "public"."coupon_redemptions"("coupon_id");
CREATE INDEX IF NOT EXISTS "CouponRedemption_user_id_idx"   ON "public"."coupon_redemptions"("user_id");
