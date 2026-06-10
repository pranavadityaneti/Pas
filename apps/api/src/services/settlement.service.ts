/**
 * Phase 7C/7D (2026-06-10) — Settlement cycle-close engine + clawback detection.
 * Design: docs/phase7-settlement-architecture.html (Q1-Q7 + FQ defaults
 * approved by Pranav 2026-06-10).
 *
 * Core invariants:
 *  - LEDGER: a cycle freezes at close (OPEN → CLOSED → PAID, forward-only).
 *    Corrections are new entries (clawbacks claimed by the NEXT close), never
 *    edits to closed rows.
 *  - Each order settles exactly once as a SALE — enforced by the partial
 *    unique index settlement_line_sale_order_unique_idx in the DATABASE, with
 *    skipDuplicates as the application-level mirror.
 *  - Eligibility (Q3 + Q7): status COMPLETED or RETURN_REJECTED, isPaid,
 *    paymentVerified === true, created before the closing period's end and
 *    after the Phase-7 epoch, and not already settled. Held orders (verified
 *    false/null, or merchant missing a commission profile) roll forward —
 *    they are picked up automatically by a later close once resolved.
 *  - Commission (Q2/FQ-3/FQ-4): rate resolved per order from commission_rules
 *    (category + order-type + tier, most specific wins); base = items
 *    subtotal (pre-GST, pre-coupon).
 *  - Coupon reimbursement (Q4): PLATFORM-funded snapshot slices credited in
 *    the same cycle as their order's SALE line.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// Orders older than this never enter settlement (no settlement system existed
// before Phase 7; pre-epoch orders were reconciled manually).
const PHASE7_EPOCH = new Date('2026-06-01T00:00:00.000Z');
const AMOUNT_EPSILON = 0.005;

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
 * Rules with effective_from in the future are ignored.
 */
function resolveRule(
    rules: Array<{ id: string; category: string; orderType: string; tier: number | null; ratePct: Prisma.Decimal; effectiveFrom: Date }>,
    category: string,
    ot: OrderTypeKey,
    tier: number | null,
    asOf: Date,
) {
    const live = rules.filter((r) => r.category === category && r.effectiveFrom <= asOf);
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
    clawbacksClaimed: number;
    totals: { grossSales: number; commission: number; couponReimbursement: number; clawbacks: number; netPayout: number };
}

