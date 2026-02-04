import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from './useStore';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface OrderItem {
    id: string;
    quantity: number;
    price: number;
    storeProduct: {
        stock: number;
        product: {
            name: string;
            image: string;
            gstRate: number | null;
        }
    }
}

export interface Order {
    id: string;
    displayId: string;
    status: OrderStatus;
    totalAmount: number;
    isPaid: boolean;
    createdAt: string;
    user: {
        name: string;
        phone: string;
    };
    items: OrderItem[];
}

const MOCK_ORDERS: Order[] = [
    {
        id: 'mock-1',
        displayId: 'PAS-4022',
        status: 'PENDING',
        totalAmount: 425,
        isPaid: false,
        createdAt: new Date(Date.now() - 30000).toISOString(),
        user: { name: 'Rahul Sharma', phone: '9876543210' },
        items: [
            {
                id: 'mi-1',
                quantity: 2,
                price: 50,
                storeProduct: { stock: 50, product: { name: 'Amul Butter', image: '', gstRate: 5 } }
            },
            {
                id: 'mi-2',
                quantity: 3,
                price: 14,
                storeProduct: { stock: 3, product: { name: 'Maggi Noodles', image: '', gstRate: 12 } }
            },
            {
                id: 'mi-3',
                quantity: 1,
                price: 180,
                storeProduct: { stock: 25, product: { name: 'Tata Tea Gold', image: '', gstRate: 5 } }
            }
        ]
    }
];

export function useOrders() {
    const { storeId } = useStore();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const formatId = (id: string) => {
        if (id.startsWith('mock-')) return id.replace('mock-', 'PAS-');
        const hash = id.split('-')[0];
        const num = parseInt(hash, 16) % 10000;
        return `PAS-${num.toString().padStart(4, '0')}`;
    };

    const fetchOrders = useCallback(async (isRefresh = false) => {
        if (!storeId) {
            setOrders(MOCK_ORDERS);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const { data, error } = await supabase
                .from('Order')
                .select(`
                    id,
                    status,
                    totalAmount,
                    ispaid,
                    createdAt,
                    user:User (name, phone),
                    items:OrderItem (
                        id,
                        quantity,
                        price,
                        storeProduct:StoreProduct (
                            stock,
                            product:Product (name, image, gstRate)
                        )
                    )
                `)
                .eq('storeId', storeId)
                .order('createdAt', { ascending: false });

            if (error) throw error;

            const fetchedOrders: Order[] = (data as any[] || []).map(order => ({
                id: order.id,
                displayId: formatId(order.id),
                status: order.status,
                totalAmount: order.totalAmount,
                isPaid: order.ispaid,
                createdAt: order.createdAt,
                user: Array.isArray(order.user) ? order.user[0] : order.user,
                items: (order.items || []).map((item: any) => ({
                    id: item.id,
                    quantity: item.quantity,
                    price: item.price,
                    storeProduct: Array.isArray(item.storeProduct) ? item.storeProduct[0] : item.storeProduct
                }))
            }));

            if (fetchedOrders.length === 0) {
                setOrders(MOCK_ORDERS);
            } else {
                setOrders(fetchedOrders);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            setOrders(MOCK_ORDERS);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [storeId]);

    useEffect(() => {
        fetchOrders();

        if (storeId) {
            // Real-time updates from Supabase
            const channel = supabase.channel(`orders-${storeId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'Order',
                    filter: `storeId=eq.${storeId}`
                }, (payload) => {
                    console.log('Real-time order update:', payload);
                    fetchOrders();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [storeId, fetchOrders]);

    const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
        if (orderId.startsWith('mock-')) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
            return { success: true };
        }

        try {
            const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (!response.ok) throw new Error('Failed to update status');

            const updatedOrder = await response.json();
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: updatedOrder.status } : o));
            return { success: true };
        } catch (error) {
            console.error('Error updating order status:', error);
            return { success: false, error };
        }
    };

    const verifyOTP = async (orderId: string, otp: string) => {
        if (orderId.startsWith('mock-')) {
            if (otp === '1234') {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'COMPLETED' } : o));
                return { success: true };
            }
            return { success: false, error: 'Invalid PIN' };
        }

        try {
            const response = await fetch(`${API_URL}/orders/${orderId}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Verification failed');
            }

            const result = await response.json();
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'COMPLETED' } : o));
            return { success: true };
        } catch (error: any) {
            console.error('Error verifying OTP:', error);
            return { success: false, error: error.message };
        }
    };

    return {
        orders,
        loading,
        refreshing,
        refetch: () => fetchOrders(true),
        updateOrderStatus,
        verifyOTP
    };
}
