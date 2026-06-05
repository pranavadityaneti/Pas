/**
 * Unit tests for the WS2.B rules engine. Run with:
 *
 *   cd apps/api && npx tsx --test src/orderLifecycle/rules.test.ts
 *
 * Uses the built-in `node:test` runner (same pattern as
 * src/services/notification.service.test.ts). No fixtures, no Prisma —
 * the rules module is pure and testable in isolation.
 */

import test from 'node:test';
import assert from 'node:assert';
import {
    evaluateCancel,
    evaluateReschedule,
    evaluateReturn,
    evaluateExchange,
    computeSlaDueAt,
    isReturnReason,
    isExchangeReason,
    PICKUP_CANCEL_FEE_CAP_INR,
    AUTO_REFUND_WINDOW_MIN,
    RESCHEDULE_CUTOFF_MIN_DINING,
    RETURN_WINDOW_HOURS,
    EXCHANGE_WINDOW_HOURS,
    ISSUE_SLA_HOURS,
} from './rules';

// ─────────────────────────── Cancel ─────────────────────────────────────

test('cancel: unpaid order → free, no refund', () => {
    const r = evaluateCancel({
        orderType: 'pickup',
        orderStatus: 'PENDING',
        orderTotalInr: 500,
        isPaid: false,
        createdAt: new Date('2026-06-05T10:00:00Z'),
        slotTimeAt: new Date('2026-06-05T12:00:00Z'),
        requestedAt: new Date('2026-06-05T10:30:00Z'),
    });
    assert.equal(r.allowed, true);
    if (r.allowed) {
        assert.equal(r.feeInr, 0);
        assert.equal(r.refundInr, 0);
    }
});

test('cancel: pickup within 5-min auto-refund window → no fee, full refund', () => {
    const created = new Date('2026-06-05T10:00:00Z');
    const r = evaluateCancel({
        orderType: 'pickup',
        orderStatus: 'PENDING',
        orderTotalInr: 1200,
        isPaid: true,
        createdAt: created,
        slotTimeAt: new Date('2026-06-05T12:00:00Z'),
        requestedAt: new Date(created.getTime() + 3 * 60_000),  // 3 min later
    });
    assert.equal(r.allowed, true);
    if (r.allowed) {
        assert.equal(r.feeInr, 0);
        assert.equal(r.refundInr, 1200);
        assert.equal(r.autoRefundEligible, true);
    }
});

test('cancel: pickup after 5-min window → 5% fee, capped at ₹50', () => {
    const created = new Date('2026-06-05T10:00:00Z');

    // small order: 5% under cap
    const small = evaluateCancel({
        orderType: 'pickup',
        orderStatus: 'PENDING',
        orderTotalInr: 600,
        isPaid: true,
        createdAt: created,
        slotTimeAt: new Date('2026-06-05T12:00:00Z'),
        requestedAt: new Date(created.getTime() + 10 * 60_000),  // 10 min later
    });
    assert.equal(small.allowed, true);
    if (small.allowed) {
        assert.equal(small.feeInr, 30);   // 5% of 600
        assert.equal(small.refundInr, 570);
        assert.equal(small.autoRefundEligible, false);
    }

    // large order: capped at ₹50
    const large = evaluateCancel({
        orderType: 'pickup',
        orderStatus: 'PENDING',
        orderTotalInr: 5000,
        isPaid: true,
        createdAt: created,
        slotTimeAt: null,
        requestedAt: new Date(created.getTime() + 30 * 60_000),
    });
    assert.equal(large.allowed, true);
    if (large.allowed) {
        assert.equal(large.feeInr, PICKUP_CANCEL_FEE_CAP_INR);   // ₹50
        assert.equal(large.refundInr, 4950);
    }
});

test('cancel: READY pickup → blocked (convert to takeaway in store)', () => {
    const r = evaluateCancel({
        orderType: 'pickup',
        orderStatus: 'READY',
        orderTotalInr: 500,
        isPaid: true,
        createdAt: new Date(),
        slotTimeAt: new Date(),
        requestedAt: new Date(),
    });
    assert.equal(r.allowed, false);
    assert.ok(r.reason.includes('ready'));
});

