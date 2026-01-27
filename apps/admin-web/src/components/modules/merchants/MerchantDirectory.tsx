import { useState, useMemo } from 'react';
import { Search, Star, LogIn, Pencil, BarChart3, Filter, ArrowUpDown, ChevronDown, Plus } from 'lucide-react';
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

// Enhanced mock data with new fields
const merchants = [
  { id: 1, name: 'Ratnadeep Supermarket', branch: 'Banjara Hills', owner: 'Vikram Reddy', phone: '+91 98765 43210', city: 'Hyderabad', status: true, rating: 4.5, isOnline: true, lastPing: '2 min ago', orders30d: 342, revenue: 485000 },
  { id: 2, name: 'Vijetha Supermarkets', branch: 'Gachibowli', owner: 'Suresh Kumar', phone: '+91 98765 12345', city: 'Hyderabad', status: true, rating: 4.2, isOnline: true, lastPing: '5 min ago', orders30d: 289, revenue: 312000 },
  { id: 3, name: 'Balaji Kirana', branch: 'Koramangala', owner: 'Ramesh Gupta', phone: '+91 98765 67890', city: 'Bangalore', status: true, rating: 3.8, isOnline: false, lastPing: '3 hrs ago', orders30d: 156, revenue: 178000 },
  { id: 4, name: 'Fresh Mart', branch: 'Indiranagar', owner: 'Anita Desai', phone: '+91 98765 11223', city: 'Bangalore', status: false, rating: 2.5, isOnline: false, lastPing: '5 days ago', orders30d: 23, revenue: 34000 },
  { id: 5, name: 'Daily Needs', branch: 'Hitech City', owner: 'Karan Singh', phone: '+91 98765 44556', city: 'Hyderabad', status: true, rating: 4.8, isOnline: true, lastPing: '1 min ago', orders30d: 512, revenue: 620000 },
];

type SortField = 'rating' | 'city' | 'orders30d' | 'revenue' | null;
type SortDirection = 'asc' | 'desc';

export function MerchantDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterCity, setFilterCity] = useState<string[]>([]);
  const [filterLowRating, setFilterLowRating] = useState(false);

  const cities = useMemo(() => [...new Set(merchants.map(m => m.city))], []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleImpersonate = (merchantName: string) => {
    toast.warning(`Impersonating ${merchantName}`, {
      description: "You are now viewing the dashboard as this merchant.",
      action: {
        label: "Exit",
        onClick: () => toast.info("Exited impersonation mode")
      }
    });
  };

  const handleEdit = (merchantName: string) => {
    toast.info(`Editing ${merchantName}`, {
      description: "Opening merchant details editor..."
    });
  };

  const handleViewReport = (merchantName: string) => {
    toast.info(`Analytics for ${merchantName}`, {
      description: "Opening detailed performance report..."
    });
  };

  const formatCurrency = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    }
    return `₹${(value / 1000).toFixed(0)}K`;
  };

  const filteredAndSortedMerchants = useMemo(() => {
    let result = merchants.filter(m =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone.includes(searchTerm)
    );

    // Apply city filter
    if (filterCity.length > 0) {
      result = result.filter(m => filterCity.includes(m.city));
    }

    // Apply low rating filter
    if (filterLowRating) {
      result = result.filter(m => m.rating < 3.5);
    }

    // Apply sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      });
    }

    return result;
  }, [searchTerm, sortField, sortDirection, filterCity, filterLowRating]);

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

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Showing {filteredAndSortedMerchants.length} merchants
            </div>
            <AddMerchantSheet
              trigger={
                <Button className="gap-2 bg-black text-white hover:bg-gray-800">
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
                <TableHead className="w-[220px]">Store Name</TableHead>
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
                  <SortableHeader field="orders30d">Orders (30d)</SortableHeader>
                </TableHead>
                <TableHead className="text-center">
                  <SortableHeader field="revenue">Revenue</SortableHeader>
                </TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedMerchants.map((merchant) => (
                <TableRow key={merchant.id} className="group hover:bg-blue-50/50 transition-colors">
                  <TableCell className="font-medium text-gray-900">{merchant.name}</TableCell>
                  <TableCell className="text-gray-600">{merchant.branch}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">{merchant.owner}</span>
                      <span className="text-xs text-gray-500">{merchant.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>{merchant.city}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none gap-1">
                      {merchant.rating} <Star className="w-3 h-3 fill-yellow-600 text-yellow-600" />
                    </Badge>
                  </TableCell>

                  {/* Live Status Column */}
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${merchant.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          <span className={`text-xs font-medium ${merchant.isOnline ? 'text-green-700' : 'text-gray-500'}`}>
                            {merchant.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Last active: {merchant.lastPing}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>

                  {/* Orders (30d) Column */}
                  <TableCell className="text-center">
                    <span className="font-medium text-gray-900">{merchant.orders30d}</span>
                  </TableCell>

                  {/* Revenue Column */}
                  <TableCell className="text-center">
                    <span className="font-semibold text-green-700">{formatCurrency(merchant.revenue)}</span>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch checked={merchant.status} onCheckedChange={() => { }} />
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
                            className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleImpersonate(merchant.name)}
                          >
                            <LogIn className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Login as Store</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                            onClick={() => handleEdit(merchant.name)}
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
                            onClick={() => handleViewReport(merchant.name)}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Report</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
