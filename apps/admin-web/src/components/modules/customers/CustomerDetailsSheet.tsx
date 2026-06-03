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
import { Customer } from "../../../hooks/useCustomers";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
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
  const [orders,  setOrders]  = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer || !isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // 2026-06-03: was `.from('orders')` — wrong table name. Real table is `Order`.
      const { data, error } = await supabase
        .from('Order')
        .select('id, order_number, store_name, total_amount, status, created_at')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('CustomerDetailsSheet: failed to load orders', error);
        setOrders([]);
      } else {
        setOrders((data ?? []) as OrderRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [customer, isOpen]);

  if (!customer) return null;

  const hasPhone = customer.phone && customer.phone !== 'N/A';

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#B52725]/10 text-[#B52725] flex items-center justify-center text-2xl font-bold">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate">{customer.name}</SheetTitle>
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
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{customer.email || 'No email'}</span>
                </div>
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
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
