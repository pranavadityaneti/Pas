/**
 * Global Order Manager (admin) — /orders
 *
 * 2026-06-03 (night): post-audit rewrite. The page was built against the
 * legacy lowercase `orders` table + a 5-state demo enum (pending /
 * processing / completed / cancelled / disputed). Production uses the
 * capital-O `"Order"` table + a 6-state real enum (PENDING / CONFIRMED /
 * READY / COMPLETED / CANCELLED / REFUNDED). The hook fix (useOrders.ts)
 * is what makes data actually load — this file rebuilds the UI around it.
 *
 * Notable cleanups:
 *   - Status tabs collapsed to All / Active / Completed / Cancelled /
 *     Refunded. "Active" groups PENDING + CONFIRMED + READY.
 *   - "Disputed" tab dropped entirely. Refunds + disputes live on the
 *     dedicated /refunds-disputes page (founder decision).
 *   - SLA Timer column dropped — `sla_minutes` only exists on the legacy
 *     table; production doesn't track SLA. Replaced with Items column.
 *   - Order ID column shows `order_number` (human-readable, e.g. PAS-…)
 *     instead of a UUID prefix.
 *   - Amount uses `total_amount` (authoritative Float). Was `amount`
 *     (Decimal, often 0).
 *   - Fake Driver / Delivery block removed from the drawer — PAS is
 *     pickup-only; "Looking for drivers… Zone: Indiranagar - High Demand"
 *     was pure mock.
 *   - Fake hardcoded order timeline ("10:45 AM" etc.) removed. Shows the
 *     real placed-at timestamp.
 *   - Customer-row and Store-row clicks: reconstructing fake
 *     Customer/Merchant objects with hardcoded "Hyderabad" / "active" /
 *     "approved" was creating misleading sheets. Now we navigate to
 *     /customers and /merchants instead — clean separation.
 *   - Decorative indigo→blue gradient + indigo hover colors replaced
 *     with brand red.
 *   - Deep-link respects `?userId=X` query param so the "View orders"
 *     action from the Customers page actually filters.
 *
 *   API-side order creation flow in apps/api/src/index.ts (POST /orders)
 *   plus the 4-layer FK-race hardening landed 2026-05-29 are NOT touched.
 *   This file is admin-read/admin-write only.
 */

import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Download, MoreHorizontal, Clock, CheckCircle, XCircle, User,
  RefreshCcw, ShoppingCart, Package, MessageCircle,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '../../ui/sheet';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { cn } from '../../ui/utils';
import { useOrders, Order, OrderStatus } from '../../../hooks/useOrders';

const BRAND_RED = '#B52725';

const getTimeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

type TabKey = 'all' | 'active' | 'completed' | 'cancelled' | 'refunded';

const ACTIVE_STATUSES = new Set<OrderStatus>(['PENDING', 'CONFIRMED', 'READY']);

function statusMatches(status: OrderStatus, tab: TabKey): boolean {
  if (tab === 'all')        return true;
  if (tab === 'active')     return ACTIVE_STATUSES.has(status);
  if (tab === 'completed')  return status === 'COMPLETED';
  if (tab === 'cancelled')  return status === 'CANCELLED';
  if (tab === 'refunded')   return status === 'REFUNDED';
  return false;
}

