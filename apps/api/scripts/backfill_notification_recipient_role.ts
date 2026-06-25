// Notifications #14 — Phase 1 backfill: set recipient_role = 'merchant' on the
// legacy rows where it is NULL (written before the recipient_role column existed).
//
// WHY: the role cutover (consumer + merchant useNotifications hooks) now reads
// notifications by `.eq('recipient_role', …)`. Any row with a NULL recipient_role
// would vanish from BOTH inboxes. As measured 2026-06-23 the NULL set is 12 rows,
// all unambiguous MERCHANT types (NEW_ORDER_REQUEST / COMPLETED / ORDER_UPDATE /
// NEW_ORDER). This backfill tags them 'merchant' so they survive the cutover.
//
// SAFETY:
//   • DRY-RUN by default. It only mutates when run with `--apply` (or APPLY=1).
//   • ABORT-AND-REPORT guard: it writes ONLY if every NULL row is an unambiguous
//     merchant-only type. If a consumer-only or dual-role (e.g. ORDER_CANCELLED,
//     RETURN_*) row is ever NULL, the script refuses to guess — it prints them and
//     exits without writing, so a human decides. This hardens against data drift.
//   • Reversible: on --apply it first writes a rollback JSON snapshot (every
//     affected id) next to this script BEFORE mutating.
//
// RUN:   cd apps/api
//        npx tsx scripts/backfill_notification_recipient_role.ts            # dry-run (read-only)
//        npx tsx scripts/backfill_notification_recipient_role.ts --apply    # execute (gated)
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply') || process.env.APPLY === '1';

// Unambiguous MERCHANT-only types. Deliberately conservative: NONE of these appear
// in the consumer inbox, and dual-role types (ORDER_CANCELLED, RETURN_REQUESTED,
// EXCHANGE_REQUESTED, RETURN_DECISION, EXCHANGE_DECISION) are intentionally EXCLUDED
// so the guard below stops rather than mis-tag them.
const MERCHANT_ONLY_TYPES = new Set([
  'NEW_ORDER',
  'NEW_ORDER_REQUEST',
  'COMPLETED',
  'ORDER_UPDATE',
  'LOW_STOCK',
  'RIDER_ARRIVED',
  'ORDER_RESCHEDULED',
  'CANCELLED',
]);

function fmtDist(rows: Array<{ recipientRole: string | null; _count: { _all: number } }>) {
  return rows
    .map(r => `  ${r.recipientRole === null ? 'NULL' : r.recipientRole}: ${r._count._all}`)
    .join('\n');
}

async function main() {
  console.log(`[notif-role-backfill] mode = ${APPLY ? 'APPLY (will write)' : 'DRY-RUN (read-only)'}`);

  const before = await prisma.notification.groupBy({ by: ['recipientRole'], _count: { _all: true } });
  console.log(`[notif-role-backfill] recipient_role distribution BEFORE:\n${fmtDist(before as any)}`);

  // Snapshot every NULL row (for the rollback JSON + the guard).
  const nullRows = await prisma.notification.findMany({
    where: { recipientRole: null },
    select: { id: true, type: true, createdAt: true, userId: true, storeId: true },
  });
  console.log(`[notif-role-backfill] NULL recipient_role rows: ${nullRows.length}`);

  if (nullRows.length === 0) {
    console.log('[notif-role-backfill] nothing to backfill. Done.');
    return;
  }

  // Breakdown by type.
  const byType = nullRows.reduce<Record<string, number>>((acc, r) => {
    const t = r.type || '(none)';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  console.log('[notif-role-backfill] NULL rows by type:');
  for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${n}`);

  // GUARD: refuse to proceed if any NULL row is NOT an unambiguous merchant-only type.
  const unexpected = nullRows.filter(r => !MERCHANT_ONLY_TYPES.has((r.type || '').toUpperCase()));
  if (unexpected.length > 0) {
    console.error(
      `\n[notif-role-backfill] ABORT: ${unexpected.length} NULL row(s) are NOT unambiguous ` +
      `merchant-only types — auto-tagging them 'merchant' could be wrong. No changes written.`,
    );
    console.error('[notif-role-backfill] Rows needing a human decision:');
    for (const r of unexpected) console.error(`  id=${r.id} type=${r.type} userId=${r.userId} storeId=${r.storeId} createdAt=${r.createdAt?.toISOString?.() ?? r.createdAt}`);
    process.exitCode = 2;
    return;
  }

  console.log(`[notif-role-backfill] all ${nullRows.length} NULL rows are merchant-only types — safe to backfill → 'merchant'.`);

  if (!APPLY) {
    console.log('\n[notif-role-backfill] DRY-RUN complete. No changes written. Re-run with --apply to execute.');
    return;
  }

  // --apply path: snapshot rollback JSON BEFORE mutating.
  const rollbackPath = path.join(__dirname, '_notif_recipient_role_backfill_rollback_2026-06-25.json');
  fs.writeFileSync(
    rollbackPath,
    JSON.stringify(
      { generatedAt: '2026-06-25', action: "set recipient_role='merchant' where recipient_role IS NULL", previousValue: null, rows: nullRows },
      null,
      2,
    ),
  );
  console.log(`[notif-role-backfill] wrote rollback snapshot (${nullRows.length} ids): ${rollbackPath}`);

  const result = await prisma.notification.updateMany({
    where: { recipientRole: null },
    data: { recipientRole: 'merchant' },
  });
  console.log(`[notif-role-backfill] updated ${result.count} row(s) → recipient_role='merchant'.`);

  const remaining = await prisma.notification.count({ where: { recipientRole: null } });
  console.log(`[notif-role-backfill] NULL recipient_role remaining (should be 0): ${remaining}`);

  const after = await prisma.notification.groupBy({ by: ['recipientRole'], _count: { _all: true } });
  console.log(`[notif-role-backfill] recipient_role distribution AFTER:\n${fmtDist(after as any)}`);
  console.log('[notif-role-backfill] done.');
}

main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
