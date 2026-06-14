/**
 * Refunds & Disputes — Operations + Finance surface.
 *
 * 2026-06-14: built out. Surfaces two money-risk queues from GET /admin/disputes:
 *   - Pending refunds  — cancelled + paid orders not yet refunded
 *   - Stranded payments — charged but payment-coherence failed (held)
 * Each row can issue a REAL Razorpay refund via POST /admin/orders/:id/refund
 * (guarded: confirm dialog + idempotent + audit-logged; only marks the order
 * REFUNDED when Razorpay confirms).
 */

import { useEffect, useState } from 'react';
import { RefreshCcw, AlertTriangle, Loader2, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../ui/button';

interface DisputeOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  isPaid: boolean;
  storeName: string | null;
  createdAt: string;
  paymentVerified: boolean | null;
  hasPaymentId: boolean;
  customer: { name: string | null } | null;
}

export function RefundsDisputes() {
  const [data, setData] = useState<{ strandedPayments: DisputeOrder[]; pendingRefunds: DisputeOrder[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/disputes')
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const doRefund = async (o: DisputeOrder) => {
    if (!o.hasPaymentId) {
      toast.error('No Razorpay payment id on this order — it must be refunded manually.');
      return;
    }
    if (!window.confirm(`Issue a REAL Razorpay refund of ₹${Math.round(o.totalAmount)} for order ${o.orderNumber}?\n\nThis moves money back to the customer and cannot be undone.`)) return;
    setRefunding(o.id);
    try {
      const { data: r } = await api.post(`/admin/orders/${o.id}/refund`, { reason: 'Admin refund (Refunds & Disputes)' });
      toast.success(`Refunded ₹${r.amountInr} · Razorpay ${r.refundId}`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Refund failed');
    } finally {
      setRefunding(null);
    }
  };

  const Section = ({ title, subtitle, rows, tone }: { title: string; subtitle: string; rows: DisputeOrder[]; tone: 'amber' | 'red' }) => (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded ${tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">Nothing here — all clear.</div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[440px] overflow-auto">
          {rows.map((o) => (
            <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-gray-50">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{o.orderNumber} · ₹{Math.round(o.totalAmount).toLocaleString('en-IN')}</div>
                <div className="text-xs text-gray-500 truncate">
                  {o.customer?.name || 'Customer'} · {o.storeName || 'Store'} · {o.createdAt ? format(new Date(o.createdAt), 'dd MMM, HH:mm') : ''}
                  {!o.hasPaymentId && <span className="ml-2 text-amber-600">· no payment id</span>}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs text-[#B52725] border-[#B52725]/30 hover:bg-[#B52725]/5 shrink-0"
                disabled={refunding === o.id || !o.hasPaymentId}
                onClick={() => doRefund(o)}
                title={!o.hasPaymentId ? 'No payment id — refund manually' : 'Issue a real Razorpay refund'}
              >
                {refunding === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><IndianRupee className="w-3.5 h-3.5 mr-1" />Refund</>}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
            <RefreshCcw className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Refunds &amp; Disputes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Stranded payments + pending refunds — issue refunds with one click</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section
            title="Pending refunds"
            subtitle="Cancelled + paid orders not yet refunded"
            rows={data?.pendingRefunds ?? []}
            tone="red"
          />
          <Section
            title="Stranded payments"
            subtitle="Charged but payment-coherence failed (held from settlement)"
            rows={data?.strandedPayments ?? []}
            tone="amber"
          />
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-gray-500 bg-amber-50/50 border border-amber-100 rounded-lg p-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>Refunds issue a <strong>real Razorpay refund</strong> and are recorded in the admin audit trail. Orders without a Razorpay payment id must be refunded manually from the Razorpay dashboard.</span>
      </div>
    </div>
  );
}
