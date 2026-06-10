/**
 * Scheduled background jobs (node-cron) running inside the existing Express API.
 *
 * Currently runs every minute and performs four operations:
 *   1. Pickup reminder 30 min before slot
 *   2. Pickup reminder 10 min before slot
 *   3. Dine-in reminder 30 min before slot
 *   4. Expire stale order_requests (past expires_at) — closes forlater #17
 *
 * Dedupe strategy:
 *   For each reminder, we check the `notifications` table for an existing row
 *   with the same `referenceId` (order id) AND `type` (reminder type) before
 *   firing. The `notifications` row itself acts as our "already-sent" marker.
 *
 * Multi-instance note:
 *   If/when the API runs on >1 instance, the dedupe check has a small race
 *   window. For MVP single-instance EB, this is fine. To harden: add a
 *   composite unique constraint on (referenceId, type) where type is a
 *   reminder type, OR use a distributed lock.
 */

import cron from 'node-cron';
import * as Sentry from '@sentry/node';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification.service';
import { closeSettlementCycles, detectClawback } from './settlement.service';

const REMINDER_TYPES = {
    PICKUP_30: 'PICKUP_REMINDER_30MIN',
    PICKUP_10: 'PICKUP_REMINDER_10MIN',
    DINING_30: 'DINING_REMINDER_30MIN',
} as const;

const MIN_MS = 60 * 1000;

/**
 * Mount all scheduled jobs. Call once at server boot, AFTER notificationService
 * and prisma are initialized.
 */
export function initScheduledJobs(
    prisma: PrismaClient,
    notificationService: NotificationService
): void {
    // Per-process running guard (round-5 hardening). node-cron fires every
    // minute regardless of whether the previous tick finished. With slow
    // Razorpay calls inside processOrderIssueSla, tick N+1 can start while
    // tick N is still mid-batch. The issue-level CAS prevents double-refund
    // on the same row, but multiple ticks racing each other waste DB
    // connections and inflate Sentry noise. This flag serializes ticks.
    let cronTickRunning = false;

    cron.schedule('* * * * *', async () => {
        if (cronTickRunning) {
            console.warn('[cron] previous tick still running — skipping this tick');
            return;
        }
        cronTickRunning = true;
        try {
            try {
                await firePickupReminders30Min(prisma, notificationService);
            } catch (e) {
                console.error('[cron] firePickupReminders30Min error:', e);
                Sentry.captureException(e, { tags: { area: 'cron.pickupReminders30' } });
            }
            try {
                await firePickupReminders10Min(prisma, notificationService);
            } catch (e) {
                console.error('[cron] firePickupReminders10Min error:', e);
                Sentry.captureException(e, { tags: { area: 'cron.pickupReminders10' } });
            }
            try {
                await fireDiningReminders30Min(prisma, notificationService);
            } catch (e) {
                console.error('[cron] fireDiningReminders30Min error:', e);
                Sentry.captureException(e, { tags: { area: 'cron.diningReminders30' } });
            }
            try {
                await expireStaleOrderRequests(prisma);
            } catch (e) {
                console.error('[cron] expireStaleOrderRequests error:', e);
                Sentry.captureException(e, { tags: { area: 'cron.expireStaleOrderRequests' } });
            }
            try {
                await healMissingUserRows(prisma);
            } catch (e) {
                console.error('[cron] healMissingUserRows error:', e);
                Sentry.captureException(e, { tags: { area: 'cron.healMissingUserRows' } });
            }
            // WS2.D (2026-06-05): SLA auto-approve for return/exchange issues.
            try {
                await processOrderIssueSla(prisma, notificationService);
            } catch (e) {
                console.error('[cron] processOrderIssueSla error:', e);
                Sentry.captureException(e, { tags: { area: 'cron.processOrderIssueSla' } });
            }
            // Round-5 hardening: reconciliation pass for N7 misses. Catches
            // order_requests that were left COMPLETED even though their
            // linked order was cancelled (e.g., SIGTERM during the cancel
            // endpoint's post-tx cleanup).
            try {
                await reconcileOrderRequestStatus(prisma);
            } catch (e) {
                console.error('[cron] reconcileOrderRequestStatus error:', e);
                Sentry.captureException(e, { tags: { area: 'cron.reconcileOrderRequestStatus' } });
            }
            // Phase 7B (2026-06-10): re-verify orders whose payment check was
            // inconclusive at create time (Razorpay API error / SDK gap).
            try {
                await verifyPendingPayments(prisma);
            } catch (e) {
                console.error('[cron] verifyPendingPayments error:', e);
                Sentry.captureException(e, { tags: { area: 'cron.verifyPendingPayments' } });
            }
            // Phase 7B / N6 (2026-06-10): orphaned-payments sweep — captured
            // consumer payments with no order behind them get auto-refunded.
            // Runs every 10th minute; respects CRON_DRY_RUN.
            try {
                if (new Date().getMinutes() % 10 === 0) {
                    await sweepOrphanedPayments(prisma);
                }
            } catch (e) {
                console.error('[cron] sweepOrphanedPayments error:', e);
                Sentry.captureException(e, { tags: { area: 'cron.sweepOrphanedPayments' } });
            }
        } finally {
            cronTickRunning = false;
        }
    });

    // Phase 7C (2026-06-10): weekly settlement close — Monday 02:00 IST,
    // closing the just-ended Mon-Sun IST week. Idempotent (cycle-level skip +
    // the SALE partial-unique), so the admin "Close cycle" button and this
    // cron can coexist safely.
    cron.schedule('0 2 * * 1', async () => {
        try {
            const result = await closeSettlementCycles(prisma);
            console.log('[cron] weekly settlement close:', JSON.stringify(result));
        } catch (e) {
            console.error('[cron] weekly settlement close error:', e);
            Sentry.captureException(e, { tags: { area: 'cron.settlementClose' } });
        }
    }, { timezone: 'Asia/Kolkata' });

    console.log('[cron] Scheduled jobs initialized — running every 1 minute (+ weekly settlement close Mon 02:00 IST)');
    if (process.env.CRON_DRY_RUN === 'true') {
        console.warn('[cron] DRY-RUN MODE — Razorpay refund calls will be simulated only. Unset CRON_DRY_RUN to enable real refunds.');
    }
}

