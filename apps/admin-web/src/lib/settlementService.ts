import api from './api';

// Settlement ledger (Coupon Foolproof Phase 7) — talks to the Express API.
// Money fields are Prisma Decimals and arrive as JSON strings — always Number() them.

export type CycleStatus = 'OPEN' | 'CLOSED' | 'PAID';

export interface SettlementCycle {
    id: string;
    merchantId: string;
    merchantName?: string | null;
    periodStart: string;
    periodEnd: string;
    status: CycleStatus;
    grossSales: string;
    commissionBase: string;
    commissionAmount: string;
    couponReimbursement: string;
    couponAbsorbed: string;
    clawbackAmount: string;
    gstOnCommission: string;
    tcsAmount: string;
    netPayout: string;
    heldOrderCount: number;
    closedAt: string | null;
    paidAt: string | null;
    paidBy: string | null;
    paymentReference: string | null;
    createdAt: string;
}

export interface SettlementLine {
    id: string;
    cycleId: string | null;
    orderId: string | null;
    kind: 'SALE' | 'COUPON_REIMBURSEMENT' | 'CLAWBACK' | string;
    amount: string;
    commissionRatePct: string | null;
    commissionRuleId: string | null;
    note: string | null;
    createdAt: string;
}

export interface SettlementCycleDetail extends SettlementCycle {
    lines: SettlementLine[];
}

export interface CommissionRule {
    id: string;
    category: string;
    orderType: string;
    tier: number | null;
    ratePct: string;
    effectiveFrom: string;
    provisional: boolean;
    createdAt: string;
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

export async function listSettlements(status?: CycleStatus): Promise<SettlementCycle[]> {
    const res = await api.get('/admin/settlements', { params: status ? { status } : {} });
    return res.data.data;
}

export async function getSettlement(id: string): Promise<SettlementCycleDetail> {
    const res = await api.get(`/admin/settlements/${id}`);
    return res.data;
}

export async function markSettlementPaid(id: string, paymentReference: string): Promise<void> {
    await api.post(`/admin/settlements/${id}/mark-paid`, { paymentReference });
}

export async function closeCycle(weekOf?: string): Promise<CloseCycleResult> {
    const res = await api.post('/admin/settlements/close-cycle', weekOf ? { weekOf } : {});
    return res.data;
}

export async function listCommissionRules(): Promise<CommissionRule[]> {
    const res = await api.get('/admin/commission-rules');
    return res.data.data;
}

export async function updateCommissionRule(id: string, ratePct: number, provisional?: boolean): Promise<CommissionRule> {
    const res = await api.put(`/admin/commission-rules/${id}`, { ratePct, ...(provisional !== undefined ? { provisional } : {}) });
    return res.data;
}

export const formatINR = (v: string | number | null | undefined): string => {
    const n = Number(v ?? 0);
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
