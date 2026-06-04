/**
 * MerchantDetailsSheet — admin drawer for a single merchant.
 *
 * 2026-06-04: aligned to the admin design system (see docs/admin-design-system.md).
 *   - Brand red #B52725, no decorative gradients, no rounded-2xl/3xl
 *   - Removed emerald/teal/indigo accent system, blur orbs, hover transforms
 *   - Orders fetch migrated from `supabase.from('orders').eq('store_id', …)`
 *     (RLS-blocked) to GET /admin/merchants/:id/orders (Prisma + service role)
 *   - Order display uses real `total_amount` + `order_number` + UPPERCASE
 *     OrderStatus enum (was lowercase demo values)
 */

import { Sheet, SheetContent, SheetTitle } from '../../ui/sheet';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  Store, MapPin, Phone, Mail, History, ShoppingCart, Star, Package,
  IndianRupee, FileText, Image as ImageIcon,
} from 'lucide-react';
import { Merchant, useMerchants } from '../../../hooks/useMerchants';
import { StoreProductTable } from './StoreProductTable';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';

interface MerchantDetailsSheetProps {
  merchant: Merchant | null;
  isOpen: boolean;
  onClose: () => void;
}

interface RecentOrder {
  id:            string;
  order_number:  string | null;
  customer_name: string | null;
  total_amount:  number;
  status:        string;
  created_at:    string;
  items_count:   number | null;
  order_type:    string | null;
}

const BRAND_RED = '#B52725';

const STATUS_STYLES: Record<string, string> = {
  PENDING:          'bg-gray-100 text-gray-700 border-gray-200',
  CONFIRMED:        'bg-blue-50 text-blue-700 border-blue-200',
  PREPARING:        'bg-amber-50 text-amber-700 border-amber-200',
  READY:            'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED:        'bg-rose-50 text-rose-700 border-rose-200',
  RETURN_REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  RETURN_APPROVED:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURN_REJECTED:  'bg-rose-50 text-rose-700 border-rose-200',
  REFUNDED:         'bg-violet-50 text-violet-700 border-violet-200',
};

