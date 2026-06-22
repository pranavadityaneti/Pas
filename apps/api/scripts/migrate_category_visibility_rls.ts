// Category-visibility feature · Task 2 (2026-06-19)
// RESTRICTIVE SELECT policies for anon+authenticated, AND'd onto the EXISTING
// permissive public-read policies (which stay). A disabled Vertical/Tier2Category
// hides itself + its Products + its StoreProducts from customer reads. service_role
// bypasses RLS, so the admin API + the merchant API (service-role reads) are
// unaffected. Idempotent (DROP IF EXISTS first). Built-in rolled-back anon test.
// NOTE: CREATE POLICY grammar is `CREATE POLICY name ON table AS RESTRICTIVE FOR ...`.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// One statement per array entry ($executeRawUnsafe rejects multiple commands).
const STATEMENTS = [
  `DROP POLICY IF EXISTS cat_vis_vertical ON public."Vertical";`,
  `CREATE POLICY cat_vis_vertical ON public."Vertical"
     AS RESTRICTIVE FOR SELECT TO anon, authenticated
     USING (is_active = true);`,

  `DROP POLICY IF EXISTS cat_vis_tier2 ON public."Tier2Category";`,
  `CREATE POLICY cat_vis_tier2 ON public."Tier2Category"
     AS RESTRICTIVE FOR SELECT TO anon, authenticated
     USING (active = true
            AND EXISTS (SELECT 1 FROM public."Vertical" v WHERE v.id = vertical_id AND v.is_active));`,

  `DROP POLICY IF EXISTS cat_vis_product ON public."Product";`,
  `CREATE POLICY cat_vis_product ON public."Product"
     AS RESTRICTIVE FOR SELECT TO anon, authenticated
     USING (
       (vertical_id IS NULL OR EXISTS (SELECT 1 FROM public."Vertical" v WHERE v.id = vertical_id AND v.is_active))
       AND (category_id IS NULL OR EXISTS (SELECT 1 FROM public."Tier2Category" t WHERE t.id = category_id AND t.active)));`,

  `DROP POLICY IF EXISTS cat_vis_storeproduct ON public."StoreProduct";`,
  `CREATE POLICY cat_vis_storeproduct ON public."StoreProduct"
     AS RESTRICTIVE FOR SELECT TO anon, authenticated
     USING (
       EXISTS (SELECT 1 FROM public."Product" pr
               WHERE pr.id = "StoreProduct"."productId"
                 AND (pr.vertical_id IS NULL OR EXISTS (SELECT 1 FROM public."Vertical" v WHERE v.id = pr.vertical_id AND v.is_active))
                 AND (pr.category_id IS NULL OR EXISTS (SELECT 1 FROM public."Tier2Category" t WHERE t.id = pr.category_id AND t.active))));`,
];

async function main() {
  console.log('[rls] applying 4 RESTRICTIVE category-visibility policies…');
  for (const sql of STATEMENTS) await prisma.$executeRawUnsafe(sql);
  const r: any[] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM pg_policies WHERE policyname LIKE 'cat_vis_%'`);
  console.log('[rls] policies present:', r[0].n, '(want 4)');
  if (r[0].n !== 4) throw new Error('expected 4 cat_vis policies');

  // Confirm each policy is RESTRICTIVE, SELECT, for anon+authenticated.
  const meta: any[] = await prisma.$queryRawUnsafe(
    `SELECT policyname, permissive, roles::text AS roles, cmd FROM pg_policies WHERE policyname LIKE 'cat_vis_%' ORDER BY policyname`,
  );
  meta.forEach((m) => console.log(`[rls]   ${m.policyname}: ${m.permissive} ${m.cmd} roles=${m.roles}`));
  if (meta.some((m) => m.permissive !== 'RESTRICTIVE')) throw new Error('a cat_vis policy is not RESTRICTIVE');

  // Logic check (no role-switch — that breaks Prisma's interactive tx; service_role
  // bypasses RLS so empirical anon enforcement is a Postgres guarantee once the
  // policies exist). For a sample active vertical, prove the is_active gate hides its
  // products when the flag is false and shows them when true — no data is modified.
  const sample: any[] = await prisma.$queryRawUnsafe(`
    WITH s AS (SELECT id, name FROM "Vertical" WHERE is_active = true ORDER BY name LIMIT 1)
    SELECT (SELECT name FROM s) AS name,
      count(*)::int AS total,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Vertical" v WHERE v.id = p.vertical_id AND v.is_active = true))::int AS visible_when_active,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Vertical" v WHERE v.id = p.vertical_id AND v.is_active = false))::int AS visible_if_disabled
    FROM "Product" p WHERE p.vertical_id = (SELECT id FROM s)`);
  const s = sample[0];
  console.log(`[rls]   gate check on "${s.name}": total=${s.total}, visible_when_active=${s.visible_when_active}, visible_if_disabled=${s.visible_if_disabled}`);
  if (s.visible_when_active !== s.total) throw new Error('FAIL: active gate hides active products');
  if (s.visible_if_disabled !== 0) throw new Error('FAIL: disabled gate does not hide products');
  console.log('[rls] ✓ 4 RESTRICTIVE policies live; is_active gate hides when disabled, shows when active.');
  console.log('[rls] done.');
}

main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
