import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from './useStore';

export function useEarnings() {
    const { storeId } = useStore();
    const [stats, setStats] = useState({
        today: 0,
        todayOrders: 0,
        weekly: 0,
        total: 0,
        orderCount: 0,
        pendingCount: 0,
        estimatedPayout: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!storeId) return;

        async function fetchStats() {
            setLoading(true);
            try {
                // Fetch all orders for this store (except CANCELLED for some stats, but let's get all to be safe)
                const { data, error } = await supabase
                    .from('Order')
                    .select('totalAmount, createdAt, status')
                    .eq('storeId', storeId);

                if (error) throw error;

                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const weekStart = todayStart - (7 * 24 * 60 * 60 * 1000);

                let todaySum = 0;
                let todayOrderCount = 0;
                let weeklySum = 0;
                let totalSum = 0;
                let completedCount = 0;
                let pendingCount = 0;

                data.forEach(order => {
                    const orderTime = new Date(order.createdAt).getTime();

                    // Today's Orders (all non-cancelled)
                    if (orderTime >= todayStart && order.status !== 'CANCELLED') {
                        todayOrderCount++;
                    }

                    if (order.status === 'COMPLETED') {
                        totalSum += order.totalAmount;
                        completedCount++;
                        if (orderTime >= todayStart) todaySum += order.totalAmount;
                        if (orderTime >= weekStart) weeklySum += order.totalAmount;
                    } else if (order.status !== 'CANCELLED' && order.status !== 'COMPLETED') {
                        pendingCount++;
                    }
                });

                setStats({
                    today: todaySum,
                    todayOrders: todayOrderCount,
                    weekly: weeklySum,
                    total: totalSum,
                    orderCount: completedCount,
                    pendingCount: pendingCount,
                    estimatedPayout: todaySum * 0.98 // 2% platform fee simulation
                });
            } catch (error) {
                console.error('Error fetching earnings:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();

        // Subscribe to real-time changes
        const channel = supabase.channel(`earnings-${storeId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'Order',
                filter: `storeId=eq.${storeId}`
            }, () => {
                fetchStats();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [storeId]);

    return { stats, loading };
}
