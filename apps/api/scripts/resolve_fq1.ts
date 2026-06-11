// FQ-1 resolution (2026-06-11) — founder decided 7% for the 6 categories
// that conflicted between the commission table (5%) and the bottom-of-sheet
// summary (7%). Stationery (2% provisional, separate sub-category split
// question) and the F&B tier-3-5 blanks (FQ-2) stay provisional — separate
// decisions, not part of this change.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const FQ1_CATEGORIES = [
  'Beauty & personal care',
  'Electronics and accessories',
  'Fashion and apparel',
  'Home and lifestyle',
  'Pet care and supplies',
  'Sports and fitness',
];

async function findActor(): Promise<string> {
  // Try by email first, then by isAdmin=true, then by role=SUPER_ADMIN.
  let u: { id: string } | null = await prisma.user.findUnique({
    where: { email: 'sowfreyr@gmail.com' }, select: { id: true },
  });
  if (!u) u = await prisma.user.findFirst({
    where: { isAdmin: true }, orderBy: { createdAt: 'asc' }, select: { id: true },
  });
  if (!u) u = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' as any }, orderBy: { createdAt: 'asc' }, select: { id: true },
  });
  return u?.id ?? '';
}

async function main() {
  const actor = await findActor();
  if (!actor) { console.error('FATAL: could not resolve any admin user for audit log'); process.exit(1); }
  console.log('actor user id:', actor);

  const targets = await prisma.commissionRule.findMany({
    where: { category: { in: FQ1_CATEGORIES }, provisional: true },
    orderBy: { category: 'asc' },
  });
  console.log(`will update ${targets.length} rule(s):`);
  for (const r of targets) {
    console.log(`  ${r.category.padEnd(36)} ${r.orderType} tier=${r.tier ?? '-'}  5% -> 7%`);
  }

  for (const r of targets) {
    const before = { ratePct: r.ratePct.toString(), provisional: r.provisional };
    const updated = await prisma.commissionRule.update({
      where: { id: r.id },
      data: { ratePct: 7, provisional: false },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: actor,
        action: 'settlement.commission_rule_updated',
        targetType: 'commission_rule',
        targetId: updated.id,
        beforeJson: before as any,
        afterJson: { ratePct: updated.ratePct.toString(), provisional: updated.provisional, reason: 'FQ-1 resolution: founder chose 7%' } as any,
      },
    });
  }
  console.log('done.');

  const remaining = await prisma.commissionRule.findMany({
    where: { provisional: true },
    select: { category: true, orderType: true, tier: true, ratePct: true },
    orderBy: { category: 'asc' },
  });
  console.log(`remaining provisional rules (${remaining.length} — expected: 17 = 1 Stationery + 16 F&B tier-3-5/NULL = FQ-2):`);
  for (const r of remaining) {
    console.log(`  ${r.category.padEnd(36)} ${r.orderType.padEnd(7)} tier=${r.tier ?? '-'}  ratePct=${r.ratePct}`);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); }).finally(() => prisma.$disconnect());
