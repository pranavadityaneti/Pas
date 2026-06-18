// Phase 4 sub-2 · Task 11 — adversarial audit of the catalog picker (spec §11).
// DB-integrity checks run unauthenticated. The HTTP checks that need a merchant JWT
// run only if TEST_MERCHANT_JWT is set:
//   API_BASE=https://api.pickatstore.io TEST_MERCHANT_JWT=<jwt> npx tsx scripts/audit_catalog_picker.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API = process.env.API_BASE || 'https://api.pickatstore.io';
const JWT = process.env.TEST_MERCHANT_JWT;

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = '') { console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); ok ? pass++ : fail++; }

async function main() {
  const branch = await prisma.merchantBranch.findFirst({ select: { id: true } });
  const where: any = {
    source: { in: ['blinkit', 'live_sync', 'purchased_catalog'] }, mrp: { gt: 0 },
    NOT: { storeProducts: { some: { branch_id: branch!.id, is_deleted: false } } },
  };

  // 1. keyset pages don't overlap
  const p1 = await prisma.product.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10, include: { Vertical: { select: { name: true } } } });
  const last = p1[p1.length - 1];
  const p2 = await prisma.product.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10, cursor: { id: last.id }, skip: 1 });
  const ids1 = new Set(p1.map((x) => x.id));
  check('keyset pagination: page2 disjoint from page1', !p2.some((x) => ids1.has(x.id)), `p1=${p1.length} p2=${p2.length}`);

  // 2. trigram search returns matches
  const s = await prisma.product.findMany({ where: { ...where, name: { contains: 'atta', mode: 'insensitive' } }, take: 3, select: { name: true } });
  check('trigram search "atta"', s.length > 0, `${s.length} rows`);

  // 3. mrp filter excludes ≤0 (none expected — all blinkit > 0)
  const zero = await prisma.product.count({ where: { ...where, mrp: { lte: 0 } } });
  check('no ≤₹0 products in pickable set', zero === 0, `${zero} found`);

  // 4. MRP-ceiling trigger present
  const trg: any[] = await prisma.$queryRawUnsafe(`SELECT tgname FROM pg_trigger WHERE tgname='trg_storeproduct_mrp_ceiling'`);
  check('MRP-ceiling trigger installed', trg.length === 1);

  // 5. trigram index present
  const idx: any[] = await prisma.$queryRawUnsafe(`SELECT indexname FROM pg_indexes WHERE indexname='idx_product_name_trgm'`);
  check('trigram index installed', idx.length === 1);

  // 6. isVeg tri-state populated for food
  const foodNullVeg = await prisma.product.count({ where: { source: 'blinkit', Vertical: { requiresFssai: true }, isVeg: null } });
  check('food products have non-null isVeg (blinkit)', foodNullVeg === 0, `${foodNullVeg} food rows still null`);

  if (JWT) {
    // 7. unauth → 401
    const r401 = await fetch(`${API}/merchant/catalog?branchId=${branch!.id}`);
    check('GET /merchant/catalog requires auth', r401.status === 401, `got ${r401.status}`);
    // 8. authed happy path
    const r = await fetch(`${API}/merchant/catalog?branchId=${branch!.id}&limit=5`, { headers: { Authorization: `Bearer ${JWT}` } });
    const body: any = await r.json().catch(() => ({}));
    check('authed catalog returns data[]', r.status === 200 && Array.isArray(body.data), `status ${r.status}`);
    // 9. empty items → 400
    const rc = await fetch(`${API}/merchant/store-products/configure`, { method: 'POST', headers: { Authorization: `Bearer ${JWT}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ branchId: branch!.id, items: [] }) });
    check('configure empty items → 400', rc.status === 400);
  } else {
    console.log('… (set TEST_MERCHANT_JWT to also run the HTTP auth/contract checks)');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
