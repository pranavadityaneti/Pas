-- WS2 round-5 — pre-deploy verification queries (2026-06-05)
--
-- Run these in the Supabase SQL editor BEFORE deploying the API. They are
-- read-only and answer questions the audit couldn't resolve from code
-- alone — specifically about live DB schema-level constraints that the
-- Prisma schema does not declare.
-- ──────────────────────────────────────────────────────────────────────

-- 1. Does order_requests.status have a CHECK constraint?
--    If yes, we need to know the allowed values BEFORE the cancel endpoint
--    starts writing 'CANCELLED' on cancel. If 'CANCELLED' isn't in the
--    allowed set, every cancel will log a Sentry error from the
--    order_requests cleanup .catch (the cancel itself still succeeds).
--
--    Decision after running:
--      - If the result includes 'CANCELLED' → ship as-is.
--      - If it doesn't → either run an ALTER TYPE / ALTER TABLE to add
--        'CANCELLED', or switch the endpoint to use 'EXPIRED' instead.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'order_requests'::regclass
  AND contype = 'c';

-- 2. Does order_issues.status have a CHECK constraint?
--    We expect: CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED'))
--    Same for order_issues.type:
--    CHECK (type IN ('return', 'exchange', 'cancel_dispute'))
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'order_issues'::regclass
  AND contype = 'c';

-- 3. Are RLS policies active on order_issues?
--    Expect rls = true with zero policies (API postgres-role bypass).
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'order_issues';

SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'order_issues';

-- 4. Are there any existing order_requests stuck in COMPLETED whose linked
--    order is CANCELLED? If yes, the round-5 reconcileOrderRequestStatus
--    cron will heal them on its first tick.
SELECT count(*) AS stuck_count
FROM order_requests r
JOIN orders o ON (o.metadata->>'orderRequestId')::uuid = r.id
WHERE r.status = 'COMPLETED' AND o.status = 'CANCELLED';

-- 5. Are there any duplicate (coupon_id, order_id) couponRedemption rows
--    today (before applying the unique index)? If yes, the index migration
--    will fail unless we delete the dupes first.
SELECT coupon_id, order_id, count(*) AS dup_count
FROM coupon_redemptions
WHERE order_id IS NOT NULL
GROUP BY coupon_id, order_id
HAVING count(*) > 1;

-- 6. Are there any (orderId, type) pairs with multiple PENDING order_issues?
--    Same concern as above for the order_issues partial unique index.
SELECT order_id, type, count(*) AS dup_count
FROM order_issues
WHERE status = 'PENDING'
GROUP BY order_id, type
HAVING count(*) > 1;
