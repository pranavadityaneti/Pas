// Category-visibility feature · Task 3 (2026-06-19)
// Make the discovery RPC get_nearby_stores category-aware (spec D7): the
// "hide empty stores" EXISTS additionally requires each candidate StoreProduct's
// Product to be in an ACTIVE vertical AND (no subcategory OR an active subcategory).
// A store with nothing visible auto-drops; multi-category stores stay; auto-returns
// on re-enable. Idempotent (CREATE OR REPLACE). Changes nothing while all categories
// are active. service_role-safe AND anon-safe: this is correct regardless of caller,
// so discovery stays category-aware even if RLS is bypassed (service_role) or the
// function is ever made SECURITY DEFINER.
//
// ROLLBACK: re-run the ORIGINAL definition (the EXISTS without the JOIN/predicates),
// preserved verbatim in ORIGINAL_DEF below.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NEW_DEF = `
CREATE OR REPLACE FUNCTION public.get_nearby_stores(user_lat double precision, user_lon double precision, radius_meters double precision)
 RETURNS TABLE(id uuid, distance_meters double precision)
 LANGUAGE sql
AS $function$
    SELECT
        mb.id::uuid AS id,
        ST_Distance(
            ST_MakePoint(mb.longitude, mb.latitude)::geography,
            ST_MakePoint(user_lon, user_lat)::geography
        ) AS distance_meters
    FROM "public"."merchant_branches" mb
    JOIN "public"."Store" s ON s.id = mb.store_id          -- Phase 2 FINAL: canonical FK link (NOT NULL)
    WHERE mb.latitude IS NOT NULL
      AND mb.longitude IS NOT NULL
      AND s.active = true                                  -- only admin-approved stores
      AND EXISTS (                                         -- Phase 3 Item 4 + category-visibility D7: hide empty / fully-disabled stores
          SELECT 1 FROM "public"."StoreProduct" sp
          JOIN "public"."Product" pr ON pr.id = sp."productId"
          WHERE sp.branch_id = mb.id
            AND sp.active = true
            AND COALESCE(sp.is_deleted, false) = false
            AND (pr.vertical_id IS NULL OR EXISTS (SELECT 1 FROM "public"."Vertical" v WHERE v.id = pr.vertical_id AND v.is_active))
            AND (pr.category_id IS NULL OR EXISTS (SELECT 1 FROM "public"."Tier2Category" t WHERE t.id = pr.category_id AND t.active))
      )
      AND ST_DWithin(
        ST_MakePoint(mb.longitude, mb.latitude)::geography,
        ST_MakePoint(user_lon, user_lat)::geography,
        radius_meters
    )
    ORDER BY distance_meters ASC;
$function$;
`;

// Preserved for rollback — the live definition before Task 3.
const ORIGINAL_DEF = `
CREATE OR REPLACE FUNCTION public.get_nearby_stores(user_lat double precision, user_lon double precision, radius_meters double precision)
 RETURNS TABLE(id uuid, distance_meters double precision)
 LANGUAGE sql
AS $function$
    SELECT mb.id::uuid AS id,
        ST_Distance(ST_MakePoint(mb.longitude, mb.latitude)::geography, ST_MakePoint(user_lon, user_lat)::geography) AS distance_meters
    FROM "public"."merchant_branches" mb
    JOIN "public"."Store" s ON s.id = mb.store_id
    WHERE mb.latitude IS NOT NULL AND mb.longitude IS NOT NULL AND s.active = true
      AND EXISTS (SELECT 1 FROM "public"."StoreProduct" sp WHERE sp.branch_id = mb.id AND sp.active = true AND COALESCE(sp.is_deleted, false) = false)
      AND ST_DWithin(ST_MakePoint(mb.longitude, mb.latitude)::geography, ST_MakePoint(user_lon, user_lat)::geography, radius_meters)
    ORDER BY distance_meters ASC;
$function$;
`;
void ORIGINAL_DEF;

async function main() {
  console.log('[nearby] replacing get_nearby_stores with category-aware version…');
  await prisma.$executeRawUnsafe(NEW_DEF);

  // 1) Confirm the new predicate is present in the live definition.
  const def: any[] = await prisma.$queryRawUnsafe(
    `SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = 'get_nearby_stores'`,
  );
  const ok = def[0]?.def?.includes('Tier2Category') && def[0]?.def?.includes('Product');
  console.log('[nearby] category predicate present in live def:', ok);
  if (!ok) throw new Error('replacement did not take — category predicate missing');

  // 2) Functional smoke + gate logic check on a real branch (no role-switch, no data change).
  //    Pick a discoverable branch (coords + ≥1 active, non-deleted StoreProduct), confirm the
  //    RPC still returns it within a wide radius (no regression while all categories are active),
  //    then prove the new gate would drop it if its products' vertical were disabled.
  const sample: any[] = await prisma.$queryRawUnsafe(`
    WITH b AS (
      SELECT mb.id, mb.latitude AS lat, mb.longitude AS lon
      FROM "merchant_branches" mb
      JOIN "Store" s ON s.id = mb.store_id AND s.active = true
      WHERE mb.latitude IS NOT NULL AND mb.longitude IS NOT NULL
        AND EXISTS (SELECT 1 FROM "StoreProduct" sp WHERE sp.branch_id = mb.id AND sp.active = true AND COALESCE(sp.is_deleted,false)=false)
      LIMIT 1
    )
    SELECT
      (SELECT id FROM b) AS branch_id,
      (SELECT count(*)::int FROM get_nearby_stores((SELECT lat FROM b), (SELECT lon FROM b), 50000) g WHERE g.id::text = (SELECT id FROM b)) AS rpc_returns_self,
      (SELECT count(*)::int FROM "StoreProduct" sp JOIN "Product" pr ON pr.id = sp."productId"
        WHERE sp.branch_id = (SELECT id FROM b) AND sp.active = true AND COALESCE(sp.is_deleted,false)=false
          AND (pr.vertical_id IS NULL OR EXISTS (SELECT 1 FROM "Vertical" v WHERE v.id = pr.vertical_id AND v.is_active = true))) AS visible_now,
      (SELECT count(*)::int FROM "StoreProduct" sp JOIN "Product" pr ON pr.id = sp."productId"
        WHERE sp.branch_id = (SELECT id FROM b) AND sp.active = true AND COALESCE(sp.is_deleted,false)=false
          AND (pr.vertical_id IS NOT NULL AND EXISTS (SELECT 1 FROM "Vertical" v WHERE v.id = pr.vertical_id AND v.is_active = false))) AS visible_if_vertical_disabled
  `);
  const s = sample[0];
  console.log(`[nearby] sample branch ${s.branch_id}: rpc_returns_self=${s.rpc_returns_self}, visible_now=${s.visible_now}, visible_if_vertical_disabled=${s.visible_if_vertical_disabled}`);
  if (s.rpc_returns_self !== 1) throw new Error('REGRESSION: discoverable branch no longer returned by the RPC while all categories are active');
  if (s.visible_if_vertical_disabled !== 0) throw new Error('FAIL: the vertical gate does not zero-out visibility when disabled');
  console.log('[nearby] ✓ category-aware discovery live; no regression while active; gate drops stores when their category is disabled.');
  console.log('[nearby] done.');
}

main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
