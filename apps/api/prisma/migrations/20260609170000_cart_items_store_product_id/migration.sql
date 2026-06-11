-- Phase 4 fix C1 (2026-06-09): add store_product_id to cart_items.
-- Purely additive, nullable column. Backward-compatible:
--   - Existing rows have NULL → consumer-app's auto-coupon-clear on cart load
--     (planned CartContext defensive clear) handles it.
--   - syncCartToSupabase will populate it for new/updated rows after the OTA.
-- Without this column the SIGNED_IN / TOKEN_REFRESHED mid-checkout reload
-- silently drops storeProductId from the CartContext item — server's cartHash
-- recompute then fails when REQUIRE_COUPON_TOKEN=true is flipped.

ALTER TABLE "public"."cart_items" ADD COLUMN "store_product_id" TEXT;
