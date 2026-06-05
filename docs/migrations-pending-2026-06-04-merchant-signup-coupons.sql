-- Phase 2.E2 — Merchant signup coupons + redemptions.
--
-- Backs the partner-coupon system on the signup Subscription step. The
-- frontend (Phase 2.E) currently has a client-only stub validator
-- (LAUNCH100 → ₹100 off, LAUNCH500 → ₹500 off). After this migration runs
-- AND the API code lands (separate commit), the frontend swaps to a real
-- POST /merchant-signup/validate-coupon call.
--
-- Spec: docs/merchant-signup-v2-spec.md — "Coupon system" section.
-- ──────────────────────────────────────────────────────────────────────
-- Run via Supabase Dashboard → SQL Editor. All statements idempotent.
-- ──────────────────────────────────────────────────────────────────────

-- ── Coupons table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchant_signup_coupons (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    code             text          UNIQUE NOT NULL,
    discount_inr     integer       NOT NULL CHECK (discount_inr > 0),
    max_uses         integer       CHECK (max_uses IS NULL OR max_uses > 0),
    used_count       integer       NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    applies_to_tier  text          CHECK (applies_to_tier IN ('standard', 'premium') OR applies_to_tier IS NULL),
    expires_at       timestamptz,
    is_active        boolean       NOT NULL DEFAULT true,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now()
);

-- Case-insensitive lookups for codes ("launch100" === "LAUNCH100")
CREATE UNIQUE INDEX IF NOT EXISTS merchant_signup_coupons_code_upper_idx
    ON merchant_signup_coupons (UPPER(code));

-- ── Redemptions table ─────────────────────────────────────────────────
-- merchant_id is TEXT (not UUID) because merchants.id is text in this DB
-- (Prisma `String @id @default(uuid())` without @db.Uuid). The spec said
-- uuid but the FK must match the parent column type.
CREATE TABLE IF NOT EXISTS merchant_signup_coupon_redemptions (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id     uuid          NOT NULL REFERENCES merchant_signup_coupons(id) ON DELETE RESTRICT,
    merchant_id   text          NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    code_snapshot text          NOT NULL,
    amount_inr    integer       NOT NULL CHECK (amount_inr > 0),
    applied_at    timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (merchant_id)   -- one coupon per merchant signup, ever
);

CREATE INDEX IF NOT EXISTS merchant_signup_coupon_redemptions_coupon_idx
    ON merchant_signup_coupon_redemptions (coupon_id);

-- ── Auto-bump updated_at on coupon row updates ────────────────────────
CREATE OR REPLACE FUNCTION merchant_signup_coupons_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS merchant_signup_coupons_updated_at_trg ON merchant_signup_coupons;
CREATE TRIGGER merchant_signup_coupons_updated_at_trg
    BEFORE UPDATE ON merchant_signup_coupons
    FOR EACH ROW EXECUTE FUNCTION merchant_signup_coupons_set_updated_at();

-- ── Seed launch coupons matching the frontend stub ────────────────────
-- Idempotent: re-runs of this migration won't duplicate.
INSERT INTO merchant_signup_coupons (code, discount_inr, max_uses, applies_to_tier, is_active)
VALUES
    ('LAUNCH100', 100, 1000, NULL, true),
    ('LAUNCH500', 500, 100,  NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────
-- Optional verification queries:
--
-- SELECT id, code, discount_inr, max_uses, used_count, applies_to_tier, is_active
-- FROM merchant_signup_coupons
-- ORDER BY created_at DESC;
--
-- SELECT count(*) AS redemptions FROM merchant_signup_coupon_redemptions;
-- ──────────────────────────────────────────────────────────────────────