function fmtINR(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function statusLabel(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function MerchantDetailsSheet({ merchant, isOpen, onClose }: MerchantDetailsSheetProps) {
  const { getMerchantStats } = useMerchants();
  const [orders,  setOrders]  = useState<RecentOrder[]>([]);
  const [stats,   setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!merchant || !isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ordersRes, realStats] = await Promise.all([
          api.get<{ orders: RecentOrder[] }>(`/admin/merchants/${merchant.id}/orders?limit=25`),
          getMerchantStats(merchant.id),
        ]);
        if (cancelled) return;
        setOrders(ordersRes.data.orders ?? []);
        setStats(realStats);
      } catch (err) {
        console.error('MerchantDetailsSheet load error:', err);
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [merchant, isOpen, getMerchantStats]);

  if (!merchant) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[700px] p-0 flex flex-col h-full bg-white">
        <div className="flex-1 overflow-y-auto">
          {/* ─── Header ─── */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-sm shrink-0">
                <Store className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl font-bold text-gray-900 truncate">
                  {merchant.store_name ?? '(unnamed store)'}
                </SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      merchant.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }
                  >
                    {(merchant.status || 'unknown').toUpperCase()}
                  </Badge>
                  {(merchant.rating ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      <Star className="w-3 h-3 fill-current" />
                      {merchant.rating}
                    </span>
                  )}
                  {merchant.city && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      {merchant.city}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="overview" className="gap-1.5">
                  <Store className="w-4 h-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="orders" className="gap-1.5">
                  <ShoppingCart className="w-4 h-4" />
                  Recent Orders ({orders.length})
                </TabsTrigger>
                <TabsTrigger value="inventory" className="gap-1.5">
                  <Package className="w-4 h-4" />
                  Inventory
                </TabsTrigger>
              </TabsList>

              {/* ─── Overview ─── */}
              <TabsContent value="overview" className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Owner */}
                  <div className="bg-white border border-gray-100 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#B52725]" />
                      Owner
                    </h3>
                    <div className="space-y-2">
                      <div className="text-base font-medium text-gray-900">
                        {merchant.owner_name || <span className="italic text-gray-400">No owner name</span>}
                      </div>
                      {merchant.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {merchant.phone}
                        </div>
                      )}
                      {merchant.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span className="truncate">{merchant.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="bg-white border border-gray-100 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#B52725]" />
                      Store Address
                    </h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {merchant.address || <span className="italic text-gray-400">No address on file</span>}
                    </p>
                  </div>
                </div>

                {/* Compliance */}
                <div className="bg-white border border-gray-100 rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#B52725]" />
                      Compliance & Documents
                    </h3>
                    {merchant.turnover_range && (
                      <span className="text-[11px] text-gray-500">
                        Turnover: <span className="font-semibold text-gray-700">{merchant.turnover_range}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ComplianceField label="PAN"   value={merchant.pan_number} />
                    <ComplianceField label="Aadhaar" value={merchant.aadhar_number} />
                    <ComplianceField label="GSTIN" value={merchant.gst_number} />
                    <ComplianceField
                      label="Bank A/C"
                      value={merchant.bank_account_number
                        ? merchant.bank_account_number.slice(-4).padStart(8, '*')
                        : null}
                    />
                  </div>

                  {/* Document links — neutral pill style, brand-red text */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <DocLink url={merchant.pan_doc_url}        label="PAN" />
                    <DocLink url={merchant.aadhar_front_url}   label="Aadhaar Front" />
                    <DocLink url={merchant.aadhar_back_url}    label="Aadhaar Back" />
                    <DocLink url={merchant.gst_certificate_url} label="GST Certificate" />
                  </div>

                  {/* Store photos */}
                  {merchant.store_photos && merchant.store_photos.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        Store Photos ({merchant.store_photos.length})
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {merchant.store_photos.map((url: string, i: number) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-24 h-24 rounded-lg border border-gray-100 overflow-hidden flex-shrink-0 hover:border-[#B52725] transition-colors"
                          >
                            <img src={url} alt={`Store ${i + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Performance — 30d stats from getMerchantStats RPC */}
                <div className="bg-white border border-gray-100 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-[#B52725]" />
                    Performance — Last 30 days
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <Metric label="Orders" value={stats?.orders_30d ?? 0} />
                    <Metric
                      label="Avg Order Value"
                      value={fmtINR(stats?.avg_order_value)}
                    />
                    <Metric
                      label="Revenue"
                      value={fmtINR(stats?.gmv_30d)}
                      accent
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ─── Recent Orders ─── */}
              <TabsContent value="orders">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#B52725] border-t-transparent rounded-full animate-spin" />
                      Loading orders…
                    </div>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-10 text-sm text-gray-500">
                    This store hasn't taken any orders yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#B52725]/10 flex items-center justify-center flex-shrink-0">
                            <ShoppingCart className="w-4 h-4 text-[#B52725]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 font-mono">
                              {order.order_number ?? `#${order.id.slice(0, 8)}`}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {order.customer_name ?? 'Unknown customer'}
                              {' · '}
                              {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-[#B52725]">{fmtINR(order.total_amount)}</div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] mt-1 ${STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING}`}
                          >
                            {statusLabel(order.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ─── Inventory ─── */}
              <TabsContent value="inventory" className="min-h-[400px]">
                <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                  <StoreProductTable storeId={merchant.id} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <span className="hidden">{BRAND_RED}</span>
      </SheetContent>
    </Sheet>
  );
}

// ───────────────────────────────────────────────────────────── Subcomponents

function ComplianceField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-medium text-gray-900">
        {value && value.length > 0 ? value : <span className="italic text-gray-400">N/A</span>}
      </div>
    </div>
  );
}

function DocLink({ url, label }: { url: string | null | undefined; label: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-[#B52725] bg-[#B52725]/10 px-2.5 py-1 rounded-md border border-[#B52725]/20 hover:bg-[#B52725]/15 transition-colors"
    >
      <FileText className="w-3 h-3" />
      {label}
    </a>
  );
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${accent ? 'text-[#B52725]' : 'text-gray-900'}`}>{value}</div>
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

// Unused-import safety
const _unused = IndianRupee;
void _unused;
