import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Card, CardContent, CardFooter, CardHeader } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Clock, Printer, CheckCircle2, XCircle, ShoppingBag } from 'lucide-react';
import { Drawer } from 'vaul';
import { Input } from '@/app/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Mock Data Types
type OrderStatus = 'pending' | 'processing' | 'ready' | 'completed';

interface OrderItem {
  name: string;
  qty: number;
}

interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  timeRemaining?: string; // For pending
  customerName?: string;
}

const initialOrders: Order[] = [
  {
    id: '#ORD-001',
    customerName: 'Aman Gupta',
    items: [{ name: 'Chicken Biryani', qty: 2 }, { name: 'Coke', qty: 2 }],
    total: 540,
    status: 'pending',
    timeRemaining: '04:59'
  },
  {
    id: '#ORD-002',
    customerName: 'Priya Singh',
    items: [{ name: 'Paneer Wrap', qty: 1 }],
    total: 180,
    status: 'pending',
    timeRemaining: '02:30'
  },
  {
    id: '#ORD-003',
    customerName: 'Rajiv Kumar',
    items: [{ name: 'Masala Dosa', qty: 2 }, { name: 'Filter Coffee', qty: 1 }],
    total: 220,
    status: 'processing',
  },
  {
    id: '#ORD-004',
    customerName: 'Simran K',
    items: [{ name: 'Burger Meal', qty: 1 }],
    total: 350,
    status: 'ready',
  }
];

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeTab, setActiveTab] = useState('pending');
  const [pickupOtp, setPickupOtp] = useState('');
  const [selectedOrderForPickup, setSelectedOrderForPickup] = useState<Order | null>(null);

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const handleReject = (orderId: string) => {
    setOrders(orders.filter(o => o.id !== orderId));
  };

  const handleVerifyPickup = () => {
    if (pickupOtp.length === 4 && selectedOrderForPickup) {
      // Simulate verification
      handleStatusChange(selectedOrderForPickup.id, 'completed');
      setPickupOtp('');
      setSelectedOrderForPickup(null);
      // Close drawer logic handled by Vaul automatically if controlled, but here we just clear state
      // Actually we need to close the drawer programmatically or let user close it. 
      // The drawer open state is controlled by !!selectedOrderForPickup
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const processingOrders = orders.filter(o => o.status === 'processing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none h-12 bg-transparent p-0 border-b border-gray-100">
            <TabsTrigger 
              value="pending" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 h-full"
            >
              Pending ({pendingOrders.length})
            </TabsTrigger>
            <TabsTrigger 
              value="processing" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 h-full"
            >
              Processing ({processingOrders.length})
            </TabsTrigger>
            <TabsTrigger 
              value="ready" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 h-full"
            >
              Ready ({readyOrders.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'pending' && (
            <motion.div 
              key="pending" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {pendingOrders.length === 0 && <EmptyState message="No pending orders" />}
              {pendingOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onAccept={() => handleStatusChange(order.id, 'processing')}
                  onReject={() => handleReject(order.id)}
                />
              ))}
            </motion.div>
          )}

          {activeTab === 'processing' && (
            <motion.div 
              key="processing" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {processingOrders.length === 0 && <EmptyState message="Kitchen is clear" />}
              {processingOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onMarkReady={() => handleStatusChange(order.id, 'ready')}
                />
              ))}
            </motion.div>
          )}

          {activeTab === 'ready' && (
            <motion.div 
              key="ready" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {readyOrders.length === 0 && <EmptyState message="No orders ready for pickup" />}
              {readyOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onPickupClick={() => setSelectedOrderForPickup(order)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pickup Verification Drawer */}
      <Drawer.Root 
        open={!!selectedOrderForPickup} 
        onOpenChange={(open) => !open && setSelectedOrderForPickup(null)}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Drawer.Content className="bg-white flex flex-col rounded-t-[10px] h-[50vh] mt-24 fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto">
            <div className="p-4 bg-white rounded-t-[10px] flex-1">
              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-8" />
              <div className="max-w-md mx-auto">
                <Drawer.Title className="font-medium text-center text-xl mb-2">
                  Verify Pickup
                </Drawer.Title>
                <Drawer.Description className="text-center text-gray-500 mb-8">
                  Enter the 4-digit code from the customer for {selectedOrderForPickup?.id}
                </Drawer.Description>
                
                <div className="flex justify-center mb-8">
                  <Input
                    type="text"
                    maxLength={4}
                    value={pickupOtp}
                    onChange={(e) => setPickupOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-48 text-center text-4xl tracking-[0.5em] font-bold h-16 border-b-2 border-x-0 border-t-0 rounded-none focus-visible:ring-0 px-0"
                    placeholder="••••"
                    autoFocus
                  />
                </div>

                <Button 
                  className="w-full h-12 text-lg" 
                  onClick={handleVerifyPickup}
                  disabled={pickupOtp.length !== 4}
                >
                  Verify Code
                </Button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function OrderCard({ 
  order, 
  onAccept, 
  onReject, 
  onMarkReady, 
  onPickupClick 
}: { 
  order: Order; 
  onAccept?: () => void; 
  onReject?: () => void; 
  onMarkReady?: () => void;
  onPickupClick?: () => void;
}) {
  return (
    <Card className={cn("overflow-hidden border-none shadow-sm", 
      order.status === 'ready' ? "bg-green-50/50 border border-green-100" : "bg-white"
    )}>
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-gray-900">{order.id}</h3>
            {order.status === 'pending' && (
               <Badge variant="warning" className="flex items-center gap-1">
                 <Clock className="w-3 h-3" /> {order.timeRemaining}
               </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-gray-600 mt-1">{order.customerName}</p>
        </div>
        <p className="font-bold text-lg">₹{order.total}</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <ul className="space-y-1">
          {order.items.map((item, idx) => (
            <li key={idx} className="text-sm text-gray-600 flex justify-between">
              <span>{item.qty} x {item.name}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="p-4 pt-0 gap-3">
        {order.status === 'pending' && (
          <>
            <Button 
              variant="outline" 
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onReject}
            >
              Reject
            </Button>
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={onAccept}
            >
              Accept Order
            </Button>
          </>
        )}
        
        {order.status === 'processing' && (
          <>
            <Button variant="outline" size="icon">
              <Printer className="w-4 h-4" />
            </Button>
            <Button 
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={onMarkReady}
            >
              Mark Ready
            </Button>
          </>
        )}

        {order.status === 'ready' && (
          <Button 
            className="w-full bg-gray-900 hover:bg-black text-white h-12 text-lg"
            onClick={onPickupClick}
          >
            Enter Pickup Code
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="bg-gray-100 p-4 rounded-full mb-4">
        <ShoppingBag className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-gray-500 font-medium">{message}</p>
    </div>
  );
}
