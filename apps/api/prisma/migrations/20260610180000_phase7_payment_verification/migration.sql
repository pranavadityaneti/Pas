-- Phase 7B (2026-06-10) — server-side payment verification flags on orders.
-- Closes the long-standing "server trusts the client's paid claim" gap as a
-- settlement prerequisite (docs/phase7-settlement-architecture.html §8).
-- Purely additive, nullable: NULL = not yet verified (pre-Phase-7 orders and
-- API-error cases; the cron re-verifies). TRUE = Razorpay-confirmed captured.
-- FALSE = verification ran and failed a soft check (amount mismatch etc.) —
-- order exists but is HELD from settlement (anomaly bucket).

ALTER TABLE "public"."orders" ADD COLUMN "payment_verified" BOOLEAN;
ALTER TABLE "public"."orders" ADD COLUMN "payment_verification_note" TEXT;

-- Cron scan: paid orders awaiting (re-)verification.
CREATE INDEX "orders_payment_unverified_idx"
    ON "public"."orders" ("created_at")
    WHERE "payment_verified" IS NULL AND "ispaid" = true;
