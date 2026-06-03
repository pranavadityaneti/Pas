-- Admin allowlist gets a `role` column so phone-invites can carry the target role.
-- Used by:
--   - POST /admin/users/invite (phone path) writes the chosen role here
--   - /auth/verify-otp admin branch reads it on first JIT-create of the User row
-- Idempotent.

ALTER TABLE "public"."admin_allowlist"
  ADD COLUMN IF NOT EXISTS "role" text;