/**
 * Close the settlement cycle for one IST week (default: the last fully
 * elapsed week). Idempotent: merchants whose cycle for the period is already
 * CLOSED/PAID are skipped; the SALE partial-unique makes re-settling an order
 * structurally impossible even across overlapping invocations.
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

    // Roll-forward eligibility: anything settle-ready created before this
    // period's end (and after the Phase-7 epoch) that has no SALE line yet —
    // late-verified or late-completed orders from earlier weeks are swept in.
    const candidates = await prisma.order.findMany({
        where: {
            createdAt: { gte: PHASE7_EPOCH, lt: periodEnd },
            isPaid: true,
            status: { in: ['COMPLETED', 'RETURN_REJECTED'] as any },
        },
        select: {
            id: true, storeId: true, totalAmount: true, createdAt: true,
            paymentVerified: true,
            orderCouponDiscount: true, orderCouponFundingSource: true,
            metadata: true,
            items: { select: { price: true, quantity: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    // Exclude already-settled orders up front (cheaper than relying purely on
    // the unique index).
    const settled = await prisma.settlementLine.findMany({
        where: { kind: 'SALE', orderId: { in: candidates.map((o) => o.id) } },
        select: { orderId: true },
    });
    const settledSet = new Set(settled.map((s) => s.orderId));
    const unsettled = candidates.filter((o) => !settledSet.has(o.id));

    const verified = unsettled.filter((o) => o.paymentVerified === true);
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

    const merchantIds = Array.from(new Set(verified.map((o) => o.storeId)));
    const profiles = await prisma.merchantSettlementProfile.findMany({
        where: { id: { in: merchantIds } },
    });
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const byMerchant = new Map<string, typeof verified>();
    for (const o of verified) {
        const arr = byMerchant.get(o.storeId) ?? [];
        arr.push(o);
        byMerchant.set(o.storeId, arr);
    }

    const result: CloseCycleResult = {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        merchantsClosed: 0,
        merchantsSkipped: 0,
        ordersSettled: 0,
        ordersHeldUnverified: heldUnverified,
        ordersHeldNoProfile: 0,
        clawbacksClaimed: 0,
        totals: { grossSales: 0, commission: 0, couponReimbursement: 0, clawbacks: 0, netPayout: 0 },
    };

    for (const [merchantId, orders] of byMerchant) {
        const profile = profileById.get(merchantId);
        if (!profile || !profile.commissionCategory) {
            // Fail-closed on OUR revenue: without a commission category we
            // cannot compute the fee, so the merchant's orders are HELD (they
            // roll into a later close once the admin assigns a profile).
            result.ordersHeldNoProfile += orders.length;
            try { Sentry.captureMessage('phase7c: merchant held — no settlement profile/category', { level: 'warning', extra: { merchantId, orders: orders.length } }); } catch {}
            continue;
        }

        // Idempotency at the cycle level.
        const existing = await prisma.settlementCycle.findUnique({
            where: { merchantId_periodStart: { merchantId, periodStart } },
            select: { id: true, status: true },
        });
        if (existing && existing.status !== 'OPEN') {
            result.merchantsSkipped += 1;
            continue;
        }

        await prisma.$transaction(async (tx) => {
            const cycle = existing
                ? await tx.settlementCycle.findUniqueOrThrow({ where: { id: existing.id } })
                : await tx.settlementCycle.create({
                    data: { merchantId, periodStart, periodEnd, status: 'OPEN' },
                });

            let gross = 0;
            let commissionBase = 0;
            let commission = 0;
            let reimbursement = 0;
            let absorbed = 0;

            const saleLines: Prisma.SettlementLineCreateManyInput[] = [];
            const otherLines: Prisma.SettlementLineCreateManyInput[] = [];

            for (const o of orders) {
                const ot = orderTypeKey(typeById.get(o.id));
                const rule = resolveRule(rules, profile.commissionCategory!, ot, profile.turnoverTier ?? null, o.createdAt);
                if (!rule) {
                    // No matching rule (e.g. category renamed) — hold this order.
                    result.ordersHeldNoProfile += 1;
                    try { Sentry.captureMessage('phase7c: order held — no commission rule match', { level: 'warning', extra: { merchantId, orderId: o.id, category: profile.commissionCategory, ot } }); } catch {}
                    continue;
                }
                // FQ-4 (approved default): base = items subtotal, pre-GST, pre-coupon.
                const base = o.items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
                const rate = Number(rule.ratePct);
                const fee = Math.round(base * rate) / 100; // base * rate% to paise

                gross += Number(o.totalAmount) || 0;
                commissionBase += base;
                commission += fee;

                saleLines.push({
                    cycleId: cycle.id,
                    orderId: o.id,
                    kind: 'SALE',
                    amount: Number(o.totalAmount) || 0,
                    commissionRatePct: rate,
                    commissionRuleId: rule.id,
                    note: `base ₹${base.toFixed(2)} @ ${rate}% (${ot}) = ₹${fee.toFixed(2)}`,
                });

                const slice = o.orderCouponDiscount != null ? Number(o.orderCouponDiscount) : 0;
                if (slice > AMOUNT_EPSILON) {
                    if (o.orderCouponFundingSource === 'PLATFORM') {
                        reimbursement += slice;
                        otherLines.push({
                            cycleId: cycle.id,
                            orderId: o.id,
                            kind: 'COUPON_REIMBURSEMENT',
                            amount: slice,
                            note: 'platform-funded coupon slice',
                        });
                    } else if (o.orderCouponFundingSource === 'MERCHANT') {
                        absorbed += slice;
                    }
                }
            }

            // SALE lines: skipDuplicates + the partial unique index make
            // double-settlement structurally impossible.
            let settledCount = 0;
            if (saleLines.length > 0) {
                const created = await tx.settlementLine.createMany({ data: saleLines, skipDuplicates: true });
                settledCount = created.count;
                if (created.count !== saleLines.length) {
                    // A concurrent close grabbed some orders — recompute totals from
                    // the DB to keep the frozen numbers exact.
                    try { Sentry.captureMessage('phase7c: concurrent SALE insert detected — totals recomputed from lines', { level: 'warning', extra: { merchantId, attempted: saleLines.length, created: created.count } }); } catch {}
                }
            }
            if (otherLines.length > 0) {
                await tx.settlementLine.createMany({ data: otherLines });
            }

            // 7D: claim pending clawbacks (cycle-less CLAWBACK lines whose order
            // belongs to this merchant).
            const pendingClaw = await tx.$queryRaw<Array<{ id: string; amount: Prisma.Decimal }>>`
                SELECT sl."id"::text AS id, sl."amount"
                FROM "public"."settlement_lines" sl
                JOIN "public"."orders" o ON o."id" = sl."order_id"
                WHERE sl."kind" = 'CLAWBACK' AND sl."cycle_id" IS NULL AND o."store_id" = ${merchantId}::uuid;`;
            let clawTotal = 0;
            if (pendingClaw.length > 0) {
                await tx.settlementLine.updateMany({
                    where: { id: { in: pendingClaw.map((c) => c.id) } },
                    data: { cycleId: cycle.id },
                });
                clawTotal = pendingClaw.reduce((s, c) => s + Number(c.amount), 0);
                result.clawbacksClaimed += pendingClaw.length;
            }

            // Recompute frozen totals from the ACTUAL lines (authoritative even
            // under concurrent closes).
            const lineAgg = await tx.settlementLine.groupBy({
                by: ['kind'],
                where: { cycleId: cycle.id },
                _sum: { amount: true },
                _count: { _all: true },
            });
            const sumOf = (k: string) => Number(lineAgg.find((a) => a.kind === k)?._sum.amount ?? 0);
            const grossFinal = sumOf('SALE');
            const reimbFinal = sumOf('COUPON_REIMBURSEMENT');
            const clawFinal = sumOf('CLAWBACK');
            // commission/base recomputed proportionally only when concurrency
            // trimmed lines; in the normal path these equal the loop values.
            const saleCount = Number(lineAgg.find((a) => a.kind === 'SALE')?._count._all ?? 0);
            const commissionFinal = saleCount === saleLines.length ? commission : await (async () => {
                const ls = await tx.settlementLine.findMany({ where: { cycleId: cycle.id, kind: 'SALE' }, select: { note: true } });
                return ls.reduce((s, l) => {
                    const m = /= ₹([0-9.]+)$/.exec(l.note || '');
                    return s + (m ? Number(m[1]) : 0);
                }, 0);
            })();
            const baseFinal = saleCount === saleLines.length ? commissionBase : 0;

            const net = Math.round((grossFinal - commissionFinal + reimbFinal - clawFinal) * 100) / 100;

            await tx.settlementCycle.update({
                where: { id: cycle.id },
                data: {
                    grossSales: grossFinal,
                    commissionBase: baseFinal,
                    commissionAmount: Math.round(commissionFinal * 100) / 100,
                    couponReimbursement: Math.round(reimbFinal * 100) / 100,
                    couponAbsorbed: Math.round(absorbed * 100) / 100,
                    clawbackAmount: Math.round(clawFinal * 100) / 100,
                    netPayout: net,
                    heldOrderCount: 0,
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
        });
    }

    console.log(`[settlement] close ${periodStart.toISOString().slice(0, 10)}→${periodEnd.toISOString().slice(0, 10)}: ${result.merchantsClosed} merchants, ${result.ordersSettled} orders, held ${result.ordersHeldUnverified} unverified + ${result.ordersHeldNoProfile} no-profile, net ₹${result.totals.netPayout.toFixed(2)}`);
    return result;
}

/**
 * 7D — clawback detection. Call whenever money returns to a customer for an
 * order (cancel with refund, return refund, SLA auto-refund). If the order
 * has ALREADY been settled (SALE line in a CLOSED/PAID cycle), a cycle-less
 * CLAWBACK line is recorded and claimed by the next close. If the order was
 * never settled, nothing to do — it simply never settles (status excludes it).
 * Idempotent per (orderId, note) via an existence check.
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
