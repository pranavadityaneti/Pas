import { useState, useMemo } from 'react';
import { Search, Star, Pencil, BarChart3, Filter, ArrowUpDown, ChevronDown, Plus, Download } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { toast } from 'sonner';
import { AddMerchantSheet } from './AddMerchantSheet';
import { ExportMerchantsDialog } from './ExportMerchantsDialog';
import { EditMerchantDialog } from './EditMerchantDialog';
import { MerchantReportDialog } from './MerchantReportDialog';
import { useMerchants, Merchant } from '../../../hooks/useMerchants';

type SortField = 'rating' | 'city' | 'orders_30d' | 'revenue_30d' | null;
type SortDirection = 'asc' | 'desc';

export function MerchantDirectory() {
  const { merchants, loading } = useMerchants();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterCity, setFilterCity] = useState<string[]>([]);
  const [filterLowRating, setFilterLowRating] = useState(false);

  // Dialog states
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [reportMerchant, setReportMerchant] = useState<Merchant | null>(null);

  const cities = useMemo(() => [...new Set(merchants.map(m => m.city))], [merchants]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    }
    return `₹${(value / 1000).toFixed(0)}K`;
  };

  const filteredAndSortedMerchants = useMemo(() => {
    let result = merchants.filter(m =>
      m.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone?.includes(searchTerm)
    );

    // Apply city filter
    if (filterCity.length > 0) {
      result = result.filter(m => filterCity.includes(m.city));
    }

    // Apply low rating filter
    if (filterLowRating) {
      result = result.filter(m => (m.rating || 0) < 3.5);
    }

    // Apply sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortField as keyof Merchant];
        const bVal = b[sortField as keyof Merchant];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDirection === 'asc'
          ? ((aVal as number) || 0) - ((bVal as number) || 0)
          : ((bVal as number) || 0) - ((aVal as number) || 0);
      });
    }

    return result;
  }, [merchants, searchTerm, sortField, sortDirection, filterCity, filterLowRating]);

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-gray-900 transition-colors font-medium"
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-600' : 'text-gray-400'}`} />
    </button>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-1">
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by Store Name, Owner, or Phone"
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                  {(filterCity.length > 0 || filterLowRating) && (
                    <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700 text-xs px-1.5">
                      {filterCity.length + (filterLowRating ? 1 : 0)}
                    </Badge>
                  )}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filter by City</DropdownMenuLabel>
                {cities.map(city => (
                  <DropdownMenuCheckboxItem
                    key={city}
                    checked={filterCity.includes(city)}
                    onCheckedChange={(checked) => {
                      setFilterCity(checked
                        ? [...filterCity, city]
                        : filterCity.filter(c => c !== city)
                      );
                    }}
                  >
                    {city}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Performance</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={filterLowRating}
                  onCheckedChange={setFilterLowRating}
                >
                  Low Rating (&lt; 3.5 ⭐)
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">
              Showing {filteredAndSortedMerchants.length} merchants
            </div>
            <ExportMerchantsDialog
              trigger={
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              }
            />
            <AddMerchantSheet
              trigger={
                <Button className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
                  <Plus className="w-4 h-4" />
                  Add Merchant
                </Button>
              }
            />
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[200px]">Store Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Owner Name</TableHead>
                <TableHead>
                  <SortableHeader field="city">City</SortableHeader>
                </TableHead>
                <TableHead className="text-center">
                  <SortableHeader field="rating">Rating</SortableHeader>
                </TableHead>
                <TableHead className="text-center">Live Status</TableHead>
                <TableHead className="text-center">
                  <SortableHeader field="orders_30d">Orders (30d)</SortableHeader>
                </TableHead>
                <TableHead className="text-center">
                  <SortableHeader field="revenue_30d">Revenue</SortableHeader>
                </TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                    Loading merchants...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedMerchants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                    No merchants found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedMerchants.map((merchant) => (
                  <TableRow key={merchant.id} className="group hover:bg-blue-50/50 transition-colors">
                    <TableCell className="font-medium text-gray-900">{merchant.store_name}</TableCell>
                    <TableCell className="text-gray-600">{merchant.branch_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{merchant.owner_name}</span>
                        <span className="text-xs text-gray-500">{merchant.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>{merchant.city}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none gap-1">
                        {merchant.rating || 'N/A'} <Star className="w-3 h-3 fill-yellow-600 text-yellow-600" />
                      </Badge>
                    </TableCell>

                    {/* Live Status Column */}
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${merchant.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            <span className={`text-xs font-medium ${merchant.is_online ? 'text-green-700' : 'text-gray-500'}`}>
                              {merchant.is_online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Last active: {merchant.last_active || 'Unknown'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {/* Orders (30d) Column */}
                    <TableCell className="text-center">
                      <span className="font-medium text-gray-900">{merchant.orders_30d || 0}</span>
                    </TableCell>

                    {/* Revenue Column */}
                    <TableCell className="text-center">
                      <span className="font-semibold text-green-700">{formatCurrency(merchant.revenue_30d || 0)}</span>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch checked={merchant.status === 'active'} onCheckedChange={() => { }} />
                      </div>
                    </TableCell>

                    {/* Actions Column */}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                              onClick={() => setEditMerchant(merchant)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Details</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                              onClick={() => setReportMerchant(merchant)}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Report</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Edit Dialog */}
        {editMerchant && (
          <EditMerchantDialog
            merchant={editMerchant}
            open={!!editMerchant}
            onOpenChange={(open) => !open && setEditMerchant(null)}
          />
        )}

        {/* Report Dialog */}
        {reportMerchant && (
          <MerchantReportDialog
            merchant={reportMerchant}
            open={!!reportMerchant}
            onOpenChange={(open) => !open && setReportMerchant(null)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
