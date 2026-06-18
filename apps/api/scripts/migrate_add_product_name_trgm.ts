// Phase 4 sub-2 · Task 2 (2026-06-17)
// Adds pg_trgm extension + a GIN trigram index on "Product".name to make ILIKE
// '%term%' fast at 140k row scale (spec §9, decision D7). Idempotent. Confirms
// the index is used via EXPLAIN ANALYZE on a sample query.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[trgm] CREATE EXTENSION pg_trgm IF NOT EXISTS');
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

  console.log('[trgm] creating idx_product_name_trgm (GIN, gin_trgm_ops)…');
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_product_name_trgm ON public."Product" USING gin (name gin_trgm_ops);`,
  );

  const r: any[] = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE indexname='idx_product_name_trgm'`,
  );
  console.log('[trgm] verify present:', r);
  if (!r.length) throw new Error('index not present after CREATE');

  console.log('[trgm] EXPLAIN ANALYZE search for "maggi" (sample)…');
  const e: any[] = await prisma.$queryRawUnsafe(
    `EXPLAIN ANALYZE SELECT id FROM "Product" WHERE name ILIKE '%maggi%' LIMIT 30`,
  );
  console.log(e.map((x: any) => x['QUERY PLAN']).join('\n'));

  console.log('[trgm] done.');
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
