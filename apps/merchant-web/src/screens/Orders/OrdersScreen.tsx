import React, { useEffect, useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Card, CardContent, CardFooter, CardHeader } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Clock, Printer, CheckCircle2, XCircle, ShoppingBag, Settings, Volume2 } from 'lucide-react';
import { Drawer } from 'vaul';
import { Input } from '@/app/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Types aligning with DB
type OrderStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'cancelled';

interface OrderItem {
  id: string;
  menu_item_id: string; // or product_id
  quantity: number;
  product_name?: string;
  name?: string; // Adapter for UI
}

interface Order {
  id: string;
  customer_name: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  order_items: any[];
  items: { name: string; qty: number }[];
  total: number;
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [pickupOtp, setPickupOtp] = useState('');
  const [selectedOrderForPickup, setSelectedOrderForPickup] = useState<Order | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    const sub = subscribeToOrders();

    return () => {
      stopRinging();
      supabase.removeChannel(sub);
    };
  }, []);

  const getSoundUrl = () => {
    const saved = localStorage.getItem('merchant_notification_settings');
    const profile = saved ? JSON.parse(saved).soundProfile : 'chime';
    switch (profile) {
      case 'alarm': return 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
      case 'chime': return 'https://assets.mixkit.co/active_storage/sfx/2345/2345-preview.mp3';
      case 'siren': return 'https://assets.mixkit.co/active_storage/sfx/999/999-preview.mp3';
      default: return 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
    }
  };

  const startRinging = () => {
    const saved = localStorage.getItem('merchant_notification_settings');
    if (saved && !JSON.parse(saved).enabled) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(getSoundUrl());
      audioRef.current.loop = true; // LOOP until acknowledged
    }
    audioRef.current.play().catch(e => console.log('Audio blocked', e));
    setIsRinging(true);
  };

  const stopRinging = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsRinging(false);
  };

  const fetchOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
           *,
           quantity
        )
      `)
      .eq('store_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const adapted: Order[] = (data || []).map((o: any) => ({
      ...o,
      customerName: o.customer_name || 'Customer',
      status: o.status,
      total: o.amount || o.total_amount || 0,
      items: o.order_items?.map((i: any) => ({
        name: i.product_name || `Item`,
        qty: i.quantity
      })) || []
    }));

    setOrders(adapted);
  };

  const subscribeToOrders = () => {
    return supabase
      .channel('merchant-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            startRinging();
            toast.message("New Order!", {
              description: "Check Pending Tab",
              action: { label: "Stop Ringing", onClick: stopRinging }
            });
            fetchOrders();
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
          }
        }
      )
      .subscribe();
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    stopRinging(); // Acknowledge generic action
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  };

  const handleVerifyPickup = async () => {
    if (pickupOtp.length === 4 && selectedOrderForPickup) {

      // Use RPC for Secure Verification
      const { data: success, error } = await supabase.rpc('verify_pickup_code', {
        order_id_input: selectedOrderForPickup.id,
        code_input: pickupOtp
      });

      if (error) {
        console.error(error);
        toast.error("Verification System Error");
        return;
      }

      if (success) {
        toast.success("Code Verified! Handover Complete.");
        // Update local UI immediately
        setOrders(orders.map(o => o.id === selectedOrderForPickup.id ? { ...o, status: 'completed' } : o));
        setPickupOtp('');
        setSelectedOrderForPickup(null);
      } else {
        toast.error("Incorrect Code. Please ask customer to check app.");
        // Shake effect could go here
      }
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const processingOrders = orders.filter(o => o.status === 'processing');
  const readyOrders = orders.filter(o => o.status === 'completed' || o.status === 'ready');

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* Alert Banner */}
      {isRinging && (
        <div
          className="bg-indigo-600 text-white p-3 px-6 flex justify-between items-center cursor-pointer animate-pulse"
          onClick={stopRinging}
        >
          <div className="flex items-center gap-2 font-bold">
            <Volume2 className="w-5 h-5 animate-bounce" />
            New Order Ringing...
          </div>
          <Button size="sm" variant="secondary" onClick={stopRinging}>Dismiss</Button>
        </div>
      )}

      <div className="bg-white border-b sticky top-0 z-10 w-full">
        <div className="px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings/notifications')}>
            <Settings className="w-5 h-5 text-gray-500" />
          </Button>
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
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
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
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {processingOrders.length === 0 && <EmptyState message="Kitchen is clear" />}
              {processingOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onMarkReady={() => updateStatus(order.id, 'completed')} // Or 'ready' if added
                />
              ))}
            </motion.div>
          )}

          {activeTab === 'ready' && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {readyOrders.length === 0 && <EmptyState message="No completed orders today" />}
              {readyOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPickupClick={() => setSelectedOrderForPickup(order)}
                  isCompleted={order.status === 'completed'} // Pass flag to differentiate logic if needed
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
          <Drawer.Content className="bg-white flex flex-col rounded-t-[10px] h-[55vh] mt-24 fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto">
            <div className="p-6 bg-white rounded-t-[10px] flex-1 flex flex-col items-center">
              <div className="w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-8" />

              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-blue-600" />
              </div>

              <Drawer.Title className="font-bold text-center text-2xl mb-2">
                Verify Pickup
              </Drawer.Title>
              <Drawer.Description className="text-center text-gray-500 mb-8 max-w-xs">
                Ask <strong>{selectedOrderForPickup?.customer_name}</strong> for the 4-digit code shown in their app.
              </Drawer.Description>

              <div className="flex justify-center mb-8 w-full">
                <Input
                  type="text"
                  maxLength={4}
                  value={pickupOtp}
                  onChange={(e) => setPickupOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full max-w-[200px] text-center text-5xl tracking-[0.2em] font-bold h-20 border-2 border-gray-200 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all"
                  placeholder="0000"
                  autoFocus
                />
              </div>

              <Button
                className="w-full h-14 text-lg font-semibold bg-indigo-600 hover:bg-indigo-700"
                onClick={handleVerifyPickup}
                disabled={pickupOtp.length !== 4}
              >
                Verify & Handover
              </Button>
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
  isCompleted = false
}: {
  order: Order;
  onAccept?: () => void;
  onReject?: () => void;
  onMarkReady?: () => void;
  onPickupClick?: () => void;
  isCompleted?: boolean;
}) {
  return (
    <Card className={cn("overflow-hidden border-none shadow-sm transition-all",
      order.status === 'completed' ? "bg-green-50 border border-green-100 opacity-80" : "bg-white"
    )}>
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-gray-900">#{order.id.slice(0, 5)}</h3>
            {order.status === 'pending' && (
              <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                New
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-gray-600 mt-1">{order.customer_name || 'Guest'}</p>
        </div>
        <p className="font-bold text-lg">₹{order.total}</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="space-y-1">
          {order.items.length > 0 ? order.items.map((item, idx) => (
            <div key={idx} className="text-sm text-gray-700 flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="font-bold text-gray-900 w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs">{item.qty}</span>
                {item.name}
              </span>
            </div>
          )) : <span className="text-sm text-gray-400 italic">No items</span>}
        </div>
      </CardContent>

      {!isCompleted && (
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
                Accept
              </Button>
            </>
          )}

          {order.status === 'processing' && (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={onMarkReady}
            >
              Mark Ready
            </Button>
          )}
        </CardFooter>
      )}

      {/* Completed State Actions (e.g. if we want to re-verify for audit, but usually done) */}
      {isCompleted && (
        <CardFooter className="p-4 pt-0">
          <div className="w-full py-2 bg-green-100 text-green-700 rounded-md flex items-center justify-center gap-2 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" /> Picked Up
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
