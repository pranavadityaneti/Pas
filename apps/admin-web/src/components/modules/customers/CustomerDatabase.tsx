/**
 * Customer Database (admin)
 *
 * 2026-06-03 (night): post-audit fixes —
 *   - Customer column: stop showing synthesized emails / UUIDs as "names".
 *     Real name → shown. No real name → muted "(no name)" + phone shines
 *     through in the Contact column.
 *   - Contact column: phone only. Synthesized emails removed entirely.
 *   - Expanded filter dropdown — Status / City / Order Activity / Last
 *     Activity / Spend Tier / Signup Recency / Data Quality.
 *   - Search no longer matches against the synthesized email; matches
 *     name + phone + city + ID.
 *
 *   The "0 orders / ₹0 LTV / Unknown city" issue was fixed at the data
 *   layer (useCustomers.ts) — it was the lowercase-`orders` vs capital-
 *   `Order` table bug. See header comment in that file.
 */

import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Filter, MoreHorizontal, History, Ban, MapPin, Users, Download,
  ChevronDown, MessageCircle, ShoppingBag, CheckCircle2, Eye,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
} from '../../ui/dropdown-menu';
import { CustomerDetailsSheet } from './CustomerDetailsSheet';
import { useCustomers, Customer } from '../../../hooks/useCustomers';

const BRAND_RED = '#B52725';

function fmtINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function recencyBadge(days: number | null): { label: string; classes: string } {
  if (days == null) return { label: 'No orders',    classes: 'bg-gray-100 text-gray-600 border-gray-200' };
  if (days === 0)   return { label: 'Today',        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (days <= 7)    return { label: `${days}d ago`, classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (days <= 30)   return { label: `${days}d ago`, classes: 'bg-amber-50 text-amber-700 border-amber-200' };
  return                   { label: `${days}d ago`, classes: 'bg-rose-50 text-rose-700 border-rose-200' };
}

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return;
  const withCc = digits.length === 10 ? `91${digits}` : digits;
  window.open(`https://wa.me/${withCc}`, '_blank', 'noopener,noreferrer');
}

// ────────────────────────────────────────── Filter bucket definitions

const ORDER_ACTIVITY_BUCKETS = [
  { key: 'none',     label: '0 orders',     match: (c: Customer) => c.order_count === 0 },
  { key: 'low',      label: '1-2 orders',   match: (c: Customer) => c.order_count >= 1 && c.order_count <= 2 },
  { key: 'mid',      label: '3-10 orders',  match: (c: Customer) => c.order_count >= 3 && c.order_count <= 10 },
  { key: 'high',     label: '10+ orders',   match: (c: Customer) => c.order_count > 10 },
] as const;

const LAST_ACTIVITY_BUCKETS = [
  { key: 'fresh',    label: 'Active (≤7d)',     match: (c: Customer) => c.days_since_last_order != null && c.days_since_last_order <= 7 },
  { key: 'cooling',  label: 'Cooling (8-30d)',  match: (c: Customer) => c.days_since_last_order != null && c.days_since_last_order > 7 && c.days_since_last_order <= 30 },
  { key: 'cold',     label: 'At-risk (>30d)',   match: (c: Customer) => c.days_since_last_order != null && c.days_since_last_order > 30 },
  { key: 'never',    label: 'Never ordered',    match: (c: Customer) => c.days_since_last_order == null },
] as const;

const SPEND_BUCKETS = [
  { key: 'zero',     label: '₹0',           match: (c: Customer) => c.ltv === 0 },
  { key: 'small',    label: '< ₹500',       match: (c: Customer) => c.ltv > 0    && c.ltv < 500 },
  { key: 'mid',      label: '₹500-2K',      match: (c: Customer) => c.ltv >= 500 && c.ltv < 2000 },
  { key: 'high',     label: '₹2K-10K',      match: (c: Customer) => c.ltv >= 2000 && c.ltv < 10000 },
  { key: 'vip',      label: '₹10K+',        match: (c: Customer) => c.ltv >= 10000 },
] as const;

const SIGNUP_BUCKETS = [
  { key: 'week',     label: 'This week',          match: (c: Customer) => c.days_since_signup <= 7 },
  { key: 'month',    label: 'This month',         match: (c: Customer) => c.days_since_signup <= 30 },
  { key: '3months',  label: 'Last 3 months',      match: (c: Customer) => c.days_since_signup > 30  && c.days_since_signup <= 90 },
  { key: 'older',    label: 'Older than 3 months',match: (c: Customer) => c.days_since_signup > 90 },
] as const;

const QUALITY_BUCKETS = [
  { key: 'named',    label: 'Has name',         match: (c: Customer) => c.name != null && c.name.trim().length > 0 },
  { key: 'unnamed',  label: 'Missing name',     match: (c: Customer) => c.name == null || c.name.trim().length === 0 },
  { key: 'hasphone', label: 'Has phone',        match: (c: Customer) => c.phone.length > 0 },
  { key: 'nophone',  label: 'Missing phone',    match: (c: Customer) => c.phone.length === 0 },
] as const;

// ──────────────────────────────────────────────────────────────────────

export function CustomerDatabase() {
  const { customers, loading, fetchCustomers, blockCustomer, unblockCustomer } = useCustomers();
  const [searchTerm,       setSearchTerm]       = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // 2026-06-04 (Q1 fix): deep-link support for /customers?id=<userId>.
  // Used by OrderManager's "Open customer" dropdown action so clicking it
  // actually pops the drawer instead of just landing on the list page.
  // After we open the drawer we replace the URL to drop the param — that
  // way closing the drawer leaves the user on a clean /customers, and a
  // refresh doesn't auto-reopen.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (!idFromUrl || customers.length === 0) return;
    const match = customers.find(c => c.id === idFromUrl);
    if (match) {
      setSelectedCustomer(match);
      // Replace history so the param is gone but back/forward still works.
      setSearchParams({}, { replace: true });
    }
    // If no match (e.g. the customer was suspended into a different bucket or
    // doesn't exist), we silently ignore — page still shows the list.
  }, [searchParams, customers, setSearchParams]);

  // Filter state (each a Set of selected bucket keys)
  const [filterStatus,   setFilterStatus]   = useState<string[]>([]);
  const [filterCity,     setFilterCity]     = useState<string[]>([]);
  const [filterActivity, setFilterActivity] = useState<string[]>([]);
  const [filterRecency,  setFilterRecency]  = useState<string[]>([]);
  const [filterSpend,    setFilterSpend]    = useState<string[]>([]);
  const [filterSignup,   setFilterSignup]   = useState<string[]>([]);
  const [filterQuality,  setFilterQuality]  = useState<string[]>([]);

  const cities = useMemo(
    () => [...new Set(customers.map(c => c.city))].filter(Boolean).sort(),
    [customers],
  );

  const totalCount   = customers.length;
  const activeCount  = customers.filter(c => c.status === 'active').length;
  const suspendCount = customers.filter(c => c.status === 'suspended').length;

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return customers.filter(c => {
      // Search: name + phone + city + ID. Do NOT match against synthesized email.
      const matchesSearch = !term
        || (c.name && c.name.toLowerCase().includes(term))
        || c.phone.includes(term)
        || c.city.toLowerCase().includes(term)
        || c.id.toLowerCase().includes(term);

      const matchesStatus   = filterStatus.length   === 0 || filterStatus.includes(c.status);
      const matchesCity     = filterCity.length     === 0 || filterCity.includes(c.city);
      const matchesActivity = filterActivity.length === 0 || ORDER_ACTIVITY_BUCKETS.some(b => filterActivity.includes(b.key) && b.match(c));
      const matchesRecency  = filterRecency.length  === 0 || LAST_ACTIVITY_BUCKETS.some(b => filterRecency.includes(b.key)  && b.match(c));
      const matchesSpend    = filterSpend.length    === 0 || SPEND_BUCKETS.some(b => filterSpend.includes(b.key) && b.match(c));
      const matchesSignup   = filterSignup.length   === 0 || SIGNUP_BUCKETS.some(b => filterSignup.includes(b.key) && b.match(c));
      const matchesQuality  = filterQuality.length  === 0 || QUALITY_BUCKETS.some(b => filterQuality.includes(b.key) && b.match(c));

      return matchesSearch && matchesStatus && matchesCity
        && matchesActivity && matchesRecency
        && matchesSpend && matchesSignup && matchesQuality;
    });
  }, [
    customers, searchTerm, filterStatus, filterCity,
    filterActivity, filterRecency, filterSpend, filterSignup, filterQuality,
  ]);

  const activeFilterCount =
    filterStatus.length + filterCity.length + filterActivity.length
    + filterRecency.length + filterSpend.length + filterSignup.length + filterQuality.length;

  const clearAllFilters = () => {
    setFilterStatus([]); setFilterCity([]); setFilterActivity([]);
    setFilterRecency([]); setFilterSpend([]); setFilterSignup([]); setFilterQuality([]);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Base</h1>
            <p className="text-sm text-gray-500 font-medium">Manage customer accounts and support actions.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-gray-600 hover:text-[#B52725]"
              onClick={fetchCustomers}
            >
              <Download className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Totals strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <TotalsTile label="Total Customers" value={totalCount}    color="brand" />
        <TotalsTile label="Active"          value={activeCount}   color="good" />
        <TotalsTile label="Suspended"       value={suspendCount}  color={suspendCount > 0 ? 'warn' : 'neutral'} />
      </div>

      {/* ─── Table card ─── */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name, phone, city, or ID…"
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-[#B52725]/10 text-[#B52725]">
                      {activeFilterCount}
                    </Badge>
                  )}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 max-h-[480px] overflow-y-auto">
                {/* Status */}
                <DropdownMenuLabel>Account Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['active', 'suspended'] as const).map(s => (
                  <DropdownMenuCheckboxItem key={s}
                    checked={filterStatus.includes(s)}
                    onCheckedChange={(checked) => setFilterStatus(prev => checked ? [...prev, s] : prev.filter(x => x !== s))}
                    className="capitalize">
                    {s}
                  </DropdownMenuCheckboxItem>
                ))}

                {/* Order Activity */}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Order Activity</DropdownMenuLabel>
                {ORDER_ACTIVITY_BUCKETS.map(b => (
                  <DropdownMenuCheckboxItem key={b.key}
                    checked={filterActivity.includes(b.key)}
                    onCheckedChange={(checked) => setFilterActivity(prev => checked ? [...prev, b.key] : prev.filter(x => x !== b.key))}>
                    {b.label}
                  </DropdownMenuCheckboxItem>
                ))}

                {/* Last Activity */}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Last Activity</DropdownMenuLabel>
                {LAST_ACTIVITY_BUCKETS.map(b => (
                  <DropdownMenuCheckboxItem key={b.key}
                    checked={filterRecency.includes(b.key)}
                    onCheckedChange={(checked) => setFilterRecency(prev => checked ? [...prev, b.key] : prev.filter(x => x !== b.key))}>
                    {b.label}
                  </DropdownMenuCheckboxItem>
                ))}

                {/* Spend Tier */}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Spend Tier (LTV)</DropdownMenuLabel>
                {SPEND_BUCKETS.map(b => (
                  <DropdownMenuCheckboxItem key={b.key}
                    checked={filterSpend.includes(b.key)}
                    onCheckedChange={(checked) => setFilterSpend(prev => checked ? [...prev, b.key] : prev.filter(x => x !== b.key))}>
                    {b.label}
                  </DropdownMenuCheckboxItem>
                ))}

                {/* Signup Recency */}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Signup Recency</DropdownMenuLabel>
                {SIGNUP_BUCKETS.map(b => (
                  <DropdownMenuCheckboxItem key={b.key}
                    checked={filterSignup.includes(b.key)}
                    onCheckedChange={(checked) => setFilterSignup(prev => checked ? [...prev, b.key] : prev.filter(x => x !== b.key))}>
                    {b.label}
                  </DropdownMenuCheckboxItem>
                ))}

                {/* Data Quality */}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Profile Quality</DropdownMenuLabel>
                {QUALITY_BUCKETS.map(b => (
                  <DropdownMenuCheckboxItem key={b.key}
                    checked={filterQuality.includes(b.key)}
                    onCheckedChange={(checked) => setFilterQuality(prev => checked ? [...prev, b.key] : prev.filter(x => x !== b.key))}>
                    {b.label}
                  </DropdownMenuCheckboxItem>
                ))}

                {/* City */}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>City</DropdownMenuLabel>
                {cities.length === 0
                  ? <div className="px-2 py-1 text-xs text-gray-500">No cities yet</div>
                  : cities.map(city => (
                      <DropdownMenuCheckboxItem key={city}
                        checked={filterCity.includes(city)}
                        onCheckedChange={(checked) => setFilterCity(prev => checked ? [...prev, city] : prev.filter(c => c !== city))}>
                        {city}
                      </DropdownMenuCheckboxItem>
                    ))
                }

                {/* Clear */}
                {activeFilterCount > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearAllFilters} className="text-[#B52725] font-medium">
                      Clear all filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="text-sm text-gray-500 font-medium">
            {filteredCustomers.length} of {totalCount}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">AOV</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead>Last Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-20 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#B52725] border-t-transparent rounded-full animate-spin" />
                      Reading customer records…
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-20 text-gray-500">
                    No customers found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => {
                  const recency      = recencyBadge(customer.days_since_last_order);
                  const displayName  = customer.name ?? '(no name)';
                  const nameMuted    = customer.name == null;
                  return (
                    <TableRow
                      key={customer.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <TableCell onClick={() => setSelectedCustomer(customer)} className="cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-400">
                              {customer.name ? customer.name.charAt(0).toUpperCase() : '·'}
                            </span>
                          </div>
                          <div>
                            <p className={`font-semibold ${nameMuted ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                              {displayName}
                              {customer.role && customer.role !== 'CONSUMER' && (
                                <span
                                  className="ml-2 inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 align-middle"
                                  title={`This buyer's account role is ${customer.role} — surfaced because they placed at least one order.`}
                                >
                                  {customer.role}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">ID: {customer.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setSelectedCustomer(customer)} className="cursor-pointer">
                        {customer.phone
                          ? <span className="text-sm text-gray-700">{customer.phone}</span>
                          : <span className="text-xs italic text-gray-400">no phone</span>}
                      </TableCell>
                      <TableCell onClick={() => setSelectedCustomer(customer)} className="cursor-pointer">
                        <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {customer.city}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-gray-700">
                        {customer.order_count.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-right text-gray-700">
                        {customer.order_count > 0 && customer.aov > 0 ? fmtINR(customer.aov) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-[#B52725]">{fmtINR(customer.ltv)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${recency.classes} text-[11px] font-medium`}>
                          {recency.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={customer.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                          }
                        >
                          {customer.status === 'active' ? 'Active' : 'Suspended'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="w-4 h-4 text-gray-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-[11px] text-gray-500">
                              {customer.name ?? customer.phone ?? customer.id.slice(0, 8)}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSelectedCustomer(customer)}>
                              <Eye className="w-4 h-4 mr-2" /> View details
                            </DropdownMenuItem>
                            {customer.phone && (
                              <DropdownMenuItem onClick={() => openWhatsApp(customer.phone)}>
                                <MessageCircle className="w-4 h-4 mr-2" /> Send WhatsApp
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                              <Link to={`/orders?userId=${customer.id}`}>
                                <ShoppingBag className="w-4 h-4 mr-2" /> View orders
                              </Link>
                            </DropdownMenuItem>
                            {customer.phone && (
                              <DropdownMenuItem asChild>
                                <Link to={`/customer-support?phone=${encodeURIComponent(customer.phone)}`}>
                                  <History className="w-4 h-4 mr-2" /> Wati history
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {customer.status === 'active' ? (
                              <DropdownMenuItem
                                className="text-rose-600 focus:text-rose-700"
                                onClick={() => blockCustomer(customer.id)}
                              >
                                <Ban className="w-4 h-4 mr-2" /> Suspend account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-emerald-600 focus:text-emerald-700"
                                onClick={() => unblockCustomer(customer.id)}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Reactivate account
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CustomerDetailsSheet
        customer={selectedCustomer}
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />

      <span className="hidden">{BRAND_RED}</span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Totals tile

function TotalsTile({
  label, value, color,
}: {
  label: string;
  value: number;
  color: 'brand' | 'good' | 'warn' | 'neutral';
}) {
  const numClass =
    color === 'brand'   ? 'text-[#B52725]' :
    color === 'good'    ? 'text-emerald-600' :
    color === 'warn'    ? 'text-amber-600' :
                          'text-gray-900';
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${numClass}`}>{value.toLocaleString('en-IN')}</div>
    </div>
  );
}
