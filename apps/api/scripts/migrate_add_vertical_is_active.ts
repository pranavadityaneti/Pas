// Category-visibility feature · Task 1 (2026-06-19)
// Additive: Vertical.is_active boolean (default true) + index. All 15 verticals
// start active. Idempotent.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[is_active] adding Vertical.is_active (default true) + index…');
  await prisma.$executeRawUnsafe(`ALTER TABLE public."Vertical" ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_vertical_is_active ON public."Vertical"(is_active);`);
  const r: any[] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE is_active)::int AS active FROM "Vertical"`,
  );
  console.log('[is_active] verticals:', r[0].n, 'active:', r[0].active, '(want all active)');
  if (r[0].n !== r[0].active) throw new Error('some verticals defaulted inactive — abort');
  console.log('[is_active] done.');
}

main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
