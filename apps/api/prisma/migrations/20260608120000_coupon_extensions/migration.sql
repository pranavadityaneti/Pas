-- AlterTable
ALTER TABLE "public"."coupons" ADD COLUMN     "bogo_mode" TEXT,
ADD COLUMN     "daily_usage_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "daily_usage_limit" INTEGER,
ADD COLUMN     "daily_usage_reset_at" TIMESTAMPTZ(6),
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "eligible_order_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "eligible_verticals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "inactive_since_days" INTEGER DEFAULT 30;

-- CreateIndex
CREATE INDEX "Coupon_deleted_at_idx" ON "public"."coupons"("deleted_at");

