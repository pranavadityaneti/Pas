// Phase 3 Item 4 (Option B): get_nearby_stores — hide stores with 0 active
// products + modernize the parent-store join to the canonical FK (mb.store_id,
// NOT NULL since Phase 2 FINAL) instead of the legacy mb.merchant_id convention.
// Pranav-approved 2026-06-16 (Option B). Reversible: re-apply the prior def (in
// SESSION_LOG / git history).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Wide test point over Hyderabad to capture every local branch for the compare.
const LAT = 17.44, LON = 78.43, RADIUS = 100000;

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
      AND EXISTS (                                         -- Phase 3 Item 4: hide empty stores
          SELECT 1 FROM "public"."StoreProduct" sp
          WHERE sp.branch_id = mb.id
            AND sp.active = true
            AND COALESCE(sp.is_deleted, false) = false
      )
      AND ST_DWithin(
        ST_MakePoint(mb.longitude, mb.latitude)::geography,
        ST_MakePoint(user_lon, user_lat)::geography,
        radius_meters
    )
    ORDER BY distance_meters ASC;
$function$
`;

async function main() {
  console.log('--- BEFORE: current get_nearby_stores output (wide Hyderabad radius) ---');
  const before: any[] = await prisma.$queryRawUnsafe(
    `SELECT id::text AS id FROM get_nearby_stores(${LAT}, ${LON}, ${RADIUS}) ORDER BY id;`
  );
  console.log(before.map((r) => r.id));

  console.log('\n--- Apply CREATE OR REPLACE (filter + FK join) ---');
  await prisma.$executeRawUnsafe(NEW_DEF);
  console.log('  ✓ function replaced');

  console.log('\n--- AFTER: new get_nearby_stores output ---');
  const after: any[] = await prisma.$queryRawUnsafe(
    `SELECT id::text AS id FROM get_nearby_stores(${LAT}, ${LON}, ${RADIUS}) ORDER BY id;`
  );
  console.log(after.map((r) => r.id));

  const beforeSet = new Set(before.map((r) => r.id));
  const afterSet = new Set(after.map((r) => r.id));
  const removed = [...beforeSet].filter((x) => !afterSet.has(x));
  const added = [...afterSet].filter((x) => !beforeSet.has(x));
  console.log('\n--- Delta ---');
  console.log('  removed (empty/now-hidden):', removed.length ? removed : 'none');
  console.log('  added (should be none):', added.length ? added : 'none');
  if (added.length) throw new Error('New function ADDED stores — unexpected, investigate.');

  console.log('\n--- Verify every returned store has active inventory (the new guarantee) ---');
  const check: any[] = await prisma.$queryRawUnsafe(`
    SELECT g.id::text AS branch_id,
           (SELECT COUNT(*)::int FROM "StoreProduct" sp WHERE sp.branch_id = g.id AND sp.active = true AND COALESCE(sp.is_deleted,false)=false) AS active_products
    FROM get_nearby_stores(${LAT}, ${LON}, ${RADIUS}) g;
  `);
  console.table(check);
  const empties = check.filter((r) => r.active_products === 0);
  console.log(empties.length === 0 ? '  ✓ every discoverable store has ≥1 active product.' : `  ✗ ${empties.length} empty stores still returned!`);
  if (empties.length) throw new Error('Empty stores still returned.');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
