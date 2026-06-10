/**
 * Phase 7C/7D (2026-06-10) — Settlement cycle-close engine + clawback detection.
 * Phase 7G (2026-06-11) — hardened after the adversarial audit (49 confirmed
 * findings; the blockers/highs are fixed here — see commit message).
 * Design: docs/phase7-settlement-architecture.html (Q1-Q7 + FQ defaults
 * approved by Pranav 2026-06-10).
 *
 * Core invariants:
 *  - LEDGER: a cycle freezes at close (OPEN → CLOSED → PAID, forward-only).
 *    Corrections are new entries (clawbacks claimed by the NEXT close), never
 *    edits to closed rows.
 *  - Each order settles exactly once as a SALE, and is coupon-reimbursed at
 *    most once — both enforced by partial unique indexes in the DATABASE.
 *  - Eligibility (Q3 + 7G): money-final statuses — COMPLETED, RETURN_REJECTED,
 *    EXCHANGE_APPROVED, EXCHANGE_REJECTED (exchanges never refund; the
 *    original payment stands), all requiring isPaid; plus RETURN_APPROVED with
 *    a PARTIAL refund (isPaid was flipped false by the refund — the kept
 *    remainder still settles, offset by a same-cycle CLAWBACK for the refunded
 *    amount, mirroring the post-settlement refund path exactly). All require
 *    paymentVerified === true and createdAt in [epoch, periodEnd).
 *  - Held orders (unverified, merchant missing profile/rule, or incoherent
 *    commission base) roll forward — picked up by a later close once resolved.
 *  - Commission (Q2/FQ-3/FQ-4): rate resolved per order from commission_rules
 *    (category + order-type + tier, most specific wins); base = items
 *    subtotal (pre-GST, pre-coupon).
 *  - Coupon reimbursement (Q4): PLATFORM-funded snapshot slices credited in
 *    the same cycle as their order's SALE line (and ONLY when this run's SALE
 *    insert actually landed — never alongside a skipDuplicates skip).
 *  - Clawbacks: claimed atomically (UPDATE … WHERE cycle_id IS NULL
 *    RETURNING), for EVERY merchant with pending lines — including merchants
 *    with zero new sales (they get a clawback-only, negative-net cycle).
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// Orders older than this never enter settlement (no settlement system existed
// before Phase 7; pre-epoch orders were reconciled manually).
// 7G fix: Mon 1 Jun 00:00 IST (= 2026-05-31T18:30Z), aligned with the first
// IST settlement week — the previous UTC-midnight value silently excluded
// orders from the first 5.5 hours of the epoch week.
export const PHASE7_EPOCH = new Date('2026-05-31T18:30:00.000Z');
const AMOUNT_EPSILON = 0.005;

// Money-final statuses that settle at full value with isPaid still true.
const SETTLE_STATUSES_PAID = ['COMPLETED', 'RETURN_REJECTED', 'EXCHANGE_APPROVED', 'EXCHANGE_REJECTED'];

/**
 * IST week bounds (Mon 00:00 IST inclusive → next Mon 00:00 IST exclusive)
 * for the week CONTAINING `date`. Stored values are UTC instants.
 */
export function getIstWeekBounds(date: Date): { periodStart: Date; periodEnd: Date } {
    const ist = new Date(date.getTime() + IST_OFFSET_MS);
    const day = ist.getUTCDay(); // 0=Sun..6=Sat in IST-shifted frame
    const daysSinceMonday = (day + 6) % 7;
    const istMidnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
    const periodStart = new Date(istMidnight - daysSinceMonday * 24 * 60 * 60 * 1000 - IST_OFFSET_MS);
    const periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { periodStart, periodEnd };
}