test('cancel: dining → no refund, full forfeit', () => {
    const r = evaluateCancel({
        orderType: 'dining',
        orderStatus: 'CONFIRMED',
        orderTotalInr: 800,
        isPaid: true,
        createdAt: new Date('2026-06-05T08:00:00Z'),
        slotTimeAt: new Date('2026-06-05T20:00:00Z'),
        requestedAt: new Date('2026-06-05T15:00:00Z'),
    });
    assert.equal(r.allowed, true);
    if (r.allowed) {
        assert.equal(r.feeInr, 800);
        assert.equal(r.refundInr, 0);
    }
});

test('cancel: terminal states blocked', () => {
    for (const st of ['COMPLETED', 'CANCELLED', 'REFUNDED'] as const) {
        const r = evaluateCancel({
            orderType: 'pickup',
            orderStatus: st,
            orderTotalInr: 500,
            isPaid: true,
            createdAt: new Date(),
            slotTimeAt: null,
            requestedAt: new Date(),
        });
        assert.equal(r.allowed, false, `expected blocked for ${st}`);
    }
});

// ──────────────────────── Reschedule ──────────────────────────────────

test('reschedule: dining within 45-min cutoff → blocked', () => {
    const now = new Date('2026-06-05T19:30:00Z');
    const r = evaluateReschedule({
        orderType: 'dining',
        orderStatus: 'CONFIRMED',
        slotTimeAt: new Date('2026-06-05T20:00:00Z'),   // 30 min away
        newSlotAt: new Date('2026-06-05T21:00:00Z'),
        requestedAt: now,
    });
    assert.equal(r.allowed, false);
    assert.ok(r.reason.includes(String(RESCHEDULE_CUTOFF_MIN_DINING)));
});

test('reschedule: dining outside cutoff → allowed', () => {
    const r = evaluateReschedule({
        orderType: 'dining',
        orderStatus: 'CONFIRMED',
        slotTimeAt: new Date('2026-06-05T20:00:00Z'),
        newSlotAt: new Date('2026-06-05T21:00:00Z'),
        requestedAt: new Date('2026-06-05T15:00:00Z'),
    });
    assert.equal(r.allowed, true);
    if (r.allowed) assert.equal(r.surchargeInr, 0);
});

test('reschedule: peak surcharge passes through', () => {
    const r = evaluateReschedule({
        orderType: 'dining',
        orderStatus: 'CONFIRMED',
        slotTimeAt: new Date('2026-06-05T20:00:00Z'),
        newSlotAt: new Date('2026-06-05T21:00:00Z'),
        requestedAt: new Date('2026-06-05T15:00:00Z'),
        peakSurchargeInr: 75,
    });
    assert.equal(r.allowed, true);
    if (r.allowed) assert.equal(r.surchargeInr, 75);
});

test('reschedule: new slot must be in the future', () => {
    const r = evaluateReschedule({
        orderType: 'pickup',
        orderStatus: 'CONFIRMED',
        slotTimeAt: new Date('2026-06-05T20:00:00Z'),
        newSlotAt: new Date('2026-06-05T10:00:00Z'),   // past
        requestedAt: new Date('2026-06-05T15:00:00Z'),
    });
    assert.equal(r.allowed, false);
});

test('reschedule: already PREPARING → blocked', () => {
    const r = evaluateReschedule({
        orderType: 'pickup',
        orderStatus: 'PREPARING',
        slotTimeAt: new Date('2026-06-05T20:00:00Z'),
        newSlotAt: new Date('2026-06-05T22:00:00Z'),
        requestedAt: new Date('2026-06-05T19:00:00Z'),
    });
    assert.equal(r.allowed, false);
});

// ──────────────────────── Return ──────────────────────────────────────

test('return: not COMPLETED → blocked', () => {
    const r = evaluateReturn({
        orderStatus: 'READY',
        completedAt: null,
        requestedAt: new Date(),
        reason: 'damaged',
        productReturnable: true,
        requestedRefundInr: 200,
        photoCount: 1,
    });
    assert.equal(r.allowed, false);
});

test('return: non-returnable product → blocked', () => {
    const r = evaluateReturn({
        orderStatus: 'COMPLETED',
        completedAt: new Date('2026-06-05T10:00:00Z'),
        requestedAt: new Date('2026-06-05T12:00:00Z'),
        reason: 'damaged',
        productReturnable: false,
        requestedRefundInr: 200,
        photoCount: 1,
    });
    assert.equal(r.allowed, false);
    assert.ok(r.reason.toLowerCase().includes('non-returnable'));
});

