// Delete 8 user-approved catalog-only gibberish products. Captures full rows first
// (recoverable) + aborts if any is referenced by an order. Atomic. Safe to delete after.
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
const q = (s: string, ...a: any[]) => prisma.$queryRawUnsafe(s, ...a) as Promise<any[]>;
const BACKUP = `${__dirname}/_deleted_gibberish_2026-06-22.json`;
const NAMES = ['Custom', 'Fashion', 'Indian fashion', 'Greeb', 'VJr', 'Smil fit', 'Surhi', 'Royal blue'];

async function main() {
  // only the uncategorized, catalog-only matches (don't touch any legit same-named product)
  const targets = await q(`
    SELECT pr.* FROM "Product" pr
    WHERE pr.vertical_id IS NULL AND pr.name = ANY($1::text[])
      AND NOT EXISTS (SELECT 1 FROM "StoreProduct" sp WHERE sp."productId" = pr.id AND sp.active = true AND COALESCE(sp.is_deleted,false)=false)`, NAMES);
  console.log(`[del] matched ${targets.length} products:`, targets.map((t) => t.name).join(', '));
  if (!targets.length) { console.log('nothing to delete'); return; }

  // safety: abort if any appears in an order_request
  const ids = targets.map((t) => t.id);
  for (const id of ids) {
    const n = (await q(`SELECT count(*)::int n FROM "order_requests" WHERE items::text ILIKE $1`, `%${id}%`))[0].n;
    if (n > 0) throw new Error(`ABORT: ${id} referenced by ${n} order(s)`);
  }

  fs.writeFileSync(BACKUP, JSON.stringify({ when: '2026-06-22', deleted: targets }, null, 2));
  console.log(`[del] full rows backed up: ${BACKUP}`);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM "StoreProduct" WHERE "productId" = ANY($1::text[])`, ids);
    const d = await tx.$executeRawUnsafe(`DELETE FROM "Product" WHERE id = ANY($1::text[])`, ids);
    console.log(`[del] ✓ deleted ${d} product rows (+ any stray listings)`);
  });

  const remaining = (await q(`SELECT count(*)::int n FROM "Product" WHERE vertical_id IS NULL`))[0].n;
  console.log(`[del] null-vertical products remaining: ${remaining}`);
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
