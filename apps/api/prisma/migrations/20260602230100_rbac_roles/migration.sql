-- RBAC roles per the platform's RBAC doc (2026-06-02).
-- Adds three new admin-tier roles to the existing Role enum.
--
-- Hierarchy / responsibilities:
--   SUPER_ADMIN   (existing) — founder / eng — governance, configuration, exceptions
--   OPERATIONS    (new)      — daily marketplace ops: onboarding, KYC, in-policy refunds
--   FINANCE       (new)      — settlements, payouts, reconciliation, high-value refunds
--   SUPPORT       (new)      — customer-facing support: respond, ticket, escalate (read-only on most resources)
--   MERCHANT      (existing) — merchant accounts
--   CONSUMER      (existing) — customer accounts

ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'OPERATIONS';
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'SUPPORT';
