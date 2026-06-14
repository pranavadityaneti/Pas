-- ════════════════════════════════════════════════════════════════════════
-- Merchant e-Sign V1 — merchant_consents table   (STAGED — DO NOT auto-apply)
-- 2026-06-14
--
-- Append-only audit record of a merchant's accepted + on-screen drawn-signature
-- partner agreement (Step 4 of signup). Written by POST /merchant-signup/consent,
-- read by GET /admin/merchants/:id/consent. Mirrors the Prisma model
-- `MerchantConsent` in apps/api/prisma/schema.prisma.
--
-- APPLY ON PRANAV'S EXPLICIT GO (per CLAUDE.md: migrations require confirmation).
-- Run in the Supabase SQL editor, or psql against DIRECT_URL. Idempotent.
--
-- Rollout order: apply this BEFORE the API that references prisma.merchantConsent
-- serves traffic (otherwise POST /merchant-signup/consent 500s on a missing
-- table). Safe to apply any time — it only adds a new table.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.merchant_consents (
    id                UUID           NOT NULL DEFAULT gen_random_uuid(),
    merchant_id       TEXT           NOT NULL,
    agreement_type    TEXT           NOT NULL,   -- 'grocery' | 'otherStores' | 'restaurant'
    agreement_version TEXT           NOT NULL,   -- e.g. 'v1.0'
    accepted_privacy  BOOLEAN        NOT NULL,
    accepted_terms    BOOLEAN        NOT NULL,
    accepted_partner  BOOLEAN        NOT NULL,
    signatory_name    TEXT,
    designation       TEXT,
    signature         JSONB,                     -- { paths: string[], width, height }
    signed_pdf_path   TEXT,                      -- path in the private 'merchant-docs' bucket
    signed_at         TIMESTAMPTZ(6) NOT NULL,
    ip                TEXT,
    device            TEXT,
    doc_hash          TEXT,                      -- SHA-256 integrity fingerprint
    created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT merchant_consents_pkey PRIMARY KEY (id),
    CONSTRAINT merchant_consents_merchant_id_fkey
        FOREIGN KEY (merchant_id) REFERENCES public.merchants(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS merchant_consents_merchant_id_idx ON public.merchant_consents(merchant_id);
CREATE INDEX IF NOT EXISTS merchant_consents_created_at_idx  ON public.merchant_consents(created_at);

-- ── Lockdown: the API (service_role) is the only reader/writer; no client access.
--    service_role bypasses RLS + grants, so the API keeps full access. ──
ALTER TABLE public.merchant_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_consents FROM anon, authenticated;

-- ── Verify ──
--   SELECT count(*) FROM public.merchant_consents;            -- 0 on a fresh table
--   SELECT has_table_privilege('anon','public.merchant_consents','SELECT');  -- expect: false