// ─────────────────────── WS2.D: SLA auto-approve cron ──────────────────
// Polls order_issues for PENDING rows whose merchant-decision SLA has
// elapsed (sla_due_at < now()) and auto-approves them. Each elapsed row:
//   1. issue.status → AUTO_APPROVED
//   2. order.status → RETURN_APPROVED / EXCHANGE_APPROVED
//   3. For returns with refundAmountInr > 0 — attempt Razorpay refund.
//      Fallback to a simulated refund id so the issue resolves cleanly
//      even when Razorpay isn't reachable; ops reconciles in the dashboard.
//   4. Customer notification (RETURN_DECISION / EXCHANGE_DECISION) with
//      decision='AUTO_APPROVED' in metadata.
//
// Idempotent via the PENDING gate — a row that's already AUTO_APPROVED
// won't be reprocessed. The partial index `order_issues_pending_sla_idx`
// (WHERE status='PENDING') keeps the lookup cheap.

// Locally-scoped Razorpay refund helper (mirrors apps/api/src/index.ts
// processRazorpayRefund — kept in-file to avoid a circular import).
async function tryRazorpayRefund(
    orderMetadata: any,
    amountInr: number,
): Promise<{ razorpayRefundId: string; simulated: boolean }> {
    // Round-5 hardening: dry-run mode for the rollout-first-day. With
    // CRON_DRY_RUN=true, never actually call Razorpay — return a 'sim'
    // stub. Lets ops watch logs for what the cron WOULD do for 24h
    // before flipping the flag and letting it move real money.
    if (process.env.CRON_DRY_RUN === 'true') {
        const stubId = `rfnd_dryrun_${Date.now()}`;
        console.warn('[cron sla refund] DRY_RUN — would refund', { amountInr, stubId });
        return { razorpayRefundId: stubId, simulated: true };
    }

    // POST /orders persists Razorpay's payment id at metadata.razorpayPaymentId
    // (camelCase) — see index.ts ~line 2414 and InvoiceModal.tsx line 64. This
    // helper previously looked at the wrong keys and therefore ALWAYS fell
    // through to the simulated path. Fixed 2026-06-05 (Bug B).
    const paymentId = orderMetadata?.razorpayPaymentId || null;

    let razorpayInstance: any = null;
    try {
        const Razorpay = require('razorpay');
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
            razorpayInstance = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });
        }
    } catch (e) {
        console.warn('[cron sla refund] razorpay sdk init failed:', e);
    }

    if (!razorpayInstance || !paymentId) {
        const stubId = `rfnd_sim_${Date.now()}`;
        console.warn('[cron sla refund] razorpay missing or no paymentId — simulating', stubId);
        return { razorpayRefundId: stubId, simulated: true };
    }

    try {
        const refund = await razorpayInstance.payments.refund(paymentId, {
            amount: Math.round(amountInr) * 100,
        });
        return { razorpayRefundId: refund.id as string, simulated: false };
    } catch (err: any) {
        console.error('[cron sla refund] razorpay refund failed:', paymentId, err?.message || err);
        return { razorpayRefundId: `rfnd_err_${Date.now()}`, simulated: true };
    }
}

