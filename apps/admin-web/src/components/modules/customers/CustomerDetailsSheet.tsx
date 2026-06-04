/**
 * CustomerDetailsSheet — drawer with full customer info + order history.
 *
 * 2026-06-03: fix multiple data bugs and stop showing fake data.
 *
 *   Bugs fixed:
 *     - Was querying `.from('orders')` (lowercase) which is not the Postgres
 *       table name. Real table is `Order` (capital O per Prisma schema).
 *     - Was using `o.amount` (a nullable Decimal that defaults to 0); now
 *       uses `o.total_amount` (the authoritative Float).
 *     - Was rendering `{customer.id}@example.com` as the email — every
 *       customer's "email" was literally <their-uuid>@example.com. Now
 *       shows the real `customer.email`.
 *     - "Years Active" used a bizarre formula; replaced with the real
 *       `days_since_signup` from the hook.
 *
 *   Adds:
 *     - Brand-red accents (no decorative blue chips)
 *     - Quick-action buttons: Send WhatsApp, View Orders, Wati history
 *     - Honest "no orders" empty state instead of an empty list
 */

import { Sheet, SheetContent, SheetTitle, SheetHeader, SheetDescription } from "../../ui/sheet";
import { Badge } from "../../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Button } from "../../ui/button";
import {
  ShoppingBag, Package, MapPin, Phone, Mail, Clock, Calendar,
  MessageCircle, History, ChevronRight,
} from "lucide-react";
import { Customer, isSyntheticEmail } from "../../../hooks/useCustomers";
import { useEffect, useState } from "react";
import api from "../../../lib/api";
import { Link } from "react-router-dom";

interface CustomerDetailsSheetProps {
  customer: Customer | null;
  isOpen:   boolean;
  onClose:  () => void;
}

interface OrderRow {
  id:           string;
  order_number: string | null;
  store_name:   string | null;
  total_amount: number | null;
  status:       string;
  created_at:   string;
}

interface AddressRow {
  id:         string;
  type:       string | null;
  address:    string | null;
  latitude:   number | null;
  longitude:  number | null;
  is_default: boolean;
  created_at: string | null;
}

function fmtINR(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return;
  const withCc = digits.length === 10 ? `91${digits}` : digits;
  window.open(`https://wa.me/${withCc}`, '_blank', 'noopener,noreferrer');
}

export function CustomerDetailsSheet({ customer, isOpen, onClose }: CustomerDetailsSheetProps) {
  const [orders,    setOrders]    = useState<OrderRow[]>([]);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    if (!customer || !isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 2026-06-04: pull orders + addresses in parallel (separate endpoints).
        const [ordersRes, addrRes] = await Promise.all([
          api.get<{ orders: OrderRow[] }>(`/admin/customers/${customer.id}/orders`),
          api.get<{ addresses: AddressRow[] }>(`/admin/customers/${customer.id}/addresses`),
        ]);
        if (!cancelled) {
          setOrders(ordersRes.data.orders ?? []);
          setAddresses(addrRes.data.addresses ?? []);
        }
      } catch (err) {
        console.error('CustomerDetailsSheet: failed to load', err);
        if (!cancelled) { setOrders([]); setAddresses([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customer, isOpen]);

  if (!customer) return null;

  const hasPhone     = customer.phone && customer.phone.length > 0;
  // 2026-06-03 (night): Customer.name is now nullable. Show muted placeholder
  // instead of crashing on .charAt(0) when name is null.
  const displayName  = customer.name ?? '(no name)';
  const initial      = customer.name ? customer.name.charAt(0).toUpperCase() : '·';
  const nameMuted    = customer.name == null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#B52725]/10 text-[#B52725] flex items-center justify-center text-2xl font-bold">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className={`text-xl truncate ${nameMuted ? 'text-gray-400 italic font-medium' : ''}`}>
                {displayName}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={customer.status === 'active'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-rose-700 bg-rose-50 border-rose-200'}>
                  {customer.status.toUpperCase()}
                </Badge>
                <span className="text-gray-400">•</span>
                <span className="text-sm font-medium">
                  LTV: <span className="text-[#B52725] font-bold">{fmtINR(customer.ltv)}</span>
                </span>
              </SheetDescription>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {hasPhone && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => openWhatsApp(customer.phone)}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to={`/customer-support?phone=${encodeURIComponent(customer.phone)}`}>
                <History className="w-4 h-4" /> Wati history
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to={`/orders?userId=${customer.id}`}>
                <ShoppingBag className="w-4 h-4" /> All orders
              </Link>
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="gap-1.5">
              <Clock className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5">
              <Package className="w-4 h-4" />
              Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="addresses" className="gap-1.5">
              <MapPin className="w-4 h-4" />
              Addresses ({addresses.length})
            </TabsTrigger>
          </TabsList>

          {/* ─── Overview tab ─── */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Contact</div>
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-1.5">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{customer.phone || 'No phone'}</span>
                </div>
                {/* Email row: hide synth `<phone>@phone.pickatstore.in` and UUID-based
                    auth-filler emails. Show only when we actually have a real one. */}
                {customer.email && !isSyntheticEmail(customer.email) && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Location & Age</div>
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-1.5">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {customer.city}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {customer.days_since_signup} day{customer.days_since_signup === 1 ? '' : 's'} since signup
                </div>
              </div>
            </div>

            <div className="p-4 border border-gray-100 rounded-lg">
              <h4 className="text-sm font-semibold mb-3">Shopping Insights</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{customer.order_count}</div>
                  <div className="text-xs text-gray-500 mt-1">Total Orders</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#B52725]">
                    {customer.order_count > 0 ? fmtINR(customer.aov) : '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Avg Order Value</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {customer.days_since_last_order == null
                      ? '—'
                      : `${customer.days_since_last_order}d`}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Since last order</div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── Orders tab ─── */}
          <TabsContent value="orders">
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#B52725] border-t-transparent rounded-full animate-spin" />
                    Loading orders…
                  </div>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  This customer hasn't placed any orders yet.
                </div>
              ) : orders.map(order => (
                <Link
                  key={order.id}
                  to={`/orders?orderId=${order.id}`}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-[#B52725] hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-[#B52725]/10 rounded-lg flex-shrink-0">
                      <ShoppingBag className="w-4 h-4 text-[#B52725]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {order.store_name ?? 'Unknown store'}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        {new Date(order.created_at).toLocaleDateString()}
                        <span>•</span>
                        <span className="truncate">#{order.order_number ?? order.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-bold text-sm text-gray-900">{fmtINR(order.total_amount)}</div>
                      <Badge variant="secondary" className="text-[10px] h-5">{order.status}</Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#B52725] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </TabsContent>

          {/* ─── Addresses tab (Q1-A) ─── */}
          <TabsContent value="addresses">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#B52725] border-t-transparent rounded-full animate-spin" />
                  Loading addresses…
                </div>
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                This customer hasn't saved any addresses yet.
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((a) => (
                  <div
                    key={a.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      a.is_default
                        ? 'border-[#B52725]/40 bg-[#B52725]/[0.03]'
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <MapPin className="w-4 h-4 text-[#B52725] mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                              {a.type || 'Address'}
                            </span>
                            {a.is_default && (
                              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#B52725] text-white">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 break-words">
                            {a.address || <span className="italic text-gray-400">No address text</span>}
                          </p>
                          {(a.latitude != null && a.longitude != null) && (
                            <a
                              href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-[#B52725] hover:underline mt-1 inline-block"
                            >
                              {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)} ↗
                            </a>
                          )}
                        </div>
                      </div>
                      {a.created_at && (
                        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
