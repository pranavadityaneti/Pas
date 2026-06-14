-- ════════════════════════════════════════════════════════════════════════
-- platform_settings — Global Config key/value store   (2026-06-14, STAGED)
--
-- Backs the admin Global Config panel. Read/written by the API (service_role)
-- via GET/PATCH /admin/config; the consumer/merchant apps read the public
-- subset via GET /config/public. RLS-locked (no client access) — the API is
-- the only reader/writer; service_role bypasses RLS.
--
-- Apply on Pranav's go (additive, low-risk). Idempotent.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB        NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by UUID
);

INSERT INTO public.platform_settings (key, value) VALUES
    ('service_radius_km', to_jsonb(10)),
    ('min_order_value',   to_jsonb(0))
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_settings FROM anon, authenticated;

-- Verify:
--   SELECT key, value FROM public.platform_settings;