async function processOrderIssueSla(
    prisma: PrismaClient,
    notificationService: NotificationService,
): Promise<void> {
    const now = new Date();

    // Find elapsed PENDING issues. Cap the per-tick batch to avoid runaway
    // load if the backlog gets large.
    const elapsed = await prisma.orderIssue.findMany({
        where: { status: 'PENDING', slaDueAt: { lt: now } },
        orderBy: { slaDueAt: 'asc' },
        take: 50,
    });

    if (elapsed.length === 0) return;

    // Round-6 hardening (H5): true dry-run mode. The previous DRY_RUN gate
    // only stubbed the Razorpay HTTP call — DB state still committed +
    // customer notifications still fired. That is NOT a soak mode; it
    // leaves real customers waiting for refunds the cron promised them.
    // Now DRY_RUN short-circuits the entire SLA loop. Ops can verify
    // counts + per-issue logs without any mutation.
    if (process.env.CRON_DRY_RUN === 'true') {
        console.warn(`[cron sla] DRY_RUN — would auto-approve ${elapsed.length} issue(s). No DB writes, no Razorpay calls, no notifications.`);
        for (const issue of elapsed) {
            console.warn(`[cron sla] DRY_RUN issue=${issue.id} type=${issue.type} orderId=${issue.orderId} refundAmountInr=${issue.refundAmountInr ?? 'n/a'}`);
        }
        return;
    }

    console.log(`[cron sla] auto-approving ${elapsed.length} elapsed issue(s)`);

    for (const issue of elapsed) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: issue.orderId },
                include: { user: true },
            });
            if (!order) {
                console.warn('[cron sla] order missing for issue', issue.id, '— skipping');
                continue;
            }

            const newOrderStatus =
                issue.type === 'return' ? 'RETURN_APPROVED' :
                issue.type === 'exchange' ? 'EXCHANGE_APPROVED' :
                order.status;
            const needsRefund = issue.type === 'return' && (issue.refundAmountInr ?? 0) > 0;

            // FLIP STATUS FIRST inside a transaction (Bug 3 fix).
            //
            // Previously the Razorpay refund was called BEFORE this
            // transaction. If the refund succeeded but the transaction then
            // threw (DB blip, contention), the catch block would log and
            // `continue` to the next issue — leaving this issue still
            // PENDING. The next cron tick (1 minute later) would find it
            // again and refund a second time. Cron retry makes this the
            // worst exposure in the codebase.
            //
            // By committing AUTO_APPROVED first, the PENDING-only findMany
            // at the top of this function excludes the row on subsequent
            // ticks. The refund happens at most once.
            // ATOMIC COMPARE-AND-SET (Bug N2 fix — third-pass audit).
            //
            // findMany at the top returned this issue as PENDING, but the
            // merchant could have clicked Approve in their inbox during the
            // gap between that read and this write. Without a compare-and-
            // set guard, both processes would commit a status change and
            // both would call Razorpay → double refund.
            //
            // `updateMany` with `status: 'PENDING'` in the WHERE clause is
            // atomic: if the merchant won the race, count === 0, we set
            // `wonRace = false` and skip the refund block entirely. The row
            // is already correctly resolved by the merchant's transaction.
            let wonRace = true;
            await prisma.$transaction(async (tx) => {
                const updateRes = await tx.orderIssue.updateMany({
                    where: { id: issue.id, status: 'PENDING' },
                    data: {
                        status: 'AUTO_APPROVED',
                        resolvedAt: now,
                        merchantDecisionReason: 'Auto-approved after merchant SLA elapsed (24h).',
                    },
                });
                if (updateRes.count === 0) {
                    wonRace = false;
                    return;  // transaction body returns; nothing else mutates
                }
                // Round-5 hardening: re-read order.metadata INSIDE the tx so
                // concurrent writes (merchant PATCH, webhook) between findUnique
                // at line 158 and this update don't get silently clobbered.
                const fresh = await tx.order.findUnique({
                    where: { id: order.id },
                    select: { metadata: true },
                });
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        status: newOrderStatus,
                        ...(needsRefund && { isPaid: false }),
                        metadata: {
                            ...(typeof fresh?.metadata === 'object' && fresh?.metadata !== null ? fresh.metadata : {}),
                            autoApprovedAt: now.toISOString(),
                        } as any,
                    },
                });
            });

            if (!wonRace) {
                console.log(`[cron sla] issue ${issue.id} was already decided by merchant — skipping refund + notif`);
                continue;
            }

            // Razorpay refund AFTER status commit. The compare-and-set above
            // guarantees we only reach here if we own the resolution.
            let refundResult: { razorpayRefundId: string; simulated: boolean } | null = null;
            if (needsRefund) {
                refundResult = await tryRazorpayRefund(order.metadata, issue.refundAmountInr!);
                // Phase 7D (2026-06-10): settled-order refund → clawback entry.
                try { await detectClawback(prisma, order.id, issue.refundAmountInr!, `sla auto-refund ${refundResult.razorpayRefundId}`); } catch (e) { console.error('[7D] clawback detect (sla) failed:', e); }
                // Persist refund id back. If this write fails after Razorpay
                // succeeded, ops reconciles from the dashboard.
                await prisma.$transaction(async (tx) => {
                    await tx.orderIssue.update({
                        where: { id: issue.id },
                        data: { refundRazorpayId: refundResult!.razorpayRefundId, refundProcessedAt: now },
                    });
                    // Round-5 hardening: re-read metadata inside the tx so concurrent
                    // writes during the Razorpay HTTP call aren't clobbered.
                    const fresh = await tx.order.findUnique({
                        where: { id: order.id },
                        select: { metadata: true },
                    });
                    await tx.order.update({
                        where: { id: order.id },
                        data: {
                            metadata: {
                                ...(typeof fresh?.metadata === 'object' && fresh?.metadata !== null ? fresh.metadata : {}),
                                returnRazorpayRefundId: refundResult!.razorpayRefundId,
                                returnRefundSimulated: refundResult!.simulated,
                                autoApprovedAt: now.toISOString(),
                            } as any,
                        },
                    });
                }).catch((e: any) => {
                    console.error('[cron sla] metadata refund write failed:', e);
                    Sentry.captureException(e, {
                        tags: { area: 'cron.metadataRefundWrite' },
                        extra: { issueId: issue.id, orderId: order.id, razorpayRefundId: refundResult?.razorpayRefundId },
                    });
                });
            }

            notificationService.sendConsumerNotification({
                userId: order.userId,
                title: `${issue.type === 'return' ? 'Return' : 'Exchange'} auto-approved`,
                body: `Order #${order.orderNumber}: approved automatically after 24h wait.`,
                type: issue.type === 'return' ? 'RETURN_DECISION' : 'EXCHANGE_DECISION',
                referenceId: order.id,
                storeId: order.storeId,
                link: `/orders/${order.id}`,
                metadata: {
                    orderNumber: order.orderNumber,
                    issueId: issue.id,
                    decision: 'AUTO_APPROVED',
                    refundInr: issue.refundAmountInr ?? null,
                    razorpayRefundId: refundResult?.razorpayRefundId ?? null,
                },
            }).catch(e => console.error('[cron sla] consumer notif failed:', e));

            console.log(`[cron sla] ✓ issue=${issue.id} type=${issue.type} order=#${order.orderNumber} ${refundResult ? `refund=${refundResult.razorpayRefundId}${refundResult.simulated ? '(sim)' : ''}` : 'no-refund'}`);
        } catch (e) {
            console.error('[cron sla] issue', issue.id, 'failed:', e);
            Sentry.captureException(e, {
                tags: { area: 'cron.processIssueLoop' },
                extra: { issueId: issue.id, orderId: issue.orderId, issueType: issue.type },
            });
            // Continue processing the rest — this issue retries next tick.
        }
    }
}

