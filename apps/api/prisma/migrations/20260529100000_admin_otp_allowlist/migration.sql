-- Admin OTP auth: an allowlist of authorized admin phones + a durable `isAdmin`
-- flag on User.
--
-- Why a separate flag instead of gating on User.role = 'SUPER_ADMIN':
-- verify-otp's JIT block stamps User.role = 'MERCHANT' for ANY phone that matches
-- a merchant_branches.phone. Two admin phones (9959777027, 9100117027) are Freshly
-- branch phones, so a role-based gate would be overwritten on every login. `isAdmin`
-- is never touched by that block, so it survives.
--
-- Both changes are additive/idempotent. Apply BEFORE deploying the API that reads them.

CREATE TABLE IF NOT EXISTS "public"."admin_allowlist" (
  "phone"      text PRIMARY KEY,
  "name"       text,
  "is_active"  boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Only the API (service role) touches this table; lock out anon/authenticated clients.
ALTER TABLE "public"."admin_allowlist" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "isAdmin" boolean NOT NULL DEFAULT false;

-- Seed the 4 authorized admin phones (91-prefixed — matches send-otp's phone format).
INSERT INTO "public"."admin_allowlist" ("phone","name") VALUES
  ('919959777027','Pranav'),
  ('919100117027','Pranav (secondary)'),
  ('919703870496','Pooja Mamnoor'),
  ('917032857073','Krishna')
ON CONFLICT ("phone") DO NOTHING;

-- Existing email-based SUPER_ADMINs stay admins under the new gate.
UPDATE "public"."User" SET "isAdmin" = true WHERE "role" = 'SUPER_ADMIN';
