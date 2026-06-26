/**
 * Returns & Exchanges — admin-owned return/exchange decisioning (Phase 3b, 2026-06-26).
 *
 * Returns moved off merchants to the admin (Pranav decision: merchants never refund;
 * the merchant app is display-only). This screen lists every PENDING return/exchange
 * across all stores from GET /admin/issues and lets an admin Approve / Reject. Approving
 * a return issues a REAL Razorpay refund via PATCH /admin/orders/:id/issue/:issueId
 * (the shared decideOrderIssue engine — idempotent, audited; the customer is notified
 * with RETURN_DECISION / EXCHANGE_DECISION). The SLA cron still auto-approves stale
 * pending issues after 24h as a backstop.
 */
import { useEffect, useState } from 'react';
import { Undo2, Loader2, IndianRupee, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../ui/button';

interface IssueOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customer_name: string | null;
  customer_phone: string | null;
  store_name: string | null;
  order_type: string | null;
  createdAt: string;
  isPaid: boolean;
  storeId: string;
  user: { name: string | null; phone: string | null; email: string | null } | null;
  items?: Array<{ id: string; quantity: number; price: number; product_name: string | null }>;
}
interface Issue {
  id: string;
  type: string; // 'return' | 'exchange'
  reason: string;
  description: string | null;
  photos: string[];
  status: string;
  refundAmountInr: number | null;
  slaDueAt: string;
  createdAt: string;
  order: IssueOrder;
}

function slaLabel(slaDueAt: string): { text: string; urgent: boolean } {
  const due = new Date(slaDueAt).getTime();
  const ms = due - Date.now();
  if (ms <= 0) return { text: 'auto-approves any moment', urgent: true };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return { text: `auto-approves in ${h > 0 ? `${h}h ` : ''}${m}m`, urgent: h < 2 };
}

export function ReturnsExchanges() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/issues?status=PENDING&type=ALL&limit=200')
      .then(({ data }) => setIssues(Array.isArray(data) ? data : []))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const decide = async (issue: Issue, decision: 'APPROVED' | 'REJECTED') => {
    const isReturn = issue.type === 'return';
    const refund = issue.refundAmountInr ?? 0;
    let reason: string | undefined;
    if (decision === 'APPROVED') {
      const msg = isReturn && refund > 0
        ? `Approve this return and issue a REAL Razorpay refund of ₹${refund} to the customer?\n\nThis moves money back to the customer and cannot be undone.`
        : `Approve this ${issue.type}?`;
      if (!window.confirm(msg)) return;
    } else {
      const r = window.prompt('Reject this request — reason shown to the customer:', 'Not eligible per return policy.');
      if (r === null) return; // cancelled
      reason = r.trim() || 'Not eligible per return policy.';
    }
    setBusy(issue.id);
    try {
      const { data } = await api.patch(`/admin/orders/${issue.order.id}/issue/${issue.id}`, {
        decision,
        merchantDecisionReason: reason,
      });
      const refundMsg = data?.refund?.razorpayRefundId
        ? ` · Refund ${data.refund.razorpayRefundId}${data.refund.simulated ? ' (sim)' : ''}`
        : '';
      toast.success(`${isReturn ? 'Return' : 'Exchange'} ${decision === 'APPROVED' ? 'approved' : 'rejected'}${refundMsg}`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Decision failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
            <Undo2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Returns &amp; Exchanges</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review every pending return/exchange — approve issues the refund, reject notifies the customer</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-2 py-1 rounded bg-red-50 text-red-700">{issues.length} pending</span>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      {loading && issues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : issues.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-12 text-center text-sm text-gray-400">
          No pending returns or exchanges — all clear.
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => {
            const isReturn = issue.type === 'return';
            const refund = issue.refundAmountInr ?? 0;
            const sla = slaLabel(issue.slaDueAt);
            return (
              <div key={issue.id} className="bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isReturn ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                        {isReturn ? 'RETURN' : 'EXCHANGE'}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{issue.order.orderNumber}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-sm text-gray-700">₹{Math.round(issue.order.totalAmount).toLocaleString('en-IN')}</span>
                      {isReturn && refund > 0 && (
                        <span className="text-[11px] font-semibold text-[#B52725] bg-[#B52725]/5 px-2 py-0.5 rounded">refund ₹{refund}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {issue.order.user?.name || issue.order.customer_name || 'Customer'}
                      {issue.order.customer_phone ? ` · ${issue.order.customer_phone}` : ''}
                      {' · '}{issue.order.store_name || 'Store'}
                      {issue.createdAt ? ` · ${format(new Date(issue.createdAt), 'dd MMM, HH:mm')}` : ''}
                    </div>
                    <div className="text-sm text-gray-800 mt-2">
                      <span className="font-medium">Reason:</span> {issue.reason}
                      {issue.description ? <span className="text-gray-600"> — {issue.description}</span> : null}
                    </div>
                    {issue.photos && issue.photos.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {issue.photos.slice(0, 4).map((p, i) => (
                          <a key={i} href={p} target="_blank" rel="noreferrer">
                            <img src={p} alt={`photo ${i + 1}`} className="w-12 h-12 rounded object-cover border border-gray-200 hover:opacity-80" />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center gap-1 text-[11px] mt-2 ${sla.urgent ? 'text-amber-600' : 'text-gray-400'}`}>
                      <Clock className="w-3 h-3" /> {sla.text}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-[#166534] hover:bg-[#125227] text-white"
                      disabled={busy === issue.id}
                      onClick={() => decide(issue, 'APPROVED')}
                    >
                      {busy === issue.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                        <>{isReturn && refund > 0 ? <IndianRupee className="w-3.5 h-3.5 mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}Approve</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-gray-600 border-gray-300 hover:bg-gray-50"
                      disabled={busy === issue.id}
                      onClick={() => decide(issue, 'REJECTED')}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-gray-500 bg-amber-50/50 border border-amber-100 rounded-lg p-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>Approving a <strong>return</strong> issues a <strong>real Razorpay refund</strong> to the customer and is recorded in the admin audit trail. Pending requests auto-approve after 24h if not actioned. Merchants can no longer decide returns — this is the only place they're resolved.</span>
      </div>
    </div>
  );
}
