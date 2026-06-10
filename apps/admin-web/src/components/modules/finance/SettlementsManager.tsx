/**
 * Settlements Manager — Coupon Foolproof Phase 7E (2026-06-10).
 *
 * Real settlement ledger UI over the Express API:
 *   - Weekly cycle list (OPEN / CLOSED / PAID) with merchant names + money columns
 *   - Detail drill-down: per-order SALE / COUPON_REIMBURSEMENT / CLAWBACK lines
 *   - Mark-paid flow (manual bank transfer + UTR reference until the payout
 *     vendor lands — Phase 7b will automate transfers)
 *   - Close-cycle button (idempotent; mirrors the Monday 02:00 IST cron)
 *   - Commission rules editor (rates are data, not code — provisional rows are
 *     the founder-unresolved FQ-1/FQ-2 items from Commissions.pdf)
 *
 * Replaced the 2026-06-02 placeholder. Money movement itself stays manual;
 * this screen only records what was calculated and what was paid.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, ArrowLeft, BadgeCheck, BadgeIndianRupee, CalendarClock,
    CheckCircle2, ChevronRight, Loader2, Lock, PauseCircle, Percent, RefreshCw,
    Settings2, Wallet, X,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';
import {
    closeCycle, formatINR, getSettlement, listCommissionRules, listSettlements,
    markSettlementPaid, updateCommissionRule,
    type CommissionRule, type CycleStatus, type SettlementCycle, type SettlementCycleDetail,
} from '../../../lib/settlementService';

type ViewTab = 'cycles' | 'rules';
type StatusFilter = CycleStatus | 'ALL';

const STATUS_STYLES: Record<CycleStatus, string> = {
    OPEN:   'bg-blue-50 text-blue-700 border-blue-200',
    CLOSED: 'bg-amber-50 text-amber-700 border-amber-200',
    PAID:   'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const LINE_KIND_STYLES: Record<string, string> = {
    SALE:                  'bg-gray-100 text-gray-700',
    COUPON_REIMBURSEMENT:  'bg-emerald-50 text-emerald-700',
    CLAWBACK:              'bg-red-50 text-red-700',
};

function formatPeriod(start: string, end: string): string {
    const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
    // periodEnd is exclusive (next Monday 00:00 IST) — show the inclusive Sunday.
    const endInclusive = new Date(new Date(end).getTime() - 24 * 60 * 60 * 1000);
    return `${fmt(start)} – ${fmt(endInclusive.toISOString())}`;
}

export function SettlementsManager() {
    const [viewTab, setViewTab] = useState<ViewTab>('cycles');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [cycles, setCycles] = useState<SettlementCycle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [detail, setDetail] = useState<SettlementCycleDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [payTarget, setPayTarget] = useState<SettlementCycle | null>(null);
    const [payRef, setPayRef] = useState('');
    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState<string | null>(null);

    const [closing, setClosing] = useState(false);
    const [closeSummary, setCloseSummary] = useState<string | null>(null);

    const [rules, setRules] = useState<CommissionRule[]>([]);
    const [rulesLoading, setRulesLoading] = useState(false);
    const [editingRule, setEditingRule] = useState<string | null>(null);
    const [editRate, setEditRate] = useState('');
    const [ruleSaving, setRuleSaving] = useState(false);

    const loadCycles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setCycles(await listSettlements(statusFilter === 'ALL' ? undefined : statusFilter));
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to load settlements');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { loadCycles(); }, [loadCycles]);

    const loadRules = useCallback(async () => {
        setRulesLoading(true);
        try {
            setRules(await listCommissionRules());
        } catch {
            // surfaced via the empty state
        } finally {
            setRulesLoading(false);
        }
    }, []);

    useEffect(() => { if (viewTab === 'rules' && rules.length === 0) loadRules(); }, [viewTab, rules.length, loadRules]);

    const openDetail = async (cycle: SettlementCycle) => {
        setDetailLoading(true);
        try {
            setDetail(await getSettlement(cycle.id));
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to load settlement detail');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleMarkPaid = async () => {
        if (!payTarget || !payRef.trim()) return;
        setPaying(true);
        setPayError(null);
        try {
            await markSettlementPaid(payTarget.id, payRef.trim());
            setPayTarget(null);
            setPayRef('');
            await loadCycles();
            if (detail?.id === payTarget.id) setDetail(await getSettlement(payTarget.id));
        } catch (e: any) {
            setPayError(e?.response?.data?.error || 'Failed to mark paid');
        } finally {
            setPaying(false);
        }
    };

    const handleCloseCycle = async () => {
        setClosing(true);
        setCloseSummary(null);
        setError(null);
        try {
            const r = await closeCycle();
            setCloseSummary(
                `Closed ${formatPeriod(r.periodStart, r.periodEnd)}: ${r.merchantsClosed} merchants, ${r.ordersSettled} orders settled` +
                ` (held: ${r.ordersHeldUnverified} unverified, ${r.ordersHeldNoProfile} no-profile), net ${formatINR(r.totals.netPayout)}.` +
                (r.merchantsSkipped > 0 ? ` ${r.merchantsSkipped} already closed (skipped).` : ''),
            );
            await loadCycles();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Cycle close failed');
        } finally {
            setClosing(false);
        }
    };

    const saveRule = async (rule: CommissionRule) => {
        const rate = Number(editRate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 50) return;
        setRuleSaving(true);
        try {
            // Editing a rate is the founder resolving it — clear the provisional flag.
            const updated = await updateCommissionRule(rule.id, rate, false);
            setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
            setEditingRule(null);
        } catch {
            // keep the editor open on failure
        } finally {
            setRuleSaving(false);
        }
    };

    const summary = useMemo(() => {
        const closed = cycles.filter((c) => c.status === 'CLOSED');
        return {
            awaitingPayout: closed.reduce((s, c) => s + Number(c.netPayout), 0),
            closedCount: closed.length,
            heldOrders: cycles.reduce((s, c) => s + c.heldOrderCount, 0),
        };
    }, [cycles]);

    // ── Detail view ─────────────────────────────────────────────────────────
    if (detail) {
        const d = detail;
        const moneyRows: Array<[string, string, string?]> = [
            ['Gross sales (items, pre-GST)', formatINR(d.grossSales)],
            ['Commission base', formatINR(d.commissionBase)],
            ['Platform commission', `− ${formatINR(d.commissionAmount)}`, 'text-red-600'],
            ['Coupon reimbursement (platform-funded)', `+ ${formatINR(d.couponReimbursement)}`, 'text-emerald-600'],
            ['Coupon absorbed (merchant-funded)', formatINR(d.couponAbsorbed)],
            ['Clawbacks (post-settlement refunds)', `− ${formatINR(d.clawbackAmount)}`, 'text-red-600'],
        ];
        return (
            <div className="h-full overflow-auto p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" className="gap-2 text-gray-600" onClick={() => setDetail(null)}>
                        <ArrowLeft className="w-4 h-4" /> All settlements
                    </Button>
                    <span className={cn('px-2.5 py-1 rounded-full border text-xs font-bold', STATUS_STYLES[d.status])}>{d.status}</span>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-gray-900">{d.merchantName || d.merchantId}</h3>
                    <p className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" /> Week of {formatPeriod(d.periodStart, d.periodEnd)}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                        {moneyRows.map(([label, value, color]) => (
                            <div key={label} className="flex items-center justify-between px-4 py-2.5">
                                <span className="text-sm text-gray-600">{label}</span>
                                <span className={cn('text-sm font-semibold text-gray-900 tabular-nums', color)}>{value}</span>
                            </div>
                        ))}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                            <span className="text-sm font-bold text-gray-900">Net payout</span>
                            <span className="text-base font-bold text-gray-900 tabular-nums">{formatINR(d.netPayout)}</span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4 space-y-3 text-sm">
                        {d.heldOrderCount > 0 && (
                            <p className="flex items-start gap-2 text-amber-700">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                {d.heldOrderCount} order{d.heldOrderCount === 1 ? '' : 's'} held out of this cycle
                                (unverified payment or merchant not yet configured) — they roll into the next close once resolved.
                            </p>
                        )}
                        {d.status === 'PAID' ? (
                            <div className="space-y-1.5">
                                <p className="flex items-center gap-2 text-emerald-700 font-semibold">
                                    <BadgeCheck className="w-4 h-4" /> Paid {d.paidAt ? new Date(d.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}
                                </p>
                                <p className="text-gray-600">Reference: <span className="font-mono text-xs">{d.paymentReference}</span></p>
                            </div>
                        ) : d.status === 'CLOSED' ? (
                            <div className="space-y-2">
                                <p className="text-gray-600">Cycle is frozen. Transfer {formatINR(d.netPayout)} to the merchant, then record the bank reference here.</p>
                                <Button size="sm" className="gap-2" onClick={() => { setPayTarget(d); setPayRef(''); setPayError(null); }}>
                                    <BadgeIndianRupee className="w-4 h-4" /> Mark as paid
                                </Button>
                            </div>
                        ) : (
                            <p className="flex items-center gap-2 text-blue-700">
                                <Lock className="w-4 h-4" /> Cycle is still open — totals freeze when the week closes.
                            </p>
                        )}
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-2">Lines ({d.lines.length})</h4>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2.5">Kind</th>
                                    <th className="px-4 py-2.5">Order</th>
                                    <th className="px-4 py-2.5">Note</th>
                                    <th className="px-4 py-2.5 text-right">Rate</th>
                                    <th className="px-4 py-2.5 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {d.lines.map((l) => (
                                    <tr key={l.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2">
                                            <span className={cn('px-2 py-0.5 rounded text-xs font-semibold', LINE_KIND_STYLES[l.kind] || 'bg-gray-100 text-gray-700')}>
                                                {l.kind.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{l.orderId ? `${l.orderId.slice(0, 8)}…` : '—'}</td>
                                        <td className="px-4 py-2 text-gray-600 max-w-[280px] truncate" title={l.note || undefined}>{l.note || '—'}</td>
                                        <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{l.commissionRatePct != null ? `${Number(l.commissionRatePct)}%` : '—'}</td>
                                        <td className={cn('px-4 py-2 text-right font-semibold tabular-nums', l.kind === 'CLAWBACK' ? 'text-red-600' : 'text-gray-900')}>
                                            {formatINR(l.amount)}
                                        </td>
                                    </tr>
                                ))}
                                {d.lines.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No lines in this cycle.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {payTarget && <MarkPaidDialog
                    cycle={payTarget} payRef={payRef} setPayRef={setPayRef}
                    paying={paying} payError={payError}
                    onCancel={() => setPayTarget(null)} onConfirm={handleMarkPaid}
                />}
            </div>
        );
    }

    // ── List view ───────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className={cn('gap-1.5 rounded-lg', viewTab === 'cycles' ? 'bg-gray-100 text-gray-900' : 'text-gray-500')} onClick={() => setViewTab('cycles')}>
                        <Wallet className="w-4 h-4" /> Cycles
                    </Button>
                    <Button variant="ghost" size="sm" className={cn('gap-1.5 rounded-lg', viewTab === 'rules' ? 'bg-gray-100 text-gray-900' : 'text-gray-500')} onClick={() => setViewTab('rules')}>
                        <Percent className="w-4 h-4" /> Commission rules
                    </Button>
                </div>
                {viewTab === 'cycles' && (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500" onClick={loadCycles} disabled={loading}>
                            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Refresh
                        </Button>
                        <Button size="sm" className="gap-1.5" onClick={handleCloseCycle} disabled={closing}>
                            {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Close last week
                        </Button>
                    </div>
                )}
            </div>

            {viewTab === 'rules' ? (
                <div className="flex-1 overflow-auto p-5">
                    <p className="text-xs text-gray-500 mb-3 max-w-2xl">
                        Rates apply at cycle-close time. <span className="font-semibold text-amber-700">Provisional</span> rows
                        carry the unresolved items from the commission sheet (5% vs 7% conflict; blank F&amp;B tiers 3–5) —
                        saving a rate marks it resolved.
                    </p>
                    {rulesLoading ? (
                        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : (
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                                    <tr>
                                        <th className="px-4 py-2.5">Category</th>
                                        <th className="px-4 py-2.5">Order type</th>
                                        <th className="px-4 py-2.5">Tier</th>
                                        <th className="px-4 py-2.5 text-right">Rate</th>
                                        <th className="px-4 py-2.5"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rules.map((r) => (
                                        <tr key={r.id} className={cn('hover:bg-gray-50', r.provisional && 'bg-amber-50/40')}>
                                            <td className="px-4 py-2 font-medium text-gray-900">
                                                {r.category}
                                                {r.provisional && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">Provisional</span>}
                                            </td>
                                            <td className="px-4 py-2 text-gray-600">{r.orderType}</td>
                                            <td className="px-4 py-2 text-gray-600">{r.tier ?? '—'}</td>
                                            <td className="px-4 py-2 text-right">
                                                {editingRule === r.id ? (
                                                    <input
                                                        autoFocus type="number" step="0.5" min="0" max="50"
                                                        className="w-20 px-2 py-1 border border-gray-300 rounded-md text-right text-sm"
                                                        value={editRate}
                                                        onChange={(e) => setEditRate(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') saveRule(r); if (e.key === 'Escape') setEditingRule(null); }}
                                                    />
                                                ) : (
                                                    <span className="font-semibold tabular-nums">{Number(r.ratePct)}%</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {editingRule === r.id ? (
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" className="h-7 px-2.5" disabled={ruleSaving} onClick={() => saveRule(r)}>
                                                            {ruleSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingRule(null)}><X className="w-3.5 h-3.5" /></Button>
                                                    </div>
                                                ) : (
                                                    <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-gray-500" onClick={() => { setEditingRule(r.id); setEditRate(String(Number(r.ratePct))); }}>
                                                        <Settings2 className="w-3.5 h-3.5" /> Edit
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {rules.length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No commission rules found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 overflow-auto p-5 space-y-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-gray-200 px-4 py-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase">Awaiting payout</p>
                            <p className="text-xl font-bold text-gray-900 tabular-nums">{formatINR(summary.awaitingPayout)}</p>
                            <p className="text-xs text-gray-500">{summary.closedCount} closed cycle{summary.closedCount === 1 ? '' : 's'}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 px-4 py-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase">Held orders</p>
                            <p className={cn('text-xl font-bold tabular-nums', summary.heldOrders > 0 ? 'text-amber-600' : 'text-gray-900')}>{summary.heldOrders}</p>
                            <p className="text-xs text-gray-500">awaiting verification / config</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 px-4 py-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase">Cycles loaded</p>
                            <p className="text-xl font-bold text-gray-900 tabular-nums">{cycles.length}</p>
                            <p className="text-xs text-gray-500">weekly · Mon–Sun IST</p>
                        </div>
                    </div>

                    {closeSummary && (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800 flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {closeSummary}
                        </div>
                    )}
                    {error && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                        </div>
                    )}

                    {/* Status filter */}
                    <div className="flex items-center gap-1.5">
                        {(['ALL', 'OPEN', 'CLOSED', 'PAID'] as StatusFilter[]).map((s) => (
                            <button
                                key={s}
                                className={cn(
                                    'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                                    statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                                )}
                                onClick={() => setStatusFilter(s)}
                            >
                                {s === 'ALL' ? 'All' : s}
                            </button>
                        ))}
                    </div>

                    {/* Cycle table */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : cycles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-4">
                                <PauseCircle className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-1">No settlement cycles yet</h3>
                            <p className="text-sm text-gray-500 max-w-sm">
                                Cycles are created when a week closes — automatically every Monday 02:00 IST,
                                or on demand with “Close last week”.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                                    <tr>
                                        <th className="px-4 py-2.5">Merchant</th>
                                        <th className="px-4 py-2.5">Week</th>
                                        <th className="px-4 py-2.5 text-right">Gross</th>
                                        <th className="px-4 py-2.5 text-right">Commission</th>
                                        <th className="px-4 py-2.5 text-right">Coupon reimb.</th>
                                        <th className="px-4 py-2.5 text-right">Clawback</th>
                                        <th className="px-4 py-2.5 text-right">Net payout</th>
                                        <th className="px-4 py-2.5">Status</th>
                                        <th className="px-4 py-2.5"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cycles.map((c) => (
                                        <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(c)}>
                                            <td className="px-4 py-2.5 font-medium text-gray-900">
                                                {c.merchantName || <span className="font-mono text-xs text-gray-500">{c.merchantId.slice(0, 8)}…</span>}
                                                {c.heldOrderCount > 0 && (
                                                    <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold" title={`${c.heldOrderCount} held orders`}>
                                                        {c.heldOrderCount} held
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatPeriod(c.periodStart, c.periodEnd)}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatINR(c.grossSales)}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-red-600">− {formatINR(c.commissionAmount)}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">+ {formatINR(c.couponReimbursement)}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{Number(c.clawbackAmount) > 0 ? `− ${formatINR(c.clawbackAmount)}` : '—'}</td>
                                            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900">{formatINR(c.netPayout)}</td>
                                            <td className="px-4 py-2.5">
                                                <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-bold', STATUS_STYLES[c.status])}>{c.status}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                    {c.status === 'CLOSED' && (
                                                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setPayTarget(c); setPayRef(''); setPayError(null); }}>
                                                            <BadgeIndianRupee className="w-3.5 h-3.5" /> Mark paid
                                                        </Button>
                                                    )}
                                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {detailLoading && (
                        <div className="fixed inset-0 z-40 bg-black/10 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                        </div>
                    )}
                </div>
            )}

            {payTarget && !detail && <MarkPaidDialog
                cycle={payTarget} payRef={payRef} setPayRef={setPayRef}
                paying={paying} payError={payError}
                onCancel={() => setPayTarget(null)} onConfirm={handleMarkPaid}
            />}
        </div>
    );
}

