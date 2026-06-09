-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN     "order_coupon_code" TEXT,
ADD COLUMN     "order_coupon_discount" DECIMAL(10,2),
ADD COLUMN     "order_coupon_discount_type" TEXT,
ADD COLUMN     "order_coupon_funding_source" TEXT,
ADD COLUMN     "order_coupon_id" TEXT;

-- CreateIndex
CREATE INDEX "Order_order_coupon_id_idx" ON "public"."orders"("order_coupon_id");

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "fk_orders_coupon" FOREIGN KEY ("order_coupon_id") REFERENCES "public"."coupons"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