/** The most recent FULLY ELAPSED IST week (the default close target). */
export function getLastCompletedIstWeek(now: Date = new Date()): { periodStart: Date; periodEnd: Date } {
    const current = getIstWeekBounds(now);
    return {
        periodStart: new Date(current.periodStart.getTime() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: current.periodStart,
    };
}

type OrderTypeKey = 'PICKUP' | 'DINING';

function orderTypeKey(orderType: string | null | undefined): OrderTypeKey {
    return orderType === 'dine-in' || orderType === 'dining' ? 'DINING' : 'PICKUP';
}

/**
 * Resolve the commission rule for (category, orderType, tier).
 * Specificity: exact tier match > tier NULL (same orderType) > orderType ANY.
 * Rules with effective_from in the future are ignored. Ties on the same
 * specificity resolve to the most recently effective rule (deterministic).
 */
function resolveRule(
    rules: Array<{ id: string; category: string; orderType: string; tier: number | null; ratePct: Prisma.Decimal; effectiveFrom: Date }>,
    category: string,
    ot: OrderTypeKey,
    tier: number | null,
    asOf: Date,
) {
    const live = rules
        .filter((r) => r.category === category && r.effectiveFrom <= asOf)
        .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
    return (
        (tier != null ? live.find((r) => r.orderType === ot && r.tier === tier) : undefined) ??
        live.find((r) => r.orderType === ot && r.tier == null) ??
        live.find((r) => r.orderType === 'ANY' && r.tier == null) ??
        null
    );
}

export interface CloseCycleResult {
    periodStart: string;
    periodEnd: string;
    merchantsClosed: number;
    merchantsSkipped: number;
    ordersSettled: number;
    ordersHeldUnverified: number;
    ordersHeldNoProfile: number;
    ordersHeldIncoherent: number;
    clawbacksClaimed: number;
    failures: Array<{ merchantId: string; error: string }>;
    totals: { grossSales: number; commission: number; couponReimbursement: number; clawbacks: number; netPayout: number };
}

/**
 * Close the settlement cycle for one IST week (default: the last fully
 * elapsed week). Idempotent: merchants whose cycle for the period is already
 * CLOSED/PAID are skipped; the SALE + COUPON_REIMBURSEMENT partial-uniques
 * make re-settling structurally impossible even across overlapping
 * invocations. One merchant's failure never aborts the rest of the run.
 */
export async function closeSettlementCycles(
    prisma: PrismaClient,
    opts: { weekOf?: Date; closedBy?: string } = {},
): Promise<CloseCycleResult> {
    const { periodStart, periodEnd } = opts.weekOf
        ? getIstWeekBounds(opts.weekOf)
        : getLastCompletedIstWeek();

    if (periodEnd.getTime() > Date.now()) {
        throw new Error(`Cannot close a week that has not ended yet (period ends ${periodEnd.toISOString()})`);
    }
    if (periodEnd.getTime() <= PHASE7_EPOCH.getTime()) {
        throw new Error(`Cannot close a week before the settlement epoch (${PHASE7_EPOCH.toISOString()})`);
    }

    // Roll-forward eligibility: anything settle-ready created before this
    // period's end (and after the Phase-7 epoch) that has no SALE line yet —
    // late-verified or late-completed orders from earlier weeks are swept in.
    // 7G: RETURN_APPROVED is included WITHOUT the isPaid requirement (the
    // partial-refund flow flips isPaid false); full returns are filtered out
    // below once refund sums are known.
    const candidates = await prisma.order.findMany({
        where: {
            createdAt: { gte: PHASE7_EPOCH, lt: periodEnd },
            OR: [
                { isPaid: true, status: { in: SETTLE_STATUSES_PAID as any } },
                { status: 'RETURN_APPROVED' as any },
            ],
        },
        select: {
            id: true, storeId: true, totalAmount: true, createdAt: true, status: true,
            paymentVerified: true,
            orderCouponDiscount: true, orderCouponFundingSource: true,
            metadata: true,
            items: { select: { price: true, quantity: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    // Exclude already-settled orders up front (cheaper than relying purely on
    // the unique index).
    const settled = candidates.length > 0 ? await prisma.settlementLine.findMany({
        where: { kind: 'SALE', orderId: { in: candidates.map((o) => o.id) } },
        select: { orderId: true },
    }) : [];
    const settledSet = new Set(settled.map((s) => s.orderId));
    const unsettled = candidates.filter((o) => !settledSet.has(o.id));

    const verified = unsettled.filter((o) => o.paymentVerified === true);

    // 7G: per-merchant held attribution (the cycle row's heldOrderCount was
    // previously hardcoded 0, blanking every held-order UI).
    const heldByMerchant = new Map<string, number>();
    const holdOne = (merchantId: string) => heldByMerchant.set(merchantId, (heldByMerchant.get(merchantId) ?? 0) + 1);
    for (const o of unsettled) {
        if (o.paymentVerified !== true) holdOne(o.storeId);
    }
    const heldUnverified = unsettled.length - verified.length;

    // Order types come from the orders table directly (order_type is not in
    // the Prisma select shape above because it is mapped via raw column on
    // some deployments) — fetch in one raw query keyed by id.
    const typeRows = verified.length > 0
        ? await prisma.$queryRaw<Array<{ id: string; order_type: string | null }>>`
            SELECT "id"::text AS id, "order_type" FROM "public"."orders"
            WHERE "id" = ANY(${verified.map((o) => o.id)}::uuid[]);`
        : [];
    const typeById = new Map(typeRows.map((r) => [r.id, r.order_type]));

    const rules = await prisma.commissionRule.findMany({
        select: { id: true, category: true, orderType: true, tier: true, ratePct: true, effectiveFrom: true },
    });

    const byMerchant = new Map<string, typeof verified>();
    for (const o of verified) {
        const arr = byMerchant.get(o.storeId) ?? [];
        arr.push(o);
        byMerchant.set(o.storeId, arr);
    }

    // 7G: merchants with pending (cycle-less) clawbacks MUST be processed even
    // with zero new sales this period — otherwise a churned/quiet merchant's
    // refund debt floats unclaimed forever. They get a clawback-only cycle.
    const pendingClawMerchants = await prisma.$queryRaw<Array<{ store_id: string }>>`
        SELECT DISTINCT o."store_id"::text AS store_id
        FROM "public"."settlement_lines" sl
        JOIN "public"."orders" o ON o."id" = sl."order_id"
        WHERE sl."kind" = 'CLAWBACK' AND sl."cycle_id" IS NULL;`;
    const pendingClawSet = new Set(pendingClawMerchants.map((r) => r.store_id));
    for (const sid of pendingClawSet) {
        if (!byMerchant.has(sid)) byMerchant.set(sid, []);
    }

    const merchantIds = Array.from(byMerchant.keys());
    const profiles = merchantIds.length > 0 ? await prisma.merchantSettlementProfile.findMany({
        where: { id: { in: merchantIds } },
    }) : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const result: CloseCycleResult = {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        merchantsClosed: 0,
        merchantsSkipped: 0,
        ordersSettled: 0,
        ordersHeldUnverified: heldUnverified,
        ordersHeldNoProfile: 0,
        ordersHeldIncoherent: 0,
        clawbacksClaimed: 0,
        failures: [],
        totals: { grossSales: 0, commission: 0, couponReimbursement: 0, clawbacks: 0, netPayout: 0 },
    };

    for (const [merchantId, orders] of byMerchant) {
        const profile = profileById.get(merchantId);
        const hasPendingClaw = pendingClawSet.has(merchantId);
        if ((!profile || !profile.commissionCategory) && !hasPendingClaw) {
            // Fail-closed on OUR revenue: without a commission category we
            // cannot compute the fee, so the merchant's orders are HELD (they
            // roll into a later close once the admin assigns a profile).
            // Merchants with pending clawbacks proceed regardless — claiming a
            // clawback needs no commission math.
            result.ordersHeldNoProfile += orders.length;
            for (const o of orders) holdOne(merchantId);
            try { Sentry.captureMessage('phase7c: merchant held — no settlement profile/category', { level: 'warning', extra: { merchantId, orders: orders.length } }); } catch {}
            continue;
        }
        const canCommission = !!(profile && profile.commissionCategory);

        // Idempotency at the cycle level.
        const existing = await prisma.settlementCycle.findUnique({
            where: { merchantId_periodStart: { merchantId, periodStart } },
            select: { id: true, status: true },
        });
        if (existing && existing.status !== 'OPEN') {
            result.merchantsSkipped += 1;
            continue;
        }

        // 7G: one merchant's failure must not abort the rest of the close.
        try {
        await prisma.$transaction(async (tx) => {
            const cycle = existing
                ? await tx.settlementCycle.findUniqueOrThrow({ where: { id: existing.id } })
                : await tx.settlementCycle.create({
                    data: { merchantId, periodStart, periodEnd, status: 'OPEN' },
                });

            // 7G: revalidate eligibility INSIDE the transaction — a refund or
            // cancel landing between the candidate scan and this point must
            // not settle at full value with no clawback (detectClawback sees
            // no SALE yet and records nothing for pre-settlement refunds).
            const freshById = orders.length > 0 ? new Map(
                (await tx.order.findMany({
                    where: { id: { in: orders.map((o) => o.id) } },
                    select: { id: true, status: true, isPaid: true },
                })).map((f) => [f.id, f]),
            ) : new Map();
            // 7G: refund sums for RETURN_APPROVED orders, read in-tx for
            // consistency with the SALE lines committed below.
            const returnApprovedIds = orders
                .filter((o) => freshById.get(o.id)?.status === 'RETURN_APPROVED')
                .map((o) => o.id);
            const refundRows = returnApprovedIds.length > 0 ? await tx.orderIssue.groupBy({
                by: ['orderId'],
                where: { orderId: { in: returnApprovedIds }, type: 'return', status: { in: ['APPROVED', 'AUTO_APPROVED'] } },
                _sum: { refundAmountInr: true },
            }) : [];
            const refundedByOrder = new Map(refundRows.map((r) => [r.orderId, Number(r._sum.refundAmountInr ?? 0)]));

            let absorbed = 0;

            const saleLines: Prisma.SettlementLineCreateManyInput[] = [];
            const couponByOrder = new Map<string, Prisma.SettlementLineCreateManyInput>();
            const offsetByOrder = new Map<string, Prisma.SettlementLineCreateManyInput>();

            for (const o of orders) {
                const fresh = freshById.get(o.id);
                const freshStatus = fresh?.status ?? o.status;
                const stillEligible =
                    (SETTLE_STATUSES_PAID.includes(freshStatus) && fresh?.isPaid === true) ||
                    freshStatus === 'RETURN_APPROVED';
                if (!stillEligible) {
                    // Changed mid-close (refund/cancel/return) — drop; it
                    // re-evaluates under its new status at the next close.
                    try { Sentry.captureMessage('phase7c: order dropped mid-close — status changed', { level: 'warning', extra: { merchantId, orderId: o.id, was: o.status, now: freshStatus } }); } catch {}
                    continue;
                }
                const total = Number(o.totalAmount) || 0;
                let preRefund = 0;
                if (freshStatus === 'RETURN_APPROVED') {
                    preRefund = refundedByOrder.get(o.id) ?? 0;
                    if (preRefund >= total - AMOUNT_EPSILON) {
                        // Full return — correctly excluded from settlement (Q3).
                        continue;
                    }
                    if (preRefund <= AMOUNT_EPSILON) {
                        // RETURN_APPROVED with no recorded refund — anomalous;
                        // hold rather than guess.
                        holdOne(merchantId); result.ordersHeldIncoherent += 1;
                        try { Sentry.captureMessage('phase7c: RETURN_APPROVED without refund record — HELD', { level: 'warning', extra: { merchantId, orderId: o.id } }); } catch {}
                        continue;
                    }
                }

                if (!canCommission) {
                    // Clawback-only pass for a no-profile merchant: its sales
                    // still hold (counted once, in the loop below).
                    result.ordersHeldNoProfile += 1;
                    holdOne(merchantId);
                    continue;
                }

                const ot = orderTypeKey(typeById.get(o.id));
                const rule = resolveRule(rules, profile!.commissionCategory!, ot, profile!.turnoverTier ?? null, o.createdAt);
                if (!rule) {
                    // No matching rule (e.g. category renamed) — hold this order.
                    result.ordersHeldNoProfile += 1;
                    holdOne(merchantId);
                    try { Sentry.captureMessage('phase7c: order held — no commission rule match', { level: 'warning', extra: { merchantId, orderId: o.id, category: profile!.commissionCategory, ot } }); } catch {}
                    continue;
                }
                // FQ-4 (approved default): base = items subtotal, pre-GST, pre-coupon.
                const base = o.items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
                const coupon = o.orderCouponDiscount != null ? Number(o.orderCouponDiscount) : 0;
                // 7G: item prices are client-supplied at order create and never
                // validated against the catalog. Coherence guard (fail-closed on
                // platform revenue): base must sit within what the customer's
                // verified payment implies. total = base + GST − coupon, so
                // base ≤ total + coupon always; base ≪ that bound means zeroed
                // item prices (commission evasion). 0.5× floor stays far below
                // any legitimate GST effect (max 28% ⇒ base ≥ 0.78×).
                const impliedCeiling = total + coupon;
                if (base > impliedCeiling + 2 || base < impliedCeiling * 0.5 - 2) {
                    result.ordersHeldIncoherent += 1;
                    holdOne(merchantId);
                    try { Sentry.captureMessage('phase7c: order held — incoherent commission base vs paid total', { level: 'warning', extra: { merchantId, orderId: o.id, base, total, coupon } }); } catch {}
                    continue;
                }
                const rate = Number(rule.ratePct);
                const fee = Math.round(base * rate) / 100; // base * rate% to paise

                saleLines.push({
                    cycleId: cycle.id,
                    orderId: o.id,
                    kind: 'SALE',
                    amount: total,
                    commissionRatePct: rate,
                    commissionRuleId: rule.id,
                    commissionBase: Math.round(base * 100) / 100,
                    commissionAmount: fee,
                    note: `base ₹${base.toFixed(2)} @ ${rate}% (${ot}) = ₹${fee.toFixed(2)}`,
                });

                if (coupon > AMOUNT_EPSILON) {
                    if (o.orderCouponFundingSource === 'PLATFORM') {
                        couponByOrder.set(o.id, {
                            cycleId: cycle.id,
                            orderId: o.id,
                            kind: 'COUPON_REIMBURSEMENT',
                            amount: coupon,
                            note: 'platform-funded coupon slice',
                        });
                    } else if (o.orderCouponFundingSource === 'MERCHANT') {
                        absorbed += coupon;
                    }
                }
                if (preRefund > AMOUNT_EPSILON) {
                    // Pre-settlement partial return: same-cycle offset, making
                    // the merchant's outcome identical to the post-settlement
                    // refund ordering (SALE at full + CLAWBACK at refund).
                    offsetByOrder.set(o.id, {
                        cycleId: cycle.id,
                        orderId: o.id,
                        kind: 'CLAWBACK',
                        amount: Math.round(preRefund * 100) / 100,
                        note: 'pre-settlement partial return refund',
                    });
                }
            }

            // SALE lines: skipDuplicates + the partial unique index make
            // double-settlement structurally impossible.
            let settledCount = 0;
            if (saleLines.length > 0) {
                const created = await tx.settlementLine.createMany({ data: saleLines, skipDuplicates: true });
                settledCount = created.count;
                if (created.count !== saleLines.length) {
                    try { Sentry.captureMessage('phase7c: concurrent SALE insert detected — totals recomputed from lines', { level: 'warning', extra: { merchantId, attempted: saleLines.length, created: created.count } }); } catch {}
                }
            }
            // 7G: coupon + offset lines ONLY for orders whose SALE actually
            // landed in THIS cycle — a skipDuplicates skip (concurrent close
            // won the order) must not leave its companion lines behind. The
            // COUPON_REIMBURSEMENT partial unique + skipDuplicates is the DB
            // backstop for the same race.
            if (couponByOrder.size > 0 || offsetByOrder.size > 0) {
                const landed = await tx.settlementLine.findMany({
                    where: { cycleId: cycle.id, kind: 'SALE' },
                    select: { orderId: true },
                });
                const landedSet = new Set(landed.map((l) => l.orderId));
                const couponLines = Array.from(couponByOrder.entries())
                    .filter(([oid]) => landedSet.has(oid)).map(([, l]) => l);
                const offsetLines = Array.from(offsetByOrder.entries())
                    .filter(([oid]) => landedSet.has(oid)).map(([, l]) => l);
                if (couponLines.length > 0) {
                    await tx.settlementLine.createMany({ data: couponLines, skipDuplicates: true });
                }
                if (offsetLines.length > 0) {
                    await tx.settlementLine.createMany({ data: offsetLines });
                }
            }

            // 7D/7G: claim pending clawbacks atomically. The cycle_id IS NULL
            // predicate is re-evaluated under the row lock, so a concurrent
            // close claims zero rows — never the same clawback twice.
            const claimed = await tx.$queryRaw<Array<{ id: string }>>`
                UPDATE "public"."settlement_lines" sl
                SET "cycle_id" = ${cycle.id}::uuid
                FROM "public"."orders" o
                WHERE o."id" = sl."order_id"
                  AND sl."kind" = 'CLAWBACK'
                  AND sl."cycle_id" IS NULL
                  AND o."store_id" = ${merchantId}::uuid
                RETURNING sl."id"::text AS id;`;
            result.clawbacksClaimed += claimed.length;

            // Recompute frozen totals from the ACTUAL lines (authoritative even
            // under concurrent closes) — commission facts come from the new
            // per-line columns, never from parsing notes.
            const saleAgg = await tx.settlementLine.aggregate({
                where: { cycleId: cycle.id, kind: 'SALE' },
                _sum: { amount: true, commissionBase: true, commissionAmount: true },
            });
            const lineAgg = await tx.settlementLine.groupBy({
                by: ['kind'],
                where: { cycleId: cycle.id },
                _sum: { amount: true },
            });
            const sumOf = (k: string) => Number(lineAgg.find((a) => a.kind === k)?._sum.amount ?? 0);
            const grossFinal = sumOf('SALE');
            const reimbFinal = sumOf('COUPON_REIMBURSEMENT');
            const clawFinal = sumOf('CLAWBACK');
            const commissionFinal = Number(saleAgg._sum.commissionAmount ?? 0);
            const baseFinal = Number(saleAgg._sum.commissionBase ?? 0);

            const net = Math.round((grossFinal - commissionFinal + reimbFinal - clawFinal) * 100) / 100;

            await tx.settlementCycle.update({
                where: { id: cycle.id },
                data: {
                    grossSales: Math.round(grossFinal * 100) / 100,
                    commissionBase: Math.round(baseFinal * 100) / 100,
                    commissionAmount: Math.round(commissionFinal * 100) / 100,
                    couponReimbursement: Math.round(reimbFinal * 100) / 100,
                    couponAbsorbed: Math.round(absorbed * 100) / 100,
                    clawbackAmount: Math.round(clawFinal * 100) / 100,
                    netPayout: net,
                    heldOrderCount: heldByMerchant.get(merchantId) ?? 0,
                    status: 'CLOSED',
                    closedAt: new Date(),
                },
            });

            result.merchantsClosed += 1;
            result.ordersSettled += settledCount;
            result.totals.grossSales += grossFinal;
            result.totals.commission += commissionFinal;
            result.totals.couponReimbursement += reimbFinal;
            result.totals.clawbacks += clawFinal;
            result.totals.netPayout += net;
        }, { timeout: 30000, maxWait: 10000 });
        } catch (err: any) {
            if (err?.code === 'P2002') {
                // Concurrent close created this merchant's cycle first — it
                // owns the period; count as skipped, not failed.
                result.merchantsSkipped += 1;
                continue;
            }
            const msg = String(err?.message || err).slice(0, 300);
            result.failures.push({ merchantId, error: msg });
            try { Sentry.captureException(err, { tags: { area: 'phase7c.closeMerchant' }, extra: { merchantId, periodStart: periodStart.toISOString() } }); } catch {}
            console.error(`[settlement] merchant ${merchantId} close FAILED (continuing): ${msg}`);
        }
    }

    console.log(`[settlement] close ${periodStart.toISOString().slice(0, 10)}→${periodEnd.toISOString().slice(0, 10)}: ${result.merchantsClosed} merchants, ${result.ordersSettled} orders, held ${result.ordersHeldUnverified} unverified + ${result.ordersHeldNoProfile} no-profile + ${result.ordersHeldIncoherent} incoherent, ${result.failures.length} failures, net ₹${result.totals.netPayout.toFixed(2)}`);
    return result;
}

/**
 * 7D — clawback detection. Call whenever money returns to a customer for an
 * order (cancel with refund, return refund, SLA auto-refund, legacy refund).
 * If the order has ALREADY been settled (SALE line in a CLOSED/PAID cycle), a
 * cycle-less CLAWBACK line is recorded and claimed by the next close. If the
 * order was never settled, nothing to do — it simply never settles (status
 * excludes it). Idempotent per (orderId, note) via an existence check.
 */
export async function detectClawback(
    prisma: PrismaClient,
    orderId: string,
    amountInr: number,
    note: string,
): Promise<boolean> {
    if (!(amountInr > AMOUNT_EPSILON)) return false;
    const sale = await prisma.settlementLine.findFirst({
        where: { kind: 'SALE', orderId },
        select: { id: true, cycle: { select: { status: true } } },
    });
    if (!sale || !sale.cycle || sale.cycle.status === 'OPEN') return false;

    const dup = await prisma.settlementLine.findFirst({
        where: { kind: 'CLAWBACK', orderId, note },
        select: { id: true },
    });
    if (dup) return false;

    await prisma.settlementLine.create({
        data: { cycleId: null, orderId, kind: 'CLAWBACK', amount: Math.round(amountInr * 100) / 100, note },
    });
    try { Sentry.captureMessage('phase7d: clawback recorded for settled order', { level: 'info', extra: { orderId, amountInr, note } }); } catch {}
    return true;
}
