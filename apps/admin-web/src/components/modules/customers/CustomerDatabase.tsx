import { useState, useMemo } from 'react';
import {
    Search,
    Filter,
    MoreHorizontal,
    Coins,
    History,
    Shield,
    Ban,
    MapPin,
    Calendar,
    Users,
    Download,
    ChevronDown
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
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
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from '../../ui/dropdown-menu';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { toast } from 'sonner';
import { CustomerDetailsSheet } from './CustomerDetailsSheet';
import { useCustomers, Customer } from '../../../hooks/useCustomers';

export function CustomerDatabase() {
    const { customers, loading, fetchCustomers, blockCustomer } = useCustomers();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // Filters
    const [filterCity, setFilterCity] = useState<string[]>([]);
    const [filterStatus, setFilterStatus] = useState<string[]>([]);

    const cities = useMemo(() => [...new Set(customers.map(c => c.city))], [customers]);

    const handleGrantCredit = (customer: Customer) => {
        toast.success(`Wallet Credit Granted`, {
            description: `₹50 has been added to ${customer.name}'s wallet as a goodwill gesture.`
        });
    };

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone.includes(searchTerm) ||
                c.id.includes(searchTerm);

            const matchesCity = filterCity.length === 0 || filterCity.includes(c.city);
            const matchesStatus = filterStatus.length === 0 || filterStatus.includes(c.status);

            return matchesSearch && matchesCity && matchesStatus;
        });
    }, [customers, searchTerm, filterCity, filterStatus]);

    return (
        <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg">
                        <Users className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Customer Base</h1>
                        <p className="text-sm text-gray-500 font-medium">Manage customer accounts and support actions.</p>
                    </div>
                </div>

                {/* Right Actions Toolbar */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                        <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-fuchsia-600" onClick={fetchCustomers}>
                            <Download className="w-4 h-4" />
                            Refresh List
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Search by Name, Phone, or ID..."
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
                                        <Badge variant="secondary" className="ml-1 bg-fuchsia-100 text-fuchsia-700">
                                            {filterCity.length + filterStatus.length}
                                        </Badge>
                                    )}
                                    <ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                                <DropdownMenuLabel>Account Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {['active', 'blocked'].map(status => (
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
                                <DropdownMenuLabel>Filter by City</DropdownMenuLabel>
                                {cities.map(city => (
                                    <DropdownMenuCheckboxItem
                                        key={city}
                                        checked={filterCity.includes(city)}
                                        onCheckedChange={(checked) => {
                                            setFilterCity(prev => checked ? [...prev, city] : prev.filter(c => c !== city))
                                        }}
                                    >
                                        {city}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="text-sm text-gray-500 font-medium">
                        {filteredCustomers.length} Customers in your view
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="bg-gray-50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead>Customer Name</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Total LTV (₹)</TableHead>
                                <TableHead>Last Activity</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-20 text-gray-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
                                            Reading customer records...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-20 text-gray-500">No customers found matching your filters.</TableCell>
                                </TableRow>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <TableRow
                                        key={customer.id}
                                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedCustomer(customer)}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                                                    {customer.avatar_url ? (
                                                        <ImageWithFallback src={customer.avatar_url} alt={customer.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs font-bold text-gray-400">{customer.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{customer.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">ID: {customer.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-gray-700">{customer.phone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                {customer.city}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold text-gray-900">
                                                ₹{customer.ltv.toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                {customer.last_order || 'No orders yet'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={customer.status === 'active'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }
                                            >
                                                {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-fuchsia-600 border-fuchsia-100 hover:bg-fuchsia-50 hover:text-fuchsia-700 h-8 font-medium"
                                                    onClick={() => handleGrantCredit(customer)}
                                                >
                                                    <Coins className="w-4 h-4 mr-1.5" />
                                                    Credit
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Support Tools</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => toast.info(`Viewing history for ${customer.name}`)}>
                                                            <History className="w-4 h-4 mr-2" /> Purchase History
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {customer.status === 'active' ? (
                                                            <DropdownMenuItem className="text-rose-600" onClick={() => blockCustomer(customer.id)}>
                                                                <Ban className="w-4 h-4 mr-2" /> Deactivate Account
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem className="text-emerald-600">
                                                                <Shield className="w-4 h-4 mr-2" /> Reactivate Account
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
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
        </div>
    );
}
