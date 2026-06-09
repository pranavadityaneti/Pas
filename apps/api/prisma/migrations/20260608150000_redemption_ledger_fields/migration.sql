-- AlterTable
ALTER TABLE "public"."coupon_redemptions" ADD COLUMN     "discount_amount" DECIMAL(10,2),
ADD COLUMN     "funding_source" TEXT,
ADD COLUMN     "split_order_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_coupon_order_key" ON "public"."coupon_redemptions"("coupon_id", "order_id");

