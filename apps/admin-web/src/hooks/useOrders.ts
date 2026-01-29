import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export type Order = {
    id: string;
    customer_name: string;
    customer_phone: string;
    store_name: string;
    store_id: string;
    user_id?: string;
    status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'disputed';
    amount: number;
    sla_minutes: number;
    created_at: string;
};

export function useOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();

        // Subscribe to realtime changes
        const subscription = supabase
            .channel('public:orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                handleRealtimeUpdate(payload);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data as Order[] || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
            // Quiet fail if table doesn't exist yet (dev mode)
        } finally {
            setLoading(false);
        }
    };

    const handleRealtimeUpdate = (payload: any) => {
        if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new, ...prev]);
            toast.info('New Order Received!', { description: `Order #${payload.new.id.slice(0, 8)}` });
        } else if (payload.eventType === 'UPDATE') {
            setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o));
        } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
    };

    const updateOrderStatus = async (id: string, status: string) => {
        try {
            const { error } = await supabase.from('orders').update({ status }).eq('id', id);
            if (error) throw error;
            toast.success(`Order status updated to ${status}`);
        } catch (error) {
            toast.error('Failed to update order status');
        }
    };

    return { orders, loading, updateOrderStatus };
}