export function OrderManager() {
  const [searchParams] = useSearchParams();
  const userIdFilter = searchParams.get('userId');

  // 2026-06-03 night: useOrders now hits GET /admin/orders. Server-side
  // userId filter so we don't pull the whole table just to slice on client.
  const { orders, loading, fetchOrders, updateOrderStatus } = useOrders(userIdFilter);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSheetOpen,   setIsSheetOpen]   = useState(false);
  const [activeTab,     setActiveTab]     = useState<TabKey>('all');

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const filteredOrders = useMemo(() =>
    orders.filter(o => statusMatches(o.status, activeTab)),
    [orders, activeTab],
  );

  // Counts per tab (for the badges) — the userId filter is already applied
  // server-side so we only filter by status here.
  const tabCount = (tab: TabKey) =>
    orders.filter(o => statusMatches(o.status, tab)).length;

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
            <ShoppingCart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Global Order Manager</h1>
            <p className="text-sm text-gray-500 font-medium">
              Live orders across every store.
              {userIdFilter && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-[#B52725]">
                  Filtered to one customer
                  <Link to="/orders" className="underline ml-1">clear</Link>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status tabs */}
          <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
            {([
              { k: 'all',       label: 'All' },
              { k: 'active',    label: 'Active' },
              { k: 'completed', label: 'Completed' },
              { k: 'cancelled', label: 'Cancelled' },
              { k: 'refunded',  label: 'Refunded' },
            ] as { k: TabKey; label: string }[]).map((t, i) => (
              <span key={t.k} className="flex items-center">
                {i > 0 && <span className="w-px h-4 bg-gray-200 mx-0.5" />}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'gap-1.5 rounded-lg transition-all text-xs',
                    activeTab === t.k
                      ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-md'
                      : 'text-gray-600 hover:text-[#B52725] hover:bg-gray-50'
                  )}
                  onClick={() => setActiveTab(t.k)}
                >
                  {t.label}
                  <span className="text-[10px] opacity-70 ml-1">{tabCount(t.k)}</span>
                </Button>
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-gray-600 hover:text-[#B52725]"
              onClick={fetchOrders}
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </Button>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-gray-600 hover:text-[#B52725]"
              disabled
              title="CSV export — coming soon"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Main table ─── */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[140px]">Order #</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-20 text-gray-500">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#B52725] border-t-transparent rounded-full animate-spin" />
                      Loading live orders…
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-20 text-gray-500">
                    {userIdFilter ? 'No orders for this customer yet.' : 'No orders match this filter.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleOrderClick(order)}
                  >
                    <TableCell className="font-medium text-[#B52725] font-mono text-xs">
                      {order.order_number ?? `#${order.id.slice(0, 8)}`}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">{getTimeAgo(order.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">
                          {order.customer_name ?? <span className="italic text-gray-400">(no name)</span>}
                        </span>
                        <span className="text-xs text-gray-500">{order.customer_phone ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-700 text-sm">{order.store_name ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={order.status} />
                    </TableCell>
                    <TableCell className="text-right text-gray-700">
                      {order.items_count ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-[#B52725]">
                      {fmtINR(order.total_amount)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOrderClick(order); }}>
                            View details
                          </DropdownMenuItem>
                          {order.user_id && (
                            <DropdownMenuItem asChild>
                              <Link to={`/customers?id=${order.user_id}`}>
                                <User className="w-4 h-4 mr-2" /> Open customer
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {order.customer_phone && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                const digits = order.customer_phone!.replace(/\D/g, '');
                                if (digits) {
                                  const withCc = digits.length === 10 ? `91${digits}` : digits;
                                  window.open(`https://wa.me/${withCc}`, '_blank', 'noopener,noreferrer');
                                }
                              }}
                            >
                              <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp customer
                            </DropdownMenuItem>
                          )}
                          {ACTIVE_STATUSES.has(order.status) && (
                            <DropdownMenuItem
                              className="text-rose-600"
                              onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'CANCELLED'); }}
                            >
                              <XCircle className="w-4 h-4 mr-2" /> Force cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ─── Side Drawer — order detail ─── */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-mono">
                {selectedOrder?.order_number ?? `#${selectedOrder?.id.slice(0, 8)}`}
              </SheetTitle>
              {selectedOrder && <StatusPill status={selectedOrder.status} />}
            </div>
            <SheetDescription>
              {selectedOrder && `Placed ${new Date(selectedOrder.created_at).toLocaleString('en-IN')}`}
            </SheetDescription>
          </SheetHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                  <User className="w-4 h-4" /> Customer
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-medium">{selectedOrder.customer_name ?? '(no name)'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-medium">{selectedOrder.customer_phone ?? '—'}</p>
                  </div>
                </div>
                {selectedOrder.user_id && (
                  <Button asChild size="sm" variant="outline" className="mt-2 gap-2">
                    <Link to={`/customers?id=${selectedOrder.user_id}`}>
                      <User className="w-3.5 h-3.5" /> Open customer
                    </Link>
                  </Button>
                )}
              </div>

              {/* Store */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4" /> Store
                </h3>
                <p className="text-sm font-medium">{selectedOrder.store_name ?? '—'}</p>
                {selectedOrder.store_id && (
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <Link to={`/merchants?id=${selectedOrder.store_id}`}>
                      <Package className="w-3.5 h-3.5" /> Open store
                    </Link>
                  </Button>
                )}
              </div>

              {/* Order Summary */}
              <div className="border border-gray-100 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4" /> Summary
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xs text-gray-500">Items</div>
                    <div className="text-lg font-bold text-gray-900">{selectedOrder.items_count ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Amount</div>
                    <div className="text-lg font-bold text-[#B52725]">{fmtINR(selectedOrder.total_amount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Type</div>
                    <div className="text-sm font-medium text-gray-900 mt-1.5">{selectedOrder.order_type ?? 'pickup'}</div>
                  </div>
                </div>
                {selectedOrder.cancelled_reason && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Cancellation reason</p>
                    <p className="text-sm text-gray-700 mt-1">{selectedOrder.cancelled_reason}</p>
                  </div>
                )}
              </div>

              {/* Status actions */}
              {ACTIVE_STATUSES.has(selectedOrder.status) && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'COMPLETED')}
                  >
                    Force complete
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'CANCELLED')}
                  >
                    Force cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          <SheetFooter className="mt-8">
            <Button variant="ghost" onClick={() => setIsSheetOpen(false)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <span className="hidden">{BRAND_RED}</span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Status pill

function StatusPill({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING:   'bg-gray-100 text-gray-700 border-gray-200',
    CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
    READY:     'bg-emerald-50 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-amber-50 text-amber-700 border-amber-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
    REFUNDED:  'bg-violet-50 text-violet-700 border-violet-200',
  };
  const icons: Record<OrderStatus, typeof Clock> = {
    PENDING:   Clock,
    CONFIRMED: CheckCircle,
    READY:     CheckCircle,
    COMPLETED: CheckCircle,
    CANCELLED: XCircle,
    REFUNDED:  RefreshCcw,
  };
  const Icon = icons[status];
  const cls  = styles[status];
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}
