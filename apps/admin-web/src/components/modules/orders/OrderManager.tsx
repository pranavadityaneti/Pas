import { useState } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  ChevronRight,
  Phone,
  User,
  MapPin,
  RefreshCcw,
  ShieldAlert
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
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../../ui/tabs';
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
import { Input } from '../../ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../ui/dropdown-menu';
import { toast } from 'sonner';
import { DisputeConsole } from './DisputeConsole';

// Dummy Data
const orders = [
  { id: 'RD-101', time: '10 mins ago', customer: 'Rahul K.', phone: '+91 98765 43210', store: 'Store A - Electronics', status: 'completed', amount: 450, sla: 10 },
  { id: 'RD-102', time: '18 mins ago', customer: 'Priya S.', phone: '+91 98765 12345', store: 'Store B - Groceries', status: 'processing', amount: 1250, sla: 18 },
  { id: 'RD-103', time: '5 mins ago', customer: 'Amit M.', phone: '+91 98765 67890', store: 'Store C - Fashion', status: 'processing', amount: 890, sla: 5 },
  { id: 'RD-104', time: '45 mins ago', customer: 'Sneha R.', phone: '+91 98765 11223', store: 'Store A - Electronics', status: 'disputed', amount: 2500, sla: 45 },
  { id: 'RD-105', time: '1 hour ago', customer: 'Vikram J.', phone: '+91 98765 44556', store: 'Store D - Home', status: 'cancelled', amount: 600, sla: 60 },
  { id: 'RD-106', time: '2 mins ago', customer: 'Anjali D.', phone: '+91 98765 99887', store: 'Store B - Groceries', status: 'processing', amount: 350, sla: 2 },
];

export function OrderManager() {
  const [selectedOrder, setSelectedOrder] = useState<typeof orders[0] | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Global Order Manager</h1>
          <p className="text-sm text-gray-500">Monitor and manage all network orders in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter Date
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <Tabs defaultValue="all" className="flex-1 flex flex-col" onValueChange={setActiveTab}>
          <div className="px-6 pt-4 border-b border-gray-100">
            <TabsList className="grid w-[400px] grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="processing">Active</TabsTrigger>
              <TabsTrigger value="disputed">Disputed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
          </div>

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
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-gray-50" onClick={() => handleOrderClick(order)}>
                    <TableCell className="font-medium text-blue-600">{order.id}</TableCell>
                    <TableCell className="text-gray-500">{order.time}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{order.customer}</span>
                        <span className="text-xs text-gray-500">{order.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>{order.store}</TableCell>
                    <TableCell>
                      <StatusPill status={order.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">₹{order.amount}</TableCell>
                    <TableCell className={`text-right font-medium ${order.sla > 15 && order.status === 'processing' ? 'text-red-600' : 'text-gray-600'}`}>
                      {order.sla > 15 && order.status === 'processing' ? `Overdue (${order.sla}m)` : `${order.sla}m`}
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
                ))}
              </TableBody>
            </Table>
          </div>
        </Tabs>
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
                    <p className="font-medium">{selectedOrder.customer}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="font-medium">{selectedOrder.phone}</p>
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
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => toast.success("Order Force Completed")}>
                  Force Complete
                </Button>
                <Button variant="destructive" className="w-full" onClick={() => toast.error("Order Refunded & Cancelled")}>
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
