import { useState } from 'react';
import {
  Filter,
  Download,
  MoreHorizontal,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  User,
  MapPin,
  RefreshCcw,
  ShieldAlert,
  ShoppingCart
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from '../../ui/sheet';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../../ui/dropdown-menu';
import { toast } from 'sonner';
import { DisputeConsole } from './DisputeConsole';
import { cn } from '../../ui/utils';
import { CustomerDetailsSheet } from '../customers/CustomerDetailsSheet';
import { MerchantDetailsSheet } from '../merchants/MerchantDetailsSheet';
import { Customer } from '../../../hooks/useCustomers'; // We'll need to mock/fetch this or reconstruct partially
import { Merchant } from '../../../hooks/useMerchants';

import { useOrders, Order } from '../../../hooks/useOrders';

const getTimeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  return '1 day+ ago';
};

export function OrderManager() {
  const { orders, loading, updateOrderStatus } = useOrders();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Sheet States
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);

  const [activeTab, setActiveTab] = useState('all');
  const [showDisputeConsole, setShowDisputeConsole] = useState(false);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);

  const handleOrderClick = (order: typeof orders[0]) => {
    if (order.status === 'disputed') {
      setSelectedDisputeId(order.id);
      setShowDisputeConsole(true);
    } else {
      setSelectedOrder(order);
      setIsSheetOpen(true);
    }
  };

  const handleDisputeResolution = (result: string) => {
    setShowDisputeConsole(false);
    setSelectedDisputeId(null);
    toast.success(`Dispute Resolved: ${result}`);
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    return order.status === activeTab;
  });

  if (showDisputeConsole) {
    return <DisputeConsole id={selectedDisputeId || ''} onBack={() => setShowDisputeConsole(false)} onResolve={handleDisputeResolution} />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
            <ShoppingCart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Global Order Manager</h1>
            <p className="text-sm text-gray-500 font-medium">Monitor and manage all network orders in real-time.</p>
          </div>
        </div>

        {/* Right Actions Toolbar */}
        <div className="flex items-center gap-3">
          {/* Status Filter Button Group */}
          <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded-lg transition-all text-xs",
                activeTab === 'all'
                  ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                  : "text-gray-600 hover:text-indigo-600 hover:bg-gray-50"
              )}
              onClick={() => setActiveTab('all')}
            >
              All
            </Button>
            <div className="w-px h-4 bg-gray-200 mx-0.5"></div>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded-lg transition-all text-xs",
                activeTab === 'processing'
                  ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                  : "text-gray-600 hover:text-indigo-600 hover:bg-gray-50"
              )}
              onClick={() => setActiveTab('processing')}
            >
              <Clock className="w-3.5 h-3.5" />
              Active
            </Button>
            <div className="w-px h-4 bg-gray-200 mx-0.5"></div>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded-lg transition-all text-xs",
                activeTab === 'disputed'
                  ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                  : "text-gray-600 hover:text-orange-600 hover:bg-gray-50"
              )}
              onClick={() => setActiveTab('disputed')}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Disputed
            </Button>
            <div className="w-px h-4 bg-gray-200 mx-0.5"></div>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded-lg transition-all text-xs",
                activeTab === 'cancelled'
                  ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                  : "text-gray-600 hover:text-red-600 hover:bg-gray-50"
              )}
              onClick={() => setActiveTab('cancelled')}
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancelled
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
            <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-indigo-600">
              <Filter className="w-4 h-4" />
              Filter Date
            </Button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-indigo-600">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[100px]">Order ID</TableHead>
                <TableHead>Time Placed</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Store Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">SLA Timer</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                    {loading ? "Loading live orders..." : "No orders found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-gray-50" onClick={() => handleOrderClick(order)}>
                    <TableCell className="font-medium text-blue-600">#{order.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-gray-500">{getTimeAgo(order.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col group cursor-pointer" onClick={(e) => {
                        e.stopPropagation();
                        // Reconstruct a partial customer object to open the sheet
                        setSelectedCustomer({
                          id: order.user_id || 'unknown',
                          name: order.customer_name,
                          phone: order.customer_phone,
                          city: 'Hyderabad', // Fallback
                          ltv: 0, // Will be fetched
                          last_order: null,
                          status: 'active',
                          avatar_url: null,
                          created_at: new Date().toISOString()
                        });
                      }}>
                        <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors underline-offset-4 group-hover:underline">{order.customer_name}</span>
                        <span className="text-xs text-gray-500">{order.customer_phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer underline-offset-4 hover:underline transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Reconstruct a partial merchant object to open the sheet
                          setSelectedMerchant({
                            id: order.store_id,
                            store_name: order.store_name,
                            owner_name: 'Loading...',
                            email: 'loading@example.com',
                            phone: 'Loading...',
                            city: 'Hyderabad',
                            status: 'active',
                            kyc_status: 'approved',
                            rating: 4.5,
                            created_at: new Date().toISOString()
                          } as any);
                        }}
                      >
                        {order.store_name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={order.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">₹{order.amount}</TableCell>
                    <TableCell className={`text-right font-medium ${order.sla_minutes > 15 && order.status === 'processing' ? 'text-red-600' : 'text-gray-600'}`}>
                      {order.sla_minutes > 15 && order.status === 'processing' ? `Overdue` : `${order.sla_minutes}m`}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOrderClick(order); }}>View Details</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Force Cancel</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Side Drawer */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl">Order Details {selectedOrder?.id}</SheetTitle>
              <Badge variant="outline">{selectedOrder?.status}</Badge>
            </div>
            <SheetDescription>
              Placed on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </SheetDescription>
          </SheetHeader>

          {selectedOrder && (
            <div className="space-y-8">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Name</p>
                    <p className="font-medium">{selectedOrder.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="font-medium">{selectedOrder.customer_phone}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Order Timeline
                </h3>
                <div className="relative border-l-2 border-gray-200 ml-2 space-y-6">
                  <div className="ml-6 relative">
                    <span className="absolute -left-[31px] bg-green-500 w-4 h-4 rounded-full border-2 border-white"></span>
                    <p className="font-medium text-sm">Order Placed</p>
                    <p className="text-xs text-gray-500">10:45 AM</p>
                  </div>
                  <div className="ml-6 relative">
                    <span className="absolute -left-[31px] bg-blue-500 w-4 h-4 rounded-full border-2 border-white"></span>
                    <p className="font-medium text-sm">Store Accepted</p>
                    <p className="text-xs text-gray-500">10:47 AM</p>
                  </div>
                  <div className="ml-6 relative">
                    <span className="absolute -left-[31px] bg-gray-300 w-4 h-4 rounded-full border-2 border-white"></span>
                    <p className="font-medium text-sm text-gray-500">Driver Assigned</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                </div>
              </div>

              {/* Driver Info (Placeholder) */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Delivery Status
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                    <RefreshCcw className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Looking for drivers...</p>
                    <p className="text-xs text-gray-500">Zone: Indiranagar - High Demand</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}>
                  Force Complete
                </Button>
                <Button variant="destructive" className="w-full" onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}>
                  Refund & Cancel
                </Button>
              </div>
            </div>
          )}

          <SheetFooter className="mt-8">
            <Button variant="ghost" onClick={() => setIsSheetOpen(false)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Linked Data Sheets */}
      <CustomerDetailsSheet
        customer={selectedCustomer}
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />

      <MerchantDetailsSheet
        merchant={selectedMerchant}
        isOpen={!!selectedMerchant}
        onClose={() => setSelectedMerchant(null)}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles = {
    completed: 'bg-green-100 text-green-700 border-green-200',
    processing: 'bg-blue-100 text-blue-700 border-blue-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
    disputed: 'bg-orange-100 text-orange-700 border-orange-200',
  };

  const icons = {
    completed: CheckCircle,
    processing: RefreshCcw,
    cancelled: XCircle,
    disputed: ShieldAlert,
  };

  const Icon = icons[status as keyof typeof icons] || CheckCircle;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.processing}`}>
      <Icon className="w-3.5 h-3.5" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
