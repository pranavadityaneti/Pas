/**
 * Order lifecycle — rules engine (WS2.B).
 *
 * 2026-06-05: Pure-function policy module backing the Cancel / Reschedule /
 * Return / Exchange flows in WS2. No DB access, no network, no I/O — every
 * function takes plain JS inputs and returns a structured decision. Endpoints
 * in WS2.C call these to make policy decisions; the customer and merchant
 * apps render the `reason` strings verbatim.
 *
 * Policy source: docs/june8-sprint-plan.md (WS2 section, locked rules):
 *   - Pickup late-cancel = no-show: 5% / max ₹50 fee. Auto-refund (full)
 *     if cancelled within 5 minutes of order creation AND store is open.
 *   - Dining late-cancel / no-show: no refund.
 *   - Takeaway-convert until prepared: ready-to-pickup orders cannot cancel
 *     but the merchant can convert to takeaway in-store.
 *   - Return window: 24h from order completion (i.e., merchant marked
 *     COMPLETED after pickup).
 *   - Refund-without-return: missing / wrong / damaged / quality reasons
 *     don't require physical return.
 *   - Opened perishable / prepared / intimate items: non-returnable
 *     (enforced via Product.returnable flag, set per-product by ops).
 *   - Exchange: single-step within 24h, no fee, changed-mind qualifies.
 *   - Reschedule cutoff: 45 min before the slot (dining). Merchant-defined
 *     peak-hour surcharge — TBD how merchants will configure it; default
 *     zero in v0.
 *   - SLA (merchant decision): 24h. Cron auto-approves after.
 */

// ───────────────────────────── Types ───────────────────────────────────

export type OrderTypeKind = 'pickup' | 'dining' | 'takeaway' | 'delivery';

/**
 * Subset of OrderStatus enum values relevant to lifecycle decisions. Kept as
 * a string union (not the Prisma enum) so this module stays import-free of
 * the generated client — important for portability + future test runners.
 */
export type OrderStatusLite =
    | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED'
    | 'CANCELLED' | 'REFUNDED'
    | 'RETURN_REQUESTED' | 'RETURN_APPROVED' | 'RETURN_REJECTED'
    | 'EXCHANGE_REQUESTED' | 'EXCHANGE_APPROVED' | 'EXCHANGE_REJECTED';

export type IssueType = 'return' | 'exchange' | 'cancel_dispute';

/** Customer-visible decision shape — every evaluator returns one of these. */
export type Decision<T = {}> =
    | ({ allowed: true; reason: string } & T)
    | { allowed: false; reason: string };

// ────────────────────────── Locked constants ───────────────────────────

/** Pickup late-cancel fee: 5% of order total, capped at ₹50. */
export const PICKUP_CANCEL_FEE_PCT = 0.05;
export const PICKUP_CANCEL_FEE_CAP_INR = 50;

/** Full-refund window: cancel within N minutes of order creation → no fee. */
export const AUTO_REFUND_WINDOW_MIN = 5;

/** Reschedule cutoff: dining slots can't be moved within this window of slot start. */
export const RESCHEDULE_CUTOFF_MIN_DINING = 45;

/** Return window: 24 hours from order COMPLETED timestamp. */
export const RETURN_WINDOW_HOURS = 24;

/** Exchange window: 24 hours from order COMPLETED timestamp. Single-step. */
export const EXCHANGE_WINDOW_HOURS = 24;

/** Merchant SLA: 24 hours to decide an issue before cron auto-approves. */
export const ISSUE_SLA_HOURS = 24;

// ────────────────────────── Reason codes ───────────────────────────────

/**
 * Frontend picklist + downstream analytics. Each issue type has its own
 * reason set. Codes are stored verbatim in order_issues.reason; labels
 * are rendered by the apps (mapped client-side).
 */
export const RETURN_REASONS = [
    'missing_item',
    'wrong_item',
    'damaged',
    'quality_issue',
    'expired',
    'changed_mind',
] as const;

export const EXCHANGE_REASONS = [
    'wrong_size',
    'wrong_color',
    'wrong_variant',
    'changed_mind',
    'defective',
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];
export type ExchangeReason = (typeof EXCHANGE_REASONS)[number];

/**
 * Reasons that bypass the physical return step — the customer gets the
 * refund without shipping/dropping anything back. Merchant either trusts
 * the photos or absorbs the loss.
 */
const REFUND_WITHOUT_RETURN_REASONS = new Set<ReturnReason>([
    'missing_item',
    'wrong_item',
    'damaged',
    'quality_issue',
]);

// ────────────────────────────── Helpers ────────────────────────────────

const HOUR_MS = 3600_000;
const MIN_MS = 60_000;

function minutesBetween(from: Date, to: Date): number {
    return (to.getTime() - from.getTime()) / MIN_MS;
}

function hoursBetween(from: Date, to: Date): number {
    return (to.getTime() - from.getTime()) / HOUR_MS;
}

function clampNonNegative(n: number): number {
    return n < 0 ? 0 : n;
}