// ─────────────── Round-5: reconciliation pass for N7 misses ──────────
//
// The /orders/:id/cancel endpoint flips its linked order_request to
// CANCELLED in a best-effort `await`ed call. If the API process is
// killed (SIGTERM during EB rolling deploy / scaling) in the gap
// between sending the response and the SQL round-trip resolving,
// the order_request stays at COMPLETED forever — the merchant
// request-queue dashboard sees a "fulfilled" request whose order is
// actually CANCELLED.
//
// This pass catches the drift: find COMPLETED order_requests whose
// linked order is CANCELLED, and reconcile. Idempotent.

async function reconcileOrderRequestStatus(prisma: PrismaClient): Promise<void> {
    // Limit per-tick to avoid a runaway sweep.
    const candidates: Array<{ id: string; order_id: string | null }> = await prisma.$queryRawUnsafe(`
        SELECT r.id, o.id AS order_id
        FROM order_requests r
        JOIN orders o ON (o.metadata->>'orderRequestId')::uuid = r.id
        WHERE r.status = 'COMPLETED' AND o.status = 'CANCELLED'
        LIMIT 50
    `);
    if (candidates.length === 0) return;
    let healed = 0;
    for (const c of candidates) {
        const res = await prisma.order_requests.updateMany({
            where: { id: c.id, status: 'COMPLETED' },
            data: { status: 'CANCELLED', updated_at: new Date() },
        }).catch((e: any) => {
            console.error('[cron reconcile] failed for', c.id, e);
            Sentry.captureException(e, {
                tags: { area: 'cron.reconcileOrderRequestStatus' },
                extra: { orderRequestId: c.id },
            });
            return null;
        });
        if (res && res.count > 0) healed++;
    }
    if (healed > 0) {
        console.warn(`[cron reconcile] healed ${healed} stale COMPLETED order_requests whose orders are CANCELLED. Investigate cancel-endpoint SIGTERMs.`);
    }
}

