-- Wati inbox — captures every incoming WhatsApp message (chatbot handoff or direct).
-- Foundation for the admin Customer Support inbox. Activates when the webhook URL
-- is set in Wati dashboard → Settings → Webhooks.

CREATE TABLE IF NOT EXISTS "public"."wati_inbox" (
  "id"                text         NOT NULL DEFAULT gen_random_uuid(),
  "wati_message_id"   text,                              -- Wati's own message ID, for dedup
  "wa_phone"          text         NOT NULL,             -- WhatsApp number (E.164 without +)
  "contact_name"      text,                              -- Wati's contact name (may be Display name from WA)
  "direction"         text         NOT NULL DEFAULT 'inbound',  -- 'inbound' | 'outbound' (future)
  "message_type"      text         NOT NULL DEFAULT 'text',     -- 'text' | 'image' | 'button_reply' | 'interactive' | etc.
  "body"              text,                              -- the message text content
  "raw_payload"       jsonb        NOT NULL,             -- entire Wati webhook body (for forensics)
  "tag"               text,                              -- e.g. 'order-help', 'cancel-request' from chatbot
  "assigned_to"       uuid,                              -- admin user id who owns this thread (FK to User)
  "status"            text         NOT NULL DEFAULT 'open',     -- 'open' | 'in_progress' | 'resolved' | 'spam'
  "is_read"           boolean      NOT NULL DEFAULT false,
  "received_at"       timestamptz  NOT NULL DEFAULT now(),
  "resolved_at"       timestamptz,
  "created_at"        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT "wati_inbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "wati_inbox_wa_phone_idx"     ON "public"."wati_inbox"("wa_phone");
CREATE INDEX IF NOT EXISTS "wati_inbox_status_idx"       ON "public"."wati_inbox"("status");
CREATE INDEX IF NOT EXISTS "wati_inbox_received_at_idx"  ON "public"."wati_inbox"("received_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "wati_inbox_wati_message_id_uq" ON "public"."wati_inbox"("wati_message_id") WHERE "wati_message_id" IS NOT NULL;

-- Lock by default; only service_role accesses via the API.
ALTER TABLE "public"."wati_inbox" ENABLE ROW LEVEL SECURITY;
