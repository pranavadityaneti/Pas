// Phase 7G dry-run (2026-06-11): drain payment verification, then run the
// cycle close against prod. NOTHING is marked paid. With zero settlement
// profiles assigned, the close is expected to hold all orders and create no
// cycles — this validates the engine end-to-end without freezing numbers.
import { PrismaClient } from '@prisma/client';
import { verifyPendingPayments } from '../src/services/scheduled-jobs';
import { closeSettlementCycles, PHASE7_EPOCH } from '../src/services/settlement.service';

const prisma = new PrismaClient();

async function main() {
    console.log('epoch:', PHASE7_EPOCH.toISOString());

    // 1. Pre-state: verification census over the epoch window.
    const census = await prisma.$queryRaw<any[]>`
        SELECT payment_verified::text AS pv, COUNT(*)::int AS n
        FROM orders WHERE created_at >= ${PHASE7_EPOCH}
          AND (ispaid = true OR status = 'RETURN_APPROVED')
        GROUP BY 1 ORDER BY 1;`;
    console.log('pre-verify census (payment_verified -> count):', JSON.stringify(census));

    // 2. Drain verification backlog.
    let total = 0;
    for (let i = 0; i < 40; i++) {
        const n = await verifyPendingPayments(prisma);
        total += n;
        if (n < 25) break;
    }
    console.log('verification: processed', total, 'orders this run');

    const census2 = await prisma.$queryRaw<any[]>`
        SELECT payment_verified::text AS pv, COUNT(*)::int AS n
        FROM orders WHERE created_at >= ${PHASE7_EPOCH}
          AND (ispaid = true OR status = 'RETURN_APPROVED')
        GROUP BY 1 ORDER BY 1;`;
    console.log('post-verify census:', JSON.stringify(census2));

    // 3. The close (default = last fully elapsed IST week).
    const result = await closeSettlementCycles(prisma);
    console.log('close result:', JSON.stringify(result, null, 2));

    // 4. Post-state: what exists in the ledger now.
    const cycles = await prisma.settlementCycle.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    console.log('cycles in ledger:', cycles.length === 0 ? 'NONE' : JSON.stringify(cycles, null, 2));
    const lines = await prisma.settlementLine.count();
    console.log('total settlement lines:', lines);
}
main().catch((e) => { console.error('DRYRUN FAILED:', e); process.exit(1); }).finally(() => prisma.$disconnect());