// ---------- Reminder helpers ----------

/**
 * Fire a customer reminder N minutes before their pickup/dining slot.
 * Uses a 2-minute window [now+(offsetMin-1), now+(offsetMin+1)] to absorb
 * minor cron skew. Dedup ensures no duplicate sends.
 */
async function fireReminder(
    prisma: PrismaClient,
    notificationService: NotificationService,
    orderType: 'pickup' | 'dine-in',
    offsetMin: number,
    reminderType: string,
    title: string,
    bodyTemplate: (orderNumber: string) => string
): Promise<void> {
    const now = Date.now();
    const windowStart = new Date(now + (offsetMin - 1) * MIN_MS);
    const windowEnd = new Date(now + (offsetMin + 1) * MIN_MS);

    const candidates = await (prisma as any).order.findMany({
        where: {
            // Include both CONFIRMED and PREPARING — merchants often move to
            // PREPARING well before the slot, so a strict CONFIRMED filter would
            // silently suppress the reminder. Exclude READY because event #3
            // (ORDER_READY) already fires immediately when status flips to READY —
            // double-notifying would be annoying.
            status: { in: ['CONFIRMED', 'PREPARING'] },
            order_type: orderType,
            slot_time_at: { gte: windowStart, lte: windowEnd },
        },
        select: {
            id: true,
            userId: true,
            orderNumber: true,
            storeId: true,
        },
    });

    for (const order of candidates) {
        if (!order.userId) continue;

        // Dedupe: skip if we already sent this reminder for this order
        const existing = await (prisma as any).notification.findFirst({
            where: { referenceId: order.id, type: reminderType },
            select: { id: true },
        });
        if (existing) continue;

        try {
            await notificationService.sendConsumerNotification({
                userId: order.userId,
                title,
                body: bodyTemplate(order.orderNumber),
                type: reminderType,
                referenceId: order.id,
                link: `/orders/${order.id}`,
                storeId: order.storeId,
                metadata: { orderNumber: order.orderNumber },
            });
            console.log(`[cron] Sent ${reminderType} for order ${order.orderNumber}`);
        } catch (e) {
            console.error(`[cron] Failed to send ${reminderType} for order ${order.id}:`, e);
        }
    }
}