test('return: outside 24h window → blocked', () => {
    const completed = new Date('2026-06-04T10:00:00Z');
    const requestedAfter25h = new Date(completed.getTime() + 25 * 3600_000);
    const r = evaluateReturn({
        orderStatus: 'COMPLETED',
        completedAt: completed,
        requestedAt: requestedAfter25h,
        reason: 'changed_mind',
        productReturnable: true,
        requestedRefundInr: 500,
        photoCount: 0,
    });
    assert.equal(r.allowed, false);
    assert.ok(r.reason.includes(String(RETURN_WINDOW_HOURS)));
});

test('return: damaged without photos → blocked', () => {
    const r = evaluateReturn({
        orderStatus: 'COMPLETED',
        completedAt: new Date('2026-06-05T10:00:00Z'),
        requestedAt: new Date('2026-06-05T12:00:00Z'),
        reason: 'damaged',
        productReturnable: true,
        requestedRefundInr: 200,
        photoCount: 0,
    });
    assert.equal(r.allowed, false);
    assert.ok(r.reason.includes('photo'));
});

test('return: refund-without-return for missing item', () => {
    const r = evaluateReturn({
        orderStatus: 'COMPLETED',
        completedAt: new Date('2026-06-05T10:00:00Z'),
        requestedAt: new Date('2026-06-05T15:00:00Z'),
        reason: 'missing_item',
        productReturnable: true,
        requestedRefundInr: 200,
        photoCount: 0,
    });
    assert.equal(r.allowed, true);
    if (r.allowed) {
        assert.equal(r.refundWithoutReturn, true);
        assert.equal(r.refundInr, 200);
    }
});

test('return: changed-mind requires return-then-refund (not refund-without-return)', () => {
    const r = evaluateReturn({
        orderStatus: 'COMPLETED',
        completedAt: new Date('2026-06-05T10:00:00Z'),
        requestedAt: new Date('2026-06-05T15:00:00Z'),
        reason: 'changed_mind',
        productReturnable: true,
        requestedRefundInr: 500,
        photoCount: 0,
    });
    assert.equal(r.allowed, true);
    if (r.allowed) {
        assert.equal(r.refundWithoutReturn, false);
        assert.equal(r.refundInr, 500);
    }
});

// ──────────────────────── Exchange ────────────────────────────────────

test('exchange: not COMPLETED → blocked', () => {
    const r = evaluateExchange({
        orderStatus: 'READY',
        completedAt: null,
        requestedAt: new Date(),
        reason: 'wrong_size',
    });
    assert.equal(r.allowed, false);
});

test('exchange: within 24h → allowed', () => {
    const r = evaluateExchange({
        orderStatus: 'COMPLETED',
        completedAt: new Date('2026-06-05T10:00:00Z'),
        requestedAt: new Date('2026-06-05T18:00:00Z'),
        reason: 'changed_mind',
    });
    assert.equal(r.allowed, true);
    if (r.allowed) {
        assert.ok(r.reason.includes(String(EXCHANGE_WINDOW_HOURS)));
    }
});

test('exchange: outside 24h → blocked', () => {
    const completed = new Date('2026-06-04T10:00:00Z');
    const r = evaluateExchange({
        orderStatus: 'COMPLETED',
        completedAt: completed,
        requestedAt: new Date(completed.getTime() + 25 * 3600_000),
        reason: 'defective',
    });
    assert.equal(r.allowed, false);
});

// ───────────────────────── SLA + helpers ──────────────────────────────

test('computeSlaDueAt is 24h after createdAt', () => {
    const created = new Date('2026-06-05T10:00:00Z');
    const sla = computeSlaDueAt(created);
    const diffH = (sla.getTime() - created.getTime()) / 3600_000;
    assert.equal(diffH, ISSUE_SLA_HOURS);
});

test('reason type guards', () => {
    assert.equal(isReturnReason('damaged'), true);
    assert.equal(isReturnReason('not-a-real-reason'), false);
    assert.equal(isExchangeReason('wrong_size'), true);
    assert.equal(isExchangeReason('damaged'), false);  // damaged is for returns
});

// Constants surface — keep a witness that the public exports are stable.
test('exported constants match spec', () => {
    assert.equal(PICKUP_CANCEL_FEE_CAP_INR, 50);
    assert.equal(AUTO_REFUND_WINDOW_MIN, 5);
    assert.equal(RESCHEDULE_CUTOFF_MIN_DINING, 45);
    assert.equal(RETURN_WINDOW_HOURS, 24);
    assert.equal(EXCHANGE_WINDOW_HOURS, 24);
    assert.equal(ISSUE_SLA_HOURS, 24);
});
