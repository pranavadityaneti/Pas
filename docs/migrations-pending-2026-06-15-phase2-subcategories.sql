-- Phase 2 · Step 2 — seed 41 new Tier2Category subcategories (2026-06-15)
-- STAGED — apply to prod ONLY on Pranav's explicit go, via:
--   cd apps/api && npx prisma db execute --schema prisma/schema.prisma \
--     --file ../../docs/migrations-pending-2026-06-15-phase2-subcategories.sql
-- Idempotent: ON CONFLICT (vertical_id, name) DO NOTHING — safe to re-run.
-- Looks up each parent vertical BY NAME (no hardcoded UUIDs). Reflects Pranav's
-- decisions: Pooja/Sports/Hardware fully populated, Plumbing & Bathroom Fittings
-- added, "Yogurt Desserts" dropped, regulated "Paan & Tobacco" EXCLUDED.

INSERT INTO public."Tier2Category" (id, name, vertical_id, active, "createdAt", "updatedAt")
SELECT gen_random_uuid(), s.subcat, ver.id, true, now(), now()
FROM (VALUES
  -- Bakeries & Desserts (6)
  ('Bakeries & Desserts','Ice Cream & Frozen Desserts'),
  ('Bakeries & Desserts','Candies & Confections'),
  ('Bakeries & Desserts','Mouth Fresheners'),
  ('Bakeries & Desserts','Syrups & Toppings'),
  ('Bakeries & Desserts','Rusks & Wafers'),
  ('Bakeries & Desserts','Baking Supplies & Ingredients'),
  -- Beauty & Personal Care (8)
  ('Beauty & Personal Care','Fragrances'),
  ('Beauty & Personal Care','Oral Care'),
  ('Beauty & Personal Care','Feminine Care'),
  ('Beauty & Personal Care','Deodorants & Talc'),
  ('Beauty & Personal Care','Women''s Grooming'),
  ('Beauty & Personal Care','Tools & Accessories'),
  ('Beauty & Personal Care','Gift Sets & Kits'),
  ('Beauty & Personal Care','Hair Accessories'),
  -- Grocery & Kirana (5)
  ('Grocery & Kirana','Sauces & Spreads'),
  ('Grocery & Kirana','Frozen Foods'),
  ('Grocery & Kirana','Breakfast & Cereals'),
  ('Grocery & Kirana','Lassi & Shakes'),
  ('Grocery & Kirana','Water & Ice'),
  -- Hardware & Plumbing (3)
  ('Hardware & Plumbing','Home Improvement & Tools'),
  ('Hardware & Plumbing','Hardware & Fittings'),
  ('Hardware & Plumbing','Plumbing & Bathroom Fittings'),
  -- Home & Lifestyle (2)
  ('Home & Lifestyle','Small Appliances'),
  ('Home & Lifestyle','Disposables & Tissues'),
  -- Pharmacy & Wellness (10)
  ('Pharmacy & Wellness','Cold & Cough'),
  ('Pharmacy & Wellness','Health Supports & Ortho'),
  ('Pharmacy & Wellness','Adult Incontinence'),
  ('Pharmacy & Wellness','Masks & Sanitizers'),
  ('Pharmacy & Wellness','Smoking Cessation Aids'),
  ('Pharmacy & Wellness','Baby Diapers & Wipes'),
  ('Pharmacy & Wellness','Baby Feeding Essentials'),
  ('Pharmacy & Wellness','Nursing & Lactation'),
  ('Pharmacy & Wellness','Baby Bathing Essentials'),
  ('Pharmacy & Wellness','Baby Gear & Equipment'),
  -- Sports & Fitness (2)
  ('Sports & Fitness','Fitness Equipment & Gear'),
  ('Sports & Fitness','Sports & Outdoor Accessories'),
  -- Stationery, Gifting & Toys (1)
  ('Stationery, Gifting & Toys','Magazines'),
  -- Pooja & Festive Needs (4)
  ('Pooja & Festive Needs','Festive & Occasion'),
  ('Pooja & Festive Needs','Spiritual & Religious'),
  ('Pooja & Festive Needs','Pooja Essentials'),
  ('Pooja & Festive Needs','Festive Gifting')
) AS s(vert, subcat)
JOIN public."Vertical" ver ON ver.name = s.vert
ON CONFLICT (vertical_id, name) DO NOTHING;

-- Verify (expect 41 newly-present, and the 3 previously-empty verticals now populated):
--   SELECT v.name, count(t.id) FROM public."Vertical" v
--     LEFT JOIN public."Tier2Category" t ON t.vertical_id = v.id
--     GROUP BY v.name ORDER BY v.name;