function MarkPaidDialog(props: {
    cycle: SettlementCycle;
    payRef: string;
    setPayRef: (v: string) => void;
    paying: boolean;
    payError: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const { cycle, payRef, setPayRef, paying, payError, onCancel, onConfirm } = props;
    return (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6" onClick={onCancel}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div>
                    <h3 className="text-base font-bold text-gray-900">Mark settlement as paid</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {cycle.merchantName || cycle.merchantId} · {formatPeriod(cycle.periodStart, cycle.periodEnd)}
                    </p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600">Net payout</span>
                    <span className="text-lg font-bold text-gray-900 tabular-nums">{formatINR(cycle.netPayout)}</span>
                </div>
                <p className="text-xs text-gray-500">
                    Confirm the bank transfer is done FIRST — this records it, it does not move money. The flip is permanent.
                </p>
                <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase">Bank UTR / transfer reference</label>
                    <input
                        autoFocus
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                        placeholder="e.g. UTR2261234567890"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && payRef.trim()) onConfirm(); }}
                    />
                </div>
                {payError && <p className="text-sm text-red-600">{payError}</p>}
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={onCancel} disabled={paying}>Cancel</Button>
                    <Button size="sm" className="gap-1.5" disabled={paying || !payRef.trim()} onClick={onConfirm}>
                        {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                        Confirm paid
                    </Button>
                </div>
            </div>
        </div>
    );
}
