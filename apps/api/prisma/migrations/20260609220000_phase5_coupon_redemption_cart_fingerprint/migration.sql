-- Phase 5 — multi-store coupon allocation (2026-06-09).
-- Adds cart_fingerprint to coupon_redemptions so ONE row can cover N per-store
-- orders (one cart with a coupon → N POST /orders calls → 1 redemption row,
-- usedCount incremented once, split_order_ids[] tracks each store's order id).
--
-- Lifecycle:
--   * First store-order in a multi-store coupon cart: INSERT with
--       cart_fingerprint set, order_id = NULL (the per-order id is in
--       split_order_ids[0]), split_order_ids = [thisOrderId], discount_amount
--       = total signed discount. Increments coupon.usedCount + dailyUsageCount
--       once.
--   * Subsequent store-orders for the same cart: try INSERT → catch P2002 on
--       the partial unique → UPDATE existing row, append thisOrderId to
--       split_order_ids[]. Do NOT re-increment counters.
--   * Single-store coupon orders: cart_fingerprint stays NULL, order_id set,
--       split_order_ids stays [] — preserves the existing (coupon_id, order_id)
--       unique-key path from Phase 1.
--
-- The partial unique WHERE cart_fingerprint IS NOT NULL ensures: (a) multi-store
-- rows are deduped per (couponId, fingerprint); (b) single-store rows
-- (cart_fingerprint NULL) are untouched by this index.

ALTER TABLE "public"."coupon_redemptions"
    ADD COLUMN "cart_fingerprint" TEXT;

CREATE UNIQUE INDEX "coupon_redemption_cart_fingerprint_unique_idx"
    ON "public"."coupon_redemptions" ("coupon_id", "cart_fingerprint")
    WHERE "cart_fingerprint" IS NOT NULL;
