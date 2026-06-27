-- =====================================================================
-- Migrations applied 2026-06-02 (via Supabase SQL Editor)
--
-- Confirmed by founder: "Migration SQL: Success. No rows returned"
--
-- Corresponds to the Prisma migration directories:
--   apps/api/prisma/migrations/20260602230000_wati_inbox/
--   apps/api/prisma/migrations/20260602230100_rbac_roles/
--   apps/api/prisma/migrations/20260602230200_user_status_suspend/
--
-- All statements are idempotent (IF NOT EXISTS / ADD VALUE IF NOT EXISTS).
-- Re-running them is a no-op.
-- =====================================================================

-- ─── 1) Wati inbox table — captures incoming WhatsApp messages ────────
CREATE TABLE IF NOT EXISTS "public"."wati_inbox" (
  "id"               text         NOT NULL DEFAULT gen_random_uuid(),
  "wati_message_id"  text,
  "wa_phone"         text         NOT NULL,
  "contact_name"     text,
  "direction"        text         NOT NULL DEFAULT 'inbound',
  "message_type"     text         NOT NULL DEFAULT 'text',
  "body"             text,
  "raw_payload"      jsonb        NOT NULL,
  "tag"              text,
  "assigned_to"      uuid,
  "status"           text         NOT NULL DEFAULT 'open',
  "is_read"          boolean      NOT NULL DEFAULT false,
  "received_at"      timestamptz  NOT NULL DEFAULT now(),
  "resolved_at"      timestamptz,
  "created_at"       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT "wati_inbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "wati_inbox_wa_phone_idx"        ON "public"."wati_inbox"("wa_phone");
CREATE INDEX IF NOT EXISTS "wati_inbox_status_idx"          ON "public"."wati_inbox"("status");
CREATE INDEX IF NOT EXISTS "wati_inbox_received_at_idx"     ON "public"."wati_inbox"("received_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "wati_inbox_wati_message_id_uq"
  ON "public"."wati_inbox"("wati_message_id") WHERE "wati_message_id" IS NOT NULL;
ALTER TABLE "public"."wati_inbox" ENABLE ROW LEVEL SECURITY;

-- ─── 2) RBAC roles ────────────────────────────────────────────────────
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'OPERATIONS';
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'SUPPORT';

-- ─── 3) User soft-disable ─────────────────────────────────────────────
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "status"           text         NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "suspended_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "suspended_reason" text;
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "public"."User"("status");