// ─────────────────────────── Cancel policy ─────────────────────────────

export interface CancelInput {
    orderType: OrderTypeKind;
    orderStatus: OrderStatusLite;
    orderTotalInr: number;
    isPaid: boolean;
    createdAt: Date;
    /** Slot time for pickup/dining. Null for takeaway/delivery. */
    slotTimeAt: Date | null;
    /** When the customer pressed Cancel. */
    requestedAt: Date;
}

export interface CancelOutcome {
    /** Cancellation fee charged. 0 if free. */
    feeInr: number;
    /** Amount refunded to the customer. 0 if no refund (e.g., unpaid, or dining no-refund). */
    refundInr: number;
    /** True if cancel landed inside the AUTO_REFUND_WINDOW. UI can show "full refund issued". */
    autoRefundEligible: boolean;
}

export function evaluateCancel(input: CancelInput): Decision<CancelOutcome> {
    const { orderType, orderStatus, orderTotalInr, isPaid, createdAt, requestedAt } = input;

    // Terminal states — nothing to cancel.
    if (orderStatus === 'COMPLETED' || orderStatus === 'CANCELLED' || orderStatus === 'REFUNDED') {
        return { allowed: false, reason: 'This order has already been completed, cancelled, or refunded.' };
    }
    if (orderStatus === 'RETURN_REQUESTED' || orderStatus === 'RETURN_APPROVED' || orderStatus === 'RETURN_REJECTED'
        || orderStatus === 'EXCHANGE_REQUESTED' || orderStatus === 'EXCHANGE_APPROVED' || orderStatus === 'EXCHANGE_REJECTED') {
        return { allowed: false, reason: 'This order is already in a return or exchange flow.' };
    }

    // Pickup orders that are READY can't cancel — they convert to takeaway in-store.
    if (orderType === 'pickup' && orderStatus === 'READY') {
        return {
            allowed: false,
            reason: 'Your order is ready for pickup. Visit the store to pick it up or convert to takeaway — too late to cancel.',
        };
    }

    // Unpaid orders cancel for free (no money to refund).
    if (!isPaid) {
        return { allowed: true, reason: 'Order not paid; cancelling at no charge.', feeInr: 0, refundInr: 0, autoRefundEligible: false };
    }

    // Dining: no refund on late-cancel / no-show — entire amount forfeited.
    if (orderType === 'dining') {
        return {
            allowed: true,
            reason: 'Dining bookings are non-refundable per our cancellation policy.',
            feeInr: Math.round(orderTotalInr),
            refundInr: 0,
            autoRefundEligible: false,
        };
    }

    // Pickup / takeaway / delivery: 5%/max ₹50 fee, UNLESS within the auto-refund window.
    const minutesSinceCreated = minutesBetween(createdAt, requestedAt);
    if (minutesSinceCreated <= AUTO_REFUND_WINDOW_MIN) {
        return {
            allowed: true,
            reason: `Cancelled within ${AUTO_REFUND_WINDOW_MIN} minutes — full refund issued.`,
            feeInr: 0,
            refundInr: Math.round(orderTotalInr),
            autoRefundEligible: true,
        };
    }

    const calcFee = Math.min(
        Math.round(orderTotalInr * PICKUP_CANCEL_FEE_PCT),
        PICKUP_CANCEL_FEE_CAP_INR,
    );
    const refund = clampNonNegative(Math.round(orderTotalInr) - calcFee);
    return {
        allowed: true,
        reason: `Late-cancel fee: ${(PICKUP_CANCEL_FEE_PCT * 100).toFixed(0)}% of order total (max ₹${PICKUP_CANCEL_FEE_CAP_INR}).`,
        feeInr: calcFee,
        refundInr: refund,
        autoRefundEligible: false,
    };
}

// ──────────────────────── Reschedule policy ────────────────────────────

export interface RescheduleInput {
    orderType: OrderTypeKind;
    orderStatus: OrderStatusLite;
    /** Current slot. */
    slotTimeAt: Date | null;
    /** Slot the customer is requesting. */
    newSlotAt: Date;
    /** When the customer pressed Reschedule. */
    requestedAt: Date;
    /** Peak-hour surcharge configured by merchant for newSlotAt. v0: 0. */
    peakSurchargeInr?: number;
}

export interface RescheduleOutcome {
    surchargeInr: number;
}

