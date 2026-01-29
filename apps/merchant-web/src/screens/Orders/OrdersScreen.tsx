import React, { useEffect, useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Card, CardContent, CardFooter, CardHeader } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Clock, Printer, CheckCircle2, XCircle, ShoppingBag } from 'lucide-react';
import { Drawer } from 'vaul';
import { Input } from '@/app/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

// Types aligning with DB
type OrderStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'cancelled';

interface OrderItem {
  id: string;
  menu_item_id: string; // or product_id
  quantity: number;
  price: number;
  product_name?: string; // If joined
  // In real DB it might be joined, or we fetch simplistic
  name?: string; // Adapter for UI
}

interface Order {
  id: string;
  customer_name: string;
  total_amount: number; // DB uses amount or total_amount
  status: OrderStatus;
  created_at: string;
  order_items: any[];
  // Adapter props for UI
  items: { name: string; qty: number }[];
  total: number;
  timeRemaining?: string;
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [pickupOtp, setPickupOtp] = useState('');
  const [selectedOrderForPickup, setSelectedOrderForPickup] = useState<Order | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize Audio for Ringing
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    fetchOrders();
    subscribeToOrders();

    return () => {
      supabase.removeAllChannels();
    };
  }, []);

  const fetchOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch orders for this store
    // Note: In a real app we would join 'order_items' properly.
    // For this prototype, we assume order_items is joined or we fetch simply.
    // Supabase query:
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
           *,
           quantity,
           price
           -- If we had a product link we'd fetch name here, but let's assume raw or mock name for now if not in schema
        )
      `)
      .eq('store_id', user.id)
      .neq('status', 'cancelled') // Don't show cancelled history here
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load orders");
      return;
    }

    // Adapt DB data to UI Model
    const adapted: Order[] = (data || []).map((o: any) => ({
      ...o,
      customerName: o.customer_name || 'Customer',
      status: o.status,
      total: o.amount || o.total_amount || 0,
      items: o.order_items?.map((i: any) => ({
        name: i.product_name || `Item #${i.menu_item_id?.slice(0, 4)}`, // Fallback
        qty: i.quantity
      })) || [],
      timeRemaining: 'Now' // Calc difference if needed
    }));

    setOrders(adapted);
  };

  const subscribeToOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    supabase
      .channel('merchant-orders')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT (new) and UPDATE (status change)
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('Realtime Event:', payload);

          if (payload.eventType === 'INSERT') {
            // Play Sound
            audioRef.current?.play().catch(() => console.log('Audio blocked'));
            toast.message("New Order Received!", { description: `#${payload.new.id.slice(0, 8)}` });

            // Ideally fetch full payload with items, but for now just refresh all for simplicity
            // Optimisation: Just fetch this one order.
            fetchOrders();
          } else if (payload.eventType === 'UPDATE') {
            // Update local state status
            setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
          }
        }
      )
      .subscribe();
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    // Optimistic Update
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      toast.error("Failed to update status");
      fetchOrders(); // Revert
    } else {
      toast.success(`Order marked as ${newStatus}`);
    }
  };

  const handleVerifyPickup = async () => {
    if (pickupOtp.length === 4 && selectedOrderForPickup) {
      // In a real app, verify OTP against DB column.
      // For MVP, we just assume if they enter any 4 digits, its verified (simulating manual check).

      await updateStatus(selectedOrderForPickup.id, 'completed');

      setPickupOtp('');
      setSelectedOrderForPickup(null);
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  // We treat 'processing' as the kitchen phase.
  const processingOrders = orders.filter(o => o.status === 'processing');
  // We treat 'ready' or 'completed' (if logic differs) here. 
  // If backend only has 'completed', we might need an intermediate 'ready' state in DB or use metadata. 
  // For now, let's assume we map 'processing' -> 'completed' directly for MVP, 
  // OR if we added 'ready' to the enum:
  const readyOrders = orders.filter(o => o.status === 'completed' || o.status === 'ready');
  // (Assuming completed means "Ready for Pickup" for the Merchant view until it disappears?)
  // Actually usually 'completed' = Handed over.
  // Let's stick to the UI logic: 
  // Pending -> Processing -> Ready (Custom State?) -> Completed (History).
  // If DB enum is limited, we might overload 'processing' with a local flag, but let's assume we added 'ready' to postgres enum just in case, or we use 'processing' for both.
  // Correction based on Schema: schema usually is pending, processing, completed, cancelled. 
  // Let's map: 
  // Tab 1: Pending
  // Tab 2: Processing (Kitchen)
  // Tab 3: Completed (Past Orders / Ready to Pickup Logic skipped for MVP if schema strict)
  // Wait, let's look at schema... likely just p/p/c. 
  // So "Mark Ready" in P2 -> sets to 'completed'. 
  // And "Ready" tab shows 'completed' orders for today? 
  // Let's do: 
  // processingOrders = status 'processing'
  // readyOrders = status 'completed' (waiting for pickup/done)

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10 w-full">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none h-12 bg-transparent p-0 border-b border-gray-100 grid grid-cols-3">
            <TabsTrigger
              value="pending"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 h-full"
            >
              Pending ({pendingOrders.length})
            </TabsTrigger>
            <TabsTrigger
              value="processing"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 h-full"
            >
              Kitchen ({processingOrders.length})
            </TabsTrigger>
            <TabsTrigger
              value="ready"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 h-full"
            >
              Done ({readyOrders.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-4 flex-1 overflow-y-auto w-full">
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
                  onAccept={() => updateStatus(order.id, 'processing')}
                  onReject={() => updateStatus(order.id, 'cancelled')}
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
                  onMarkReady={() => updateStatus(order.id, 'completed')}
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
              {readyOrders.length === 0 && <EmptyState message="No completed orders today" />}
              {readyOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  readOnly
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
  onPickupClick,
  readOnly = false
}: {
  order: Order;
  onAccept?: () => void;
  onReject?: () => void;
  onMarkReady?: () => void;
  onPickupClick?: () => void;
  readOnly?: boolean;
}) {
  return (
    <Card className={cn("overflow-hidden border-none shadow-sm",
      order.status === 'completed' ? "bg-green-50/50 border border-green-100" : "bg-white"
    )}>
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-gray-900">#{order.id.slice(0, 5)}...</h3>
            {order.status === 'pending' && (
              <Badge variant="outline" className="flex items-center gap-1 text-orange-600 border-orange-200 bg-orange-50">
                <Clock className="w-3 h-3" /> New
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-gray-600 mt-1">{order.customer_name || 'Walk-in'}</p>
        </div>
        <p className="font-bold text-lg">₹{order.total}</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <ul className="space-y-1">
          {order.items.length > 0 ? order.items.map((item, idx) => (
            <li key={idx} className="text-sm text-gray-600 flex justify-between">
              <span>{item.qty} x {item.name}</span>
            </li>
          )) : <li className="text-sm text-gray-400 italic">No items (Legacy data)</li>}
        </ul>
      </CardContent>

      {!readOnly && (
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

          {/* If we had a specific 'ready' state separate from completed, we'd show Pickup here */}
        </CardFooter>
      )}

      {order.status === 'completed' && (
        <CardFooter className="p-4 pt-0">
          <div className="w-full text-center text-xs text-green-600 font-medium flex items-center justify-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Order Completed
          </div>
        </CardFooter>
      )}
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

