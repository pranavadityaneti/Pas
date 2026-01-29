import { useState, useMemo } from 'react';
import { Search, Star, Pencil, BarChart3, Filter, ArrowUpDown, ChevronDown, Plus, Download, ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Checkbox } from '../../ui/checkbox';
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
import { MerchantDetailsSheet } from './MerchantDetailsSheet';
import { MerchantReportDialog } from './MerchantReportDialog';
import { useMerchants, Merchant } from '../../../hooks/useMerchants';
import api from '../../../lib/api';

type SortField = 'rating' | 'city' | 'orders_30d' | 'revenue_30d' | null;
type SortDirection = 'asc' | 'desc';

export function MerchantDirectory() {
  const { merchants, loading, fetchMerchants, updateMerchant } = useMerchants();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filters
  const [filterCity, setFilterCity] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterKyc, setFilterKyc] = useState<string[]>([]);
  const [filterLowRating, setFilterLowRating] = useState(false);

  const [selectedMerchants, setSelectedMerchants] = useState<string[]>([]);

  const handleStatusToggle = async (merchant: Merchant, checked: boolean) => {
    try {
      await updateMerchant(merchant.id, { status: checked ? 'active' : 'inactive' });
      toast.success(`Merchant ${checked ? 'activated' : 'deactivated'}`, {
        description: `${merchant.store_name} is now ${checked ? 'online' : 'offline'}.`
      });
      fetchMerchants();
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  // Dialog states
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [reportMerchant, setReportMerchant] = useState<Merchant | null>(null);

  const cities = useMemo(() => [...new Set(merchants.map(m => m.city))], [merchants]);

  const toggleSelectAll = (filteredMerchants: Merchant[]) => {
    if (selectedMerchants.length === filteredMerchants.length && filteredMerchants.length > 0) {
      setSelectedMerchants([]);
    } else {
      setSelectedMerchants(filteredMerchants.map(m => m.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedMerchants.includes(id)) {
      setSelectedMerchants(prev => prev.filter(mid => mid !== id));
    } else {
      setSelectedMerchants(prev => [...prev, id]);
    }
  };

  const handleBulkExport = async () => {
    if (selectedMerchants.length === 0) return;

    const toastId = toast.loading('Exporting selected merchants...');
    try {
      const response = await api.post('/merchants/export-selected', { ids: selectedMerchants }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `merchants_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Export completed details sent to downloads', { id: toastId });
      setSelectedMerchants([]);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export merchants', { id: toastId });
    }
  };



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

    // Apply Status Filter
    if (filterStatus.length > 0) {
      result = result.filter(m => filterStatus.includes(m.status));
    }

    // Apply KYC Filter
    if (filterKyc.length > 0) {
      result = result.filter(m => filterKyc.includes(m.kyc_status));
    } else {
      // Default: If no KYC filter selected, hide 'rejected' ONLY IF search is empty (keep directory clean)
      if (!searchTerm) {
        result = result.filter(m => m.kyc_status !== 'rejected');
      }
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
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : 'text-gray-400'}`} />
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
                  {(filterCity.length > 0 || filterStatus.length > 0 || filterKyc.length > 0 || filterLowRating) && (
                    <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary text-xs px-1.5">
                      {filterCity.length + filterStatus.length + filterKyc.length + (filterLowRating ? 1 : 0)}
                    </Badge>
                  )}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Merchant Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {['active', 'inactive'].map(status => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={filterStatus.includes(status)}
                    onCheckedChange={(checked) => {
                      setFilterStatus(prev => checked ? [...prev, status] : prev.filter(s => s !== status))
                    }}
                    className="capitalize"
                  >
                    {status}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>KYC State</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {['approved', 'pending', 'rejected'].map(status => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={filterKyc.includes(status)}
                    onCheckedChange={(checked) => {
                      setFilterKyc(prev => checked ? [...prev, status] : prev.filter(s => s !== status))
                    }}
                    className="capitalize"
                  >
                    {status}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>City</DropdownMenuLabel>
                <div className="max-h-[200px] overflow-y-auto">
                  {cities.map(city => (
                    <DropdownMenuCheckboxItem
                      key={city}
                      checked={filterCity.includes(city)}
                      onCheckedChange={(checked) => {
                        setFilterCity(prev =>
                          checked ? [...prev, city] : prev.filter(c => c !== city)
                        )
                      }}
                    >
                      {city}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>

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
              onSuccess={fetchMerchants}
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
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedMerchants.length === filteredAndSortedMerchants.length && filteredAndSortedMerchants.length > 0}
                    onCheckedChange={() => toggleSelectAll(filteredAndSortedMerchants)}
                  />
                </TableHead>
                <TableHead className="w-[200px]">Store Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Owner Name</TableHead>
                <TableHead>Catalog</TableHead>
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
                  <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                    Loading merchants...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedMerchants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                    No merchants found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedMerchants.map((merchant) => (
                  <TableRow
                    key={merchant.id}
                    className={`group transition-colors ${merchant.kyc_status === 'pending'
                      ? 'bg-orange-50/50 hover:bg-orange-50'
                      : 'hover:bg-primary/5'
                      }`}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedMerchants.includes(merchant.id)}
                          onCheckedChange={() => toggleSelect(merchant.id)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${merchant.kyc_status === 'pending' ? 'text-orange-900' : 'text-gray-900'}`}>
                          {merchant.store_name}
                        </span>
                        {merchant.kyc_status === 'pending' && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-orange-200 text-orange-600 bg-orange-100/50">KYC</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{merchant.branch_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{merchant.owner_name}</span>
                        <span className="text-xs text-gray-500">{merchant.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={merchant.kyc_status === 'pending'}
                        className="h-7 text-xs gap-1.5 text-primary hover:text-primary/90 hover:bg-primary/5 border-primary/20"
                        onClick={() => navigate('/catalog')}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Full View
                      </Button>
                    </TableCell>
                    <TableCell>{merchant.city}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none gap-1">
                        {merchant.rating || 'N/A'} <Star className="w-3 h-3 fill-yellow-600 text-yellow-600" />
                      </Badge>
                    </TableCell>

                    {/* Live Status Column */}
                    < TableCell className="text-center" >
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
                        {merchant.kyc_status === 'pending' ? (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-500 border border-gray-200 font-medium">
                            Pending Verification
                          </Badge>
                        ) : (
                          <Switch
                            checked={merchant.status === 'active'}
                            onCheckedChange={(checked) => handleStatusToggle(merchant, checked)}
                            className="data-[state=checked]:bg-green-600"
                          />
                        )}
                      </div>
                    </TableCell>

                    {/* Actions Column */}
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="default"
                              disabled={merchant.kyc_status === 'pending'}
                              className="h-8 w-8 bg-black text-white hover:bg-gray-800 shadow-sm"
                              onClick={() => setEditMerchant(merchant)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Details</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              disabled={merchant.kyc_status === 'pending'}
                              className="h-8 w-8 text-gray-700 border-gray-200 hover:bg-gray-50"
                              onClick={() => setReportMerchant(merchant)}
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
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
        {
          editMerchant && (
            <EditMerchantDialog
              merchant={merchants.find(m => m.id === editMerchant.id) || editMerchant}
              open={!!editMerchant}
              onOpenChange={(open) => !open && setEditMerchant(null)}
              onRefresh={fetchMerchants}
            />
          )
        }

        {/* Report Dialog */}
        {
          reportMerchant && (
            <MerchantReportDialog
              merchant={reportMerchant}
              open={!!reportMerchant}
              onOpenChange={(open) => !open && setReportMerchant(null)}
            />
          )
        }
        {
          selectedMerchants.length > 0 && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-sm">
                    {selectedMerchants.length}
                  </div>
                  <span className="text-sm font-medium text-gray-300">selected</span>
                </div>
                <div className="w-px h-8 bg-gray-600"></div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-gray-800 gap-2"
                  onClick={handleBulkExport}
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <div className="w-px h-8 bg-gray-600"></div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white hover:bg-gray-800"
                  onClick={() => setSelectedMerchants([])}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )
        }
      </div >

      <MerchantDetailsSheet
        merchant={selectedMerchant}
        isOpen={!!selectedMerchant}
        onClose={() => setSelectedMerchant(null)}
      />
    </TooltipProvider >
  );
}
