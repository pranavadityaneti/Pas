-- WS2 round-5 hardening — defense-in-depth unique indices (2026-06-05)
--
-- These partial unique indices enforce uniqueness at the DB level for the
-- two race-prone tables in the WS2 surface. Even if the app-level CAS in
-- POST /orders/:id/cancel / /return / /exchange were somehow bypassed
-- (deserialized retry, multi-instance race, future refactor), the second
-- INSERT would error with Postgres 23505 (unique_violation) and the
-- transaction would roll back. Belt-and-braces.
--
-- Both are PARTIAL indices on the natural uniqueness key — so they
-- coexist with existing data that may not satisfy uniqueness in legacy
-- rows (NULL orderId on couponRedemption; non-PENDING statuses on
-- order_issues).
--
-- Safe to run multiple times — `IF NOT EXISTS` is idempotent.
-- ──────────────────────────────────────────────────────────────────────

-- 1. Coupon redemptions: one redemption row per (coupon, order) pair.
--    Matches the idempotency intent already in /coupons/redeem (which
--    does findFirst-then-create with no atomic guarantee — this index
--    makes it actually atomic).
CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_coupon_order_uniq
    ON coupon_redemptions (coupon_id, order_id)
    WHERE order_id IS NOT NULL;

-- 2. Order issues: at most one PENDING return or exchange per order.
--    Prevents duplicate issue creation on parallel POST /orders/:id/return
--    or /exchange submissions. Resolved issues (APPROVED / REJECTED /
--    AUTO_APPROVED) are exempted so an order CAN have a previous resolved
--    issue + a new pending one (if business policy ever allows it).
CREATE UNIQUE INDEX IF NOT EXISTS order_issues_pending_uniq
    ON order_issues (order_id, type)
    WHERE status = 'PENDING';

-- ──────────────────────────────────────────────────────────────────────
-- Optional verification after running:
--
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename IN ('coupon_redemptions', 'order_issues')
--   AND indexname IN ('coupon_redemptions_coupon_order_uniq', 'order_issues_pending_uniq');
--
-- Should return both rows with the WHERE clauses visible in indexdef.
-- ──────────────────────────────────────────────────────────────────────
