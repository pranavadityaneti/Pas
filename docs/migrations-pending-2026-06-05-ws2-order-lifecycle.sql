-- WS2.A — Order lifecycle schema extension (2026-06-05)
--
-- Foundation for the June 8 sprint's Cancel / Reschedule / Return / Exchange
-- flows. Three changes, all idempotent:
--
--   1. Extend OrderStatus enum with EXCHANGE_* values (already has CANCELLED,
--      RETURN_*, REFUNDED).
--   2. Create the unified `order_issues` table backing both Return and
--      Exchange requests (per spec sec 6 risks #4: unified beats separate).
--   3. Add `returnable` boolean to the Product model (WS6 stub — admin/ops
--      can flag perishable/prepared/intimate categories non-returnable).
--
-- Spec: docs/june8-sprint-plan.md — WS2 + WS6.
-- ──────────────────────────────────────────────────────────────────────
-- Run via Supabase Dashboard → SQL Editor.
-- ──────────────────────────────────────────────────────────────────────

-- ── 1. Extend OrderStatus enum ────────────────────────────────────────
-- Postgres can't add enum values inside a transaction in older versions,
-- so each ADD runs standalone. IF NOT EXISTS makes it safe to re-run.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EXCHANGE_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EXCHANGE_APPROVED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EXCHANGE_REJECTED';

-- ── 2. order_issues table ─────────────────────────────────────────────
-- Unified table for return + exchange + (future) cancel-dispute claims.
-- Each row represents one customer-initiated request; merchant or cron
-- resolves it. The SLA timer drives the auto-approve cron — once
-- sla_due_at < now() AND status = 'PENDING', the row auto-flips to
-- 'AUTO_APPROVED' and triggers the refund/exchange downstream.
--
-- order_id is UUID (matches orders.id which is `@db.Uuid` in Prisma).
CREATE TABLE IF NOT EXISTS order_issues (
    id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                 uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    -- 'return' | 'exchange' | 'cancel_dispute' (future-extensible via CHECK).
    type                     text          NOT NULL CHECK (type IN ('return', 'exchange', 'cancel_dispute')),

    -- Customer-selected reason code (frontend picklist) + optional free-text.
    -- Reason codes encoded in apps/api/src/orderLifecycle/rules.ts (WS2.B).
    reason                   text          NOT NULL,
    description              text,

    -- Up to N photo URLs uploaded to the issue (damage proof, wrong-item etc).
    photos                   text[]        NOT NULL DEFAULT '{}',

    -- Lifecycle: PENDING (just created) → APPROVED / REJECTED (merchant)
    --                                  OR  AUTO_APPROVED (SLA cron).
    status                   text          NOT NULL DEFAULT 'PENDING'
                                            CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED')),

    -- Refund accounting. NULL until the issue resolves with a refund.
    -- amount in INR (whole rupees — order totals already use Float INR in
    -- Order.totalAmount; matching that scale here for consistency).
    refund_amount_inr        integer       CHECK (refund_amount_inr IS NULL OR refund_amount_inr >= 0),
    refund_razorpay_id       text,
    refund_processed_at      timestamptz,

    -- Merchant audit fields. resolved_by is the auth.user.id (UUID) of the
    -- merchant or admin who clicked Approve/Reject. NULL when auto-approved.
    merchant_decision_reason text,
    resolved_by              uuid,
    resolved_at              timestamptz,

    -- SLA timer for auto-approve cron. Populated at row create:
    --   - return: created_at + 24h  (window for merchant to respond)
    --   - exchange: created_at + 24h
    -- The cron polls (status, sla_due_at) — partial index below speeds that.
    sla_due_at               timestamptz   NOT NULL,

    created_at               timestamptz   NOT NULL DEFAULT now(),
    updated_at               timestamptz   NOT NULL DEFAULT now()
);

-- Common access pattern: customer-app fetches all issues for an order.
CREATE INDEX IF NOT EXISTS order_issues_order_id_idx
    ON order_issues (order_id);

-- Cron pattern: "give me all PENDING rows whose SLA has elapsed".
-- Partial index keeps it small even as resolved rows accumulate.
CREATE INDEX IF NOT EXISTS order_issues_pending_sla_idx
    ON order_issues (sla_due_at)
    WHERE status = 'PENDING';

-- Merchant-app pattern: list all open issues for stores I manage. Hot path.
CREATE INDEX IF NOT EXISTS order_issues_status_created_idx
    ON order_issues (status, created_at DESC);

-- Auto-bump updated_at on row updates.
CREATE OR REPLACE FUNCTION order_issues_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_issues_updated_at_trg ON order_issues;
CREATE TRIGGER order_issues_updated_at_trg
    BEFORE UPDATE ON order_issues
    FOR EACH ROW EXECUTE FUNCTION order_issues_set_updated_at();

-- Lock down with RLS (no policies = API postgres-role bypasses; SDK clients
-- get nothing). Matches the pattern from merchant_signup_coupons in
-- Phase 2.E2 — defense in depth.
ALTER TABLE order_issues ENABLE ROW LEVEL SECURITY;

-- ── 3. Product.returnable (WS6 stub) ──────────────────────────────────
-- Per spec: "opened perishable/prepared/intimate = non-returnable".
-- Default true; admin or ops can flip categories at the product-row level
-- (UI for this is WS6 proper — schema lands now so rules engine in WS2.B
-- can read the flag).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS returnable boolean NOT NULL DEFAULT true;

-- ──────────────────────────────────────────────────────────────────────
-- Optional verification:
--
-- SELECT unnest(enum_range(NULL::"OrderStatus")) AS values;
-- -- expect: PENDING / CONFIRMED / PREPARING / READY / COMPLETED /
-- --         CANCELLED / RETURN_REQUESTED / RETURN_APPROVED / RETURN_REJECTED /
-- --         REFUNDED / EXCHANGE_REQUESTED / EXCHANGE_APPROVED / EXCHANGE_REJECTED
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'order_issues'
-- ORDER BY ordinal_position;
--
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'Product' AND column_name = 'returnable';
-- ──────────────────────────────────────────────────────────────────────
