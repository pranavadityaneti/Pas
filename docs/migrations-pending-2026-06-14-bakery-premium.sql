-- ════════════════════════════════════════════════════════════════════════
-- Bakeries & Desserts → premium tier (₹2,999)   2026-06-14
--
-- Pranav's decision: bakeries sign the Restaurant agreement (food + dining) and
-- should pay its ₹2,999 onboarding fee, so the signed contract's stated fee
-- matches what they actually pay. `isPremium` drives StepSubscription pricing
-- (₹999 standard / ₹2,999 premium) and is read live by GET /verticals.
-- This also resolves the config inconsistency (getIsDining=true but isPremium=no).
--
-- Apply alongside the merchant_consents migration. Idempotent (re-runnable).
-- ════════════════════════════════════════════════════════════════════════

UPDATE public."Vertical"
SET "isPremium" = true, "updatedAt" = now()
WHERE name = 'Bakeries & Desserts';

-- Verify:
--   SELECT name, "isPremium", "isDining" FROM public."Vertical" WHERE name = 'Bakeries & Desserts';
--   -> isPremium = true, isDining = true
