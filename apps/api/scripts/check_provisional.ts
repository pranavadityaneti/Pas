import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.commissionRule.findMany({
    where: { provisional: true },
    orderBy: [{ category: 'asc' }, { orderType: 'asc' }, { tier: 'asc' }],
  });
  console.log(`provisional rules (${rows.length}):`);
  for (const r of rows) {
    console.log(`  ${r.category.padEnd(36)} ${r.orderType.padEnd(7)} tier=${r.tier ?? '-'}  ratePct=${r.ratePct}`);
  }
}
main().finally(() => prisma.$disconnect());
