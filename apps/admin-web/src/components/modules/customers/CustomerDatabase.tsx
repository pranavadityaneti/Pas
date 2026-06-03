/**
 * Customer Database (admin)
 *
 * 2026-06-03: full rewrite to stop showing fake data + make the page
 *             actually useful for support. Founder-approved Phases 1-3.
 *
 *   Phase 1 — Stop lying
 *     - Real city (derived from last order's branch, "Unknown" if no orders)
 *     - Real status from User.status (active / suspended)
 *     - Wire Block / Unblock to PATCH /admin/users/:id (existing endpoint)
 *     - Remove fake "Grant Credit" button (no wallets table exists)
 *     - Remove fuchsia → pink decorative gradient, replace with brand red
 *
 *   Phase 2 — Pull richer data
 *     - New columns: Orders, AOV, Last Order (with recency color badge)
 *     - Totals strip: Total / Active / Suspended counts
 *     - Fix last-order sort bug (was un-sorted)
 *
 *   Phase 3 — Actionable support layer
 *     - Per-row dropdown: View Details / Send WhatsApp / View Orders / Block-Unblock
 *     - "Send WhatsApp" opens wa.me click-to-chat (works on web + mobile)
 *     - "View Orders" navigates to /orders (filter param ignored by target page for now;
 *       tracked as a follow-up to make /orders respect ?userId=X)
 *
 * Still deferred (post-launch):
 *   - Wallet balance + Grant Credit (needs wallets table)
 *   - Tags (VIP / At-Risk) (needs customer_tags table)
 *   - LTV percentile + cohort retention
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { CustomerDetailsSheet } from './CustomerDetailsSheet';
import { useCustomers, Customer } from '../../../hooks/useCustomers';

const BRAND_RED = '#B52725';

function fmtINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function recencyBadge(days: number | null): { label: string; classes: string } {
  if (days == null) return { label: 'No orders',  classes: 'bg-gray-100 text-gray-600 border-gray-200' };
  if (days === 0)   return { label: 'Today',      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (days <= 7)    return { label: `${days}d ago`, classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (days <= 30)   return { label: `${days}d ago`, classes: 'bg-amber-50 text-amber-700 border-amber-200' };
  return                   { label: `${days}d ago`, classes: 'bg-rose-50 text-rose-700 border-rose-200' };
}

function openWhatsApp(phone: string) {
  // Strip everything except digits, prepend country code if absent.
  const digits = phone.replace(/\D/g, '');
  if (!digits) return;
  const withCc = digits.length === 10 ? `91${digits}` : digits;
  window.open(`https://wa.me/${withCc}`, '_blank', 'noopener,noreferrer');
}

export function CustomerDatabase() {
  const { customers, loading, fetchCustomers, blockCustomer, unblockCustomer } = useCustomers();
  const [searchTerm,        setSearchTerm]        = useState('');
  const [selectedCustomer,  setSelectedCustomer]  = useState<Customer | null>(null);
  const [filterCity,        setFilterCity]        = useState<string[]>([]);
  const [filterStatus,      setFilterStatus]      = useState<string[]>([]);

  const cities = useMemo(
    () => [...new Set(customers.map(c => c.city))].filter(Boolean).sort(),
    [customers],
  );

  // Totals strip
  const totalCount    = customers.length;
  const activeCount   = customers.filter(c => c.status === 'active').length;
  const suspendCount  = customers.filter(c => c.status === 'suspended').length;

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase())
        || c.phone.includes(searchTerm)
        || c.email.toLowerCase().includes(searchTerm.toLowerCase())
        || c.id.includes(searchTerm);
      const matchesCity   = filterCity.length   === 0 || filterCity.includes(c.city);
      const matchesStatus = filterStatus.length === 0 || filterStatus.includes(c.status);
      return matchesSearch && matchesCity && matchesStatus;
    });
  }, [customers, searchTerm, filterCity, filterStatus]);

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 2026-06-03: replaced fuchsia→pink gradient with solid brand red */}
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
        <TotalsTile label="Total Customers"      value={totalCount}    color="brand" />
        <TotalsTile label="Active"               value={activeCount}   color="good" />
        <TotalsTile label="Suspended"            value={suspendCount}  color={suspendCount > 0 ? 'warn' : 'neutral'} />
      </div>

      {/* ─── Table card ─── */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name, email, phone, or ID…"
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
                  {(filterCity.length > 0 || filterStatus.length > 0) && (
                    <Badge variant="secondary" className="ml-1 bg-[#B52725]/10 text-[#B52725]">
                      {filterCity.length + filterStatus.length}
                    </Badge>
                  )}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Account Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['active', 'suspended'] as const).map(status => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={filterStatus.includes(status)}
                    onCheckedChange={(checked) => {
                      setFilterStatus(prev => checked ? [...prev, status] : prev.filter(s => s !== status));
                    }}
                    className="capitalize"
                  >
                    {status}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Filter by City</DropdownMenuLabel>
                {cities.length === 0 && (
                  <div className="px-2 py-1 text-xs text-gray-500">No cities yet</div>
                )}
                {cities.map(city => (
                  <DropdownMenuCheckboxItem
                    key={city}
                    checked={filterCity.includes(city)}
                    onCheckedChange={(checked) => {
                      setFilterCity(prev => checked ? [...prev, city] : prev.filter(c => c !== city));
                    }}
                  >
                    {city}
                  </DropdownMenuCheckboxItem>
                ))}
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
                  const recency = recencyBadge(customer.days_since_last_order);
                  return (
                    <TableRow
                      key={customer.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <TableCell onClick={() => setSelectedCustomer(customer)} className="cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                            {customer.avatar_url ? (
                              <ImageWithFallback src={customer.avatar_url} alt={customer.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-gray-400">{customer.name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{customer.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">ID: {customer.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setSelectedCustomer(customer)} className="cursor-pointer">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-700">{customer.phone}</span>
                          {customer.email && (
                            <span className="text-[11px] text-gray-500 truncate max-w-[180px]">{customer.email}</span>
                          )}
                        </div>
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
                        {customer.order_count > 0 ? fmtINR(customer.aov) : '—'}
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
                            <DropdownMenuLabel className="text-[11px] text-gray-500">{customer.name}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSelectedCustomer(customer)}>
                              <Eye className="w-4 h-4 mr-2" /> View details
                            </DropdownMenuItem>
                            {customer.phone && customer.phone !== 'N/A' && (
                              <DropdownMenuItem onClick={() => openWhatsApp(customer.phone)}>
                                <MessageCircle className="w-4 h-4 mr-2" /> Send WhatsApp
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                              <Link to={`/orders?userId=${customer.id}`}>
                                <ShoppingBag className="w-4 h-4 mr-2" /> View orders
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/customer-support?phone=${encodeURIComponent(customer.phone)}`}>
                                <History className="w-4 h-4 mr-2" /> Wati history
                              </Link>
                            </DropdownMenuItem>
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

      {/* keep unused-import safety */}
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
