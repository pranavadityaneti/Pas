import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.product.findMany({
    select: { category: true },
    distinct: ['category']
  });
  console.log('Unique Categories:', categories.map(c => c.category));
}

main().finally(() => prisma.$disconnect());
