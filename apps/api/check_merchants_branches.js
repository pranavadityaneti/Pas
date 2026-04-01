const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find merchants that have has_branches = true
    const merchants = await prisma.merchant.findMany({
        where: { hasBranches: true },
        include: { branches: true },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log("Recent merchants with branches:", JSON.stringify(merchants.map(m => ({
        id: m.id,
        phone: m.phone,
        has_branches: m.hasBranches,
        branches_count: m.branches.length
    })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