async function firePickupReminders30Min(
    prisma: PrismaClient,
    notificationService: NotificationService
): Promise<void> {
    await fireReminder(
        prisma,
        notificationService,
        'pickup',
        30,
        REMINDER_TYPES.PICKUP_30,
        'Pickup slot in 30 min ⏰',
        (orderNumber) => `Your order #${orderNumber} pickup slot is in 30 minutes.`
    );
}

async function firePickupReminders10Min(
    prisma: PrismaClient,
    notificationService: NotificationService
): Promise<void> {
    await fireReminder(
        prisma,
        notificationService,
        'pickup',
        10,
        REMINDER_TYPES.PICKUP_10,
        'Your order is waiting 👋',
        (orderNumber) => `Just 10 minutes until your pickup slot for order #${orderNumber}.`
    );
}

async function fireDiningReminders30Min(
    prisma: PrismaClient,
    notificationService: NotificationService
): Promise<void> {
    await fireReminder(
        prisma,
        notificationService,
        'dine-in',
        30,
        REMINDER_TYPES.DINING_30,
        'Dining slot in 30 min 🍴',
        (orderNumber) => `Your dining slot for order #${orderNumber} is in 30 minutes. See you soon!`
    );
}

// ---------- Order request expiry (forlater #17) ----------

/**
 * Flips PENDING/ACCEPTED order_requests past their expires_at to EXPIRED.
 *
 * This is what the customer-app client-side 2-minute timer SHOULD have done,
 * but if the client crashes, closes, or loses connectivity at the moment of
 * failure, the timer never fires and the row stays ACCEPTED forever in the DB.
 * Closes forlater #17.
 */
async function expireStaleOrderRequests(prisma: PrismaClient): Promise<void> {
    const result = await prisma.order_requests.updateMany({
        where: {
            status: { in: ['PENDING', 'ACCEPTED'] },
            expires_at: { lt: new Date() },
        },
        data: {
            status: 'EXPIRED',
            updated_at: new Date(),
        },
    });
    if (result.count > 0) {
        console.log(`[cron] Expired ${result.count} stale order_requests`);
    }
}

// ---------- Layer 3: self-heal missing consumer User rows ----------

/**
 * Defense-in-depth backstop for the order-create FK (fk_orders_user → "User").
 *
 * Every signed-up customer has a `profiles` row (created by the handle_new_user
 * trigger). `orders.user_id` FKs to "User". If any path ever leaves a customer
 * without a "User" row (trigger bug/edge, manual auth insert, future change),
 * their checkout would fail. This repairs that drift within a minute by creating
 * the missing "User" rows from profiles + auth.users, and ALERTS if it ever finds
 * any (so we learn that an upstream layer slipped before a customer does).
 *
 * Raw SQL because `profiles` and `auth.users` are Supabase tables not in the
 * Prisma schema. ON CONFLICT (id) keeps it idempotent.
 */