export function evaluateReschedule(input: RescheduleInput): Decision<RescheduleOutcome> {
    const { orderType, orderStatus, slotTimeAt, newSlotAt, requestedAt, peakSurchargeInr } = input;

    if (orderStatus !== 'PENDING' && orderStatus !== 'CONFIRMED') {
        return { allowed: false, reason: 'Reschedule is only possible before your order starts being prepared.' };
    }

    if (!slotTimeAt) {
        return { allowed: false, reason: 'This order doesn\'t have a scheduled slot to move.' };
    }

    if (newSlotAt.getTime() <= requestedAt.getTime()) {
        return { allowed: false, reason: 'New slot must be in the future.' };
    }

    // Dining: 45-min cutoff before current slot.
    if (orderType === 'dining') {
        const minutesUntilCurrentSlot = minutesBetween(requestedAt, slotTimeAt);
        if (minutesUntilCurrentSlot < RESCHEDULE_CUTOFF_MIN_DINING) {
            return {
                allowed: false,
                reason: `Dining slots can't be rescheduled within ${RESCHEDULE_CUTOFF_MIN_DINING} minutes of the reservation time.`,
            };
        }
    }

    const surcharge = clampNonNegative(Math.round(peakSurchargeInr ?? 0));
    return {
        allowed: true,
        reason: surcharge > 0
            ? `Rescheduled. Peak-hour surcharge: ₹${surcharge}.`
            : 'Slot updated.',
        surchargeInr: surcharge,
    };
}

// ────────────────────────── Return policy ──────────────────────────────

export interface ReturnInput {
    orderStatus: OrderStatusLite;
    /** Timestamp the order was marked COMPLETED. Null if still open. */
    completedAt: Date | null;
    requestedAt: Date;
    reason: ReturnReason;
    /** Whether the underlying product flagged returnable. */
    productReturnable: boolean;
    /** Refund amount the customer is requesting (server clamps to order subtotal). */
    requestedRefundInr: number;
    /** Number of photos uploaded — required for `damaged` reason. */
    photoCount: number;
}

export interface ReturnOutcome {
    /** Refund without requiring physical return (missing/wrong/damaged/quality). */
    refundWithoutReturn: boolean;
    /** Final refund amount, clamped to the requested amount. */
    refundInr: number;
}

export function evaluateReturn(input: ReturnInput): Decision<ReturnOutcome> {
    const { orderStatus, completedAt, requestedAt, reason, productReturnable, requestedRefundInr, photoCount } = input;

    if (orderStatus !== 'COMPLETED') {
        return { allowed: false, reason: 'Returns can only be requested after the order is completed.' };
    }
    if (!completedAt) {
        return { allowed: false, reason: 'Order completion time missing — please contact support.' };
    }
    if (!productReturnable) {
        return { allowed: false, reason: 'This product category is non-returnable (perishable / prepared / intimate).' };
    }

    const hoursSinceCompleted = hoursBetween(completedAt, requestedAt);
    if (hoursSinceCompleted > RETURN_WINDOW_HOURS) {
        return {
            allowed: false,
            reason: `Return window has closed (${RETURN_WINDOW_HOURS}h from completion).`,
        };
    }

    if (reason === 'damaged' && photoCount < 1) {
        return { allowed: false, reason: 'At least one photo is required for damaged-item returns.' };
    }

    const refund = clampNonNegative(Math.round(requestedRefundInr));
    if (refund === 0) {
        return { allowed: false, reason: 'Refund amount must be greater than zero.' };
    }

    const refundWithoutReturn = REFUND_WITHOUT_RETURN_REASONS.has(reason);
    return {
        allowed: true,
        reason: refundWithoutReturn
            ? 'Refund will be processed without requiring physical return.'
            : 'Drop the item back at the store to complete your refund.',
        refundWithoutReturn,
        refundInr: refund,
    };
}

// ───────────────────────── Exchange policy ─────────────────────────────

export interface ExchangeInput {
    orderStatus: OrderStatusLite;
    completedAt: Date | null;
    requestedAt: Date;
    reason: ExchangeReason;
}

export function evaluateExchange(input: ExchangeInput): Decision<{}> {
    const { orderStatus, completedAt, requestedAt } = input;

    if (orderStatus !== 'COMPLETED') {
        return { allowed: false, reason: 'Exchanges can only be requested after the order is completed.' };
    }
    if (!completedAt) {
        return { allowed: false, reason: 'Order completion time missing — please contact support.' };
    }

    const hoursSinceCompleted = hoursBetween(completedAt, requestedAt);
    if (hoursSinceCompleted > EXCHANGE_WINDOW_HOURS) {
        return {
            allowed: false,
            reason: `Exchange window has closed (${EXCHANGE_WINDOW_HOURS}h from completion).`,
        };
    }

    return {
        allowed: true,
        reason: `Visit the store within ${EXCHANGE_WINDOW_HOURS} hours to complete the exchange. Single-step, no fee.`,
    };
}

// ────────────────────── SLA helper ─────────────────────────────────────

/**
 * Compute the SLA deadline by which the merchant must approve or reject
 * a return/exchange issue before the cron auto-approves it.
 */
export function computeSlaDueAt(createdAt: Date): Date {
    return new Date(createdAt.getTime() + ISSUE_SLA_HOURS * HOUR_MS);
}

// ──────────────────────── Type-guard exports ───────────────────────────

export function isReturnReason(v: string): v is ReturnReason {
    return (RETURN_REASONS as readonly string[]).includes(v);
}

export function isExchangeReason(v: string): v is ExchangeReason {
    return (EXCHANGE_REASONS as readonly string[]).includes(v);
}
