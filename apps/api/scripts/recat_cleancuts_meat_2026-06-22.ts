// Fix data (2026-06-22): categorize Clean cuts' 4 customer-visible uncategorized meat/seafood
// products into Fresh Items / Meat & Seafood. Atomic + rollback snapshot. Safe to delete after.
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
const q = (s: string, ...a: any[]) => prisma.$queryRawUnsafe(s, ...a) as Promise<any[]>;
const ROLLBACK = `${__dirname}/_recat_cleancuts_rollback_2026-06-22.json`;
const NAMES = ['Boneless mutton', 'Mutton', 'Lobster', 'Fish bush'];

async function main() {
  const fi = (await q(`SELECT id FROM "Vertical" WHERE name = 'Fresh Items'`))[0];
  const sub = (await q(`SELECT id FROM "Tier2Category" WHERE vertical_id = $1::uuid AND name = 'Meat & Seafood'`, fi.id))[0];
  if (!sub) throw new Error('Meat & Seafood subcategory not found');

  const rows = await q(`
    SELECT DISTINCT pr.id, pr.name, pr.vertical_id AS "oldV", pr.category_id AS "oldC"
    FROM "Product" pr
    WHERE pr.vertical_id IS NULL AND pr.name = ANY($1::text[])`, NAMES);
  console.log(`[cleancuts] ${rows.length} products → Fresh Items / Meat & Seafood:`);
  rows.forEach((r) => console.log(`   • ${r.name}`));
  if (!rows.length) { console.log('nothing to do'); return; }

  fs.writeFileSync(ROLLBACK, JSON.stringify({ when: '2026-06-22', sub: 'Meat & Seafood', moves: rows }, null, 2));
  console.log(`[cleancuts] rollback snapshot: ${ROLLBACK}`);
  await prisma.$executeRawUnsafe(`UPDATE "Product" SET vertical_id=$1::uuid, category_id=$2::uuid WHERE id = ANY($3::text[])`,
    fi.id, sub.id, rows.map((r) => r.id));
  console.log(`[cleancuts] ✓ ${rows.length} categorized`);
}
main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