async function healMissingUserRows(prisma: PrismaClient): Promise<void> {
    const healed = await prisma.$executeRawUnsafe(`
        INSERT INTO "User" (id, email, "passwordHash", role, name, phone, "isAdmin", "createdAt", "updatedAt")
        SELECT p.id,
               COALESCE(au.email, p.id::text || '@auto.pickatstore.app'),
               'sso_auth_active', 'CONSUMER'::"Role", p.full_name, au.phone, false,
               COALESCE(au.created_at, now()), now()
        FROM profiles p
        JOIN auth.users au ON au.id = p.id
        LEFT JOIN "User" u ON u.id = p.id
        WHERE u.id IS NULL
        ON CONFLICT (id) DO NOTHING
    `);
    if (healed && Number(healed) > 0) {
        // ALERT: drift was detected and auto-healed. Investigate why the signup
        // path missed these — this should normally be 0 forever.
        console.error(`[cron][ALERT] Self-heal created ${healed} missing consumer "User" row(s). The signup trigger missed them — investigate.`);
    }
}

// ─────────────── Phase 7B (2026-06-10): payment verification jobs ───────────
// Settlement prerequisite + the N6 decision (build the cron, don't soften the
// copy). Shares the local Razorpay init + CRON_DRY_RUN conventions used by
// tryRazorpayRefund above.

function initLocalRazorpay(): any {
    try {
        const Razorpay = require('razorpay');
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
            return new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });
        }
    } catch (e) {
        console.warn('[cron 7b] razorpay sdk init failed:', e);
    }
    return null;
}

/**
 * Re-verify orders whose create-time payment check was inconclusive
 * (payment_verified IS NULL): Razorpay API error, SDK unconfigured, or
 * pre-deploy orders inside the window. Sets TRUE (captured + amount-coherent),
 * FALSE (held from settlement), and leaves NULL only on repeated API errors.
 * Batch-capped; the partial index orders_payment_unverified_idx keeps the
 * scan cheap. Also callable with an explicit window by the cycle-close engine.
 */
export async function verifyPendingPayments(
    prisma: PrismaClient,
    window?: { from: Date; to: Date },
): Promise<void> {
    const rzp = initLocalRazorpay();
    if (!rzp) return; // nothing to do without credentials — orders stay NULL

    const from = window?.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Give create-time verification 3 minutes before the cron picks a row up.
    const to = window?.to ?? new Date(Date.now() - 3 * 60 * 1000);

    const candidates = await prisma.order.findMany({
        where: { isPaid: true, paymentVerified: null, createdAt: { gte: from, lte: to } },
        select: { id: true, totalAmount: true, metadata: true },
        orderBy: { createdAt: 'asc' },
        take: 25,
    });
    if (candidates.length === 0) return;

    for (const o of candidates) {
        const paymentId = (o.metadata as any)?.razorpayPaymentId
            ? String((o.metadata as any).razorpayPaymentId)
            : null;
        if (!paymentId) {
            await prisma.order.update({
                where: { id: o.id },
                data: { paymentVerified: false, paymentVerificationNote: 'paid claim without payment id' },
            });
            try { Sentry.captureMessage('phase7b: paid order has no payment id — HELD', { level: 'warning', extra: { orderId: o.id } }); } catch {}
            continue;
        }
        try {
            const p: any = await rzp.payments.fetch(paymentId);
            const status = String(p?.status || '');
            if (status !== 'captured' && status !== 'authorized') {
                await prisma.order.update({
                    where: { id: o.id },
                    data: { paymentVerified: false, paymentVerificationNote: `payment status ${status || 'unknown'}` },
                });
                try { Sentry.captureMessage('phase7b: cron verification FAILED — payment not captured', { level: 'warning', extra: { orderId: o.id, paymentId, status } }); } catch {}
                continue;
            }
            const capturedInr = Number(p.amount || 0) / 100;
            const sibling = await prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: { metadata: { path: ['razorpayPaymentId'], equals: paymentId } },
            });
            const bookedInr = Number(sibling._sum.totalAmount || 0);
            if (bookedInr > capturedInr + 5) {
                await prisma.order.update({
                    where: { id: o.id },
                    data: { paymentVerified: false, paymentVerificationNote: `amount overrun: captured ₹${capturedInr}, booked ₹${bookedInr}` },
                });
                try { Sentry.captureMessage('phase7b: cron verification — amount overrun, HELD', { level: 'warning', extra: { orderId: o.id, paymentId, capturedInr, bookedInr } }); } catch {}
            } else {
                await prisma.order.update({
                    where: { id: o.id },
                    data: { paymentVerified: true, paymentVerificationNote: `captured ₹${capturedInr} (cron-verified)` },
                });
            }
        } catch (err: any) {
            const msg = String(err?.message || err);
            if (/does not exist|not found|invalid id/i.test(msg)) {
                await prisma.order.update({
                    where: { id: o.id },
                    data: { paymentVerified: false, paymentVerificationNote: 'payment id unknown to Razorpay' },
                });
                try { Sentry.captureMessage('phase7b: cron verification — payment id unknown, HELD', { level: 'warning', extra: { orderId: o.id, paymentId } }); } catch {}
            } else {
                // Transport error — leave NULL; next tick retries.
                console.warn(`[cron 7b] verify transport error for order ${o.id}: ${msg}`);
            }
        }
    }
}

