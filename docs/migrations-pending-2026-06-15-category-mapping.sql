-- Phase 2 · Step 1 — CategoryMapping table (2026-06-15)
-- STAGED — apply to prod ONLY on Pranav's explicit go, via:
--   cd apps/api && npx prisma db execute --schema prisma/schema.prisma \
--     --file ../../docs/migrations-pending-2026-06-15-category-mapping.sql
-- Additive, idempotent (IF NOT EXISTS). Maps a purchased-catalog source taxonomy
-- (BLINKIT 47 cats / 643 pairs) onto PAS's 15 verticals + Tier2Categories.
-- Only the API (Prisma direct/service_role) touches this table; RLS enabled with
-- NO policies so PostgREST (anon/authenticated) cannot read it; the direct
-- connection bypasses RLS.

CREATE TABLE IF NOT EXISTS public."CategoryMapping" (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform    text NOT NULL,
  source_category    text NOT NULL,
  source_subcategory text NOT NULL DEFAULT '',          -- '' = category-wide default
  vertical_id        uuid REFERENCES public."Vertical"(id)       ON DELETE SET NULL,
  category_id        uuid REFERENCES public."Tier2Category"(id)  ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'ACTIVE',     -- ACTIVE | PENDING_DECISION | EXCLUDED
  "createdAt"        timestamptz NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categorymapping_platform_cat_subcat_key
    UNIQUE (source_platform, source_category, source_subcategory)
);

CREATE INDEX IF NOT EXISTS categorymapping_platform_idx
  ON public."CategoryMapping" (source_platform);

ALTER TABLE public."CategoryMapping" ENABLE ROW LEVEL SECURITY;

-- Verify:
--   SELECT to_regclass('public."CategoryMapping"');                       -- not null
--   SELECT count(*) FROM public."CategoryMapping";                        -- 0
--   \d+ public."CategoryMapping"                                          -- columns + RLS enabled
