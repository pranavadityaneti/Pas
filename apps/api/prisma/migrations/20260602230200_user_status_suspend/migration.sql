-- User soft-disable for admin suspension (RBAC doc 2026-06-02).
--
-- 'active' (default) — normal operation
-- 'suspended'        — login blocked, hidden from active surfaces, data preserved
--
-- Suspended users have suspended_at + suspended_reason populated for audit.
-- Reversible: Super Admin sets status back to 'active' + nulls the suspend fields.

ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "status"           text         NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "suspended_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "suspended_reason" text;

-- Optional index for lookup-by-status queries (e.g. "list all suspended admins").
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "public"."User"("status");