/**
 * Orphaned-payments sweep (N6 decision: build the cron). Finds CAPTURED
 * consumer payments from the last 24h (excluding the most recent 15 min —
 * checkout may legitimately still be in flight) that have NO order behind
 * them, and refunds them in full. Attribution is strict: auto-refund ONLY
 * payments tagged notes.paymentType='consumer_order' (set by
 * /payments/create-order since Phase 7B) or whose Razorpay order receipt
 * carries the consumer 'PAS-' prefix. Everything else (merchant signup
 * payments, unattributable) is flagged to Sentry for manual review — never
 * auto-refunded. Respects CRON_DRY_RUN.
 */
export async function sweepOrphanedPayments(prisma: PrismaClient): Promise<void> {
    const rzp = initLocalRazorpay();
    if (!rzp) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const list: any = await rzp.payments.all({
        from: nowSec - 24 * 60 * 60,
        to: nowSec - 15 * 60,
        count: 100,
    });
    const payments: any[] = Array.isArray(list?.items) ? list.items : [];
    if (payments.length === 0) return;

    for (const p of payments) {
        try {
            if (String(p?.status) !== 'captured') continue;
            if (Number(p?.amount_refunded || 0) > 0) continue; // already (partially) refunded

            // Skip non-consumer flows outright.
            const noteType = p?.notes?.paymentType ? String(p.notes.paymentType) : null;
            if (noteType === 'merchant_signup') continue;

            // An order exists? Not an orphan.
            const order = await prisma.order.findFirst({
                where: { metadata: { path: ['razorpayPaymentId'], equals: String(p.id) } },
                select: { id: true },
            });
            if (order) continue;

            // Attribution gate for auto-refund.
            let attributable = noteType === 'consumer_order';
            if (!attributable && p?.order_id) {
                try {
                    const rzpOrder: any = await rzp.orders.fetch(String(p.order_id));
                    attributable = typeof rzpOrder?.receipt === 'string' && rzpOrder.receipt.startsWith('PAS-');
                } catch { /* fetch failed — treat as unattributable */ }
            }

            if (!attributable) {
                console.warn(`[cron 7b sweep] unattributable captured payment with no order — manual review: ${p.id} ₹${Number(p.amount) / 100}`);
                try { Sentry.captureMessage('phase7b sweep: unattributable orphan payment — manual review', { level: 'warning', extra: { paymentId: p.id, amountInr: Number(p.amount) / 100, email: p.email, contact: p.contact } }); } catch {}
                continue;
            }

            // Attributable consumer orphan → refund in full.
            if (process.env.CRON_DRY_RUN === 'true') {
                console.warn(`[cron 7b sweep] DRY_RUN — would refund orphan ${p.id} ₹${Number(p.amount) / 100}`);
                continue;
            }
            const refund = await rzp.payments.refund(String(p.id), { amount: Number(p.amount) });
            console.error(`[cron 7b sweep][ORPHAN-REFUNDED] payment=${p.id} amount=₹${Number(p.amount) / 100} refund=${refund?.id}`);
            try { Sentry.captureMessage('phase7b sweep: orphan consumer payment auto-refunded', { level: 'warning', extra: { paymentId: p.id, amountInr: Number(p.amount) / 100, refundId: refund?.id } }); } catch {}
        } catch (err: any) {
            console.error(`[cron 7b sweep] error handling payment ${p?.id}:`, err?.message || err);
        }
    }
}
