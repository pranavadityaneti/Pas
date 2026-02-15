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
        totalAmount: 645,
        isPaid: false,
        createdAt: new Date(Date.now() - 30000).toISOString(), // 30s ago
        user: { name: 'Rahul Sharma', phone: '9876543210' },
        items: [
            { id: 'mi-1', quantity: 2, price: 50, storeProduct: { stock: 50, product: { name: 'Amul Butter', image: '', gstRate: 5 } } },
            { id: 'mi-2', quantity: 3, price: 14, storeProduct: { stock: 3, product: { name: 'Maggi Noodles', image: '', gstRate: 12 } } },
            { id: 'mi-3', quantity: 1, price: 180, storeProduct: { stock: 25, product: { name: 'Tata Tea Gold', image: '', gstRate: 5 } } },
            { id: 'mi-4', quantity: 2, price: 45, storeProduct: { stock: 15, product: { name: 'Parle-G 200g', image: '', gstRate: 18 } } },
            { id: 'mi-5', quantity: 1, price: 210, storeProduct: { stock: 8, product: { name: 'Surf Excel 1kg', image: '', gstRate: 12 } } }
        ]
    },
    {
        id: 'mock-2',
        displayId: 'PAS-4023',
        status: 'PENDING',
        totalAmount: 890,
        isPaid: true,
        createdAt: new Date(Date.now() - 60000).toISOString(), // 60s ago
        user: { name: 'Anita Singh', phone: '9988776655' },
        items: [
            { id: 'mi-6', quantity: 4, price: 30, storeProduct: { stock: 100, product: { name: 'Britannia Biscuits', image: '', gstRate: 18 } } },
            { id: 'mi-7', quantity: 1, price: 450, storeProduct: { stock: 2, product: { name: 'Basmati Rice 2kg', image: '', gstRate: 5 } } },
            { id: 'mi-8', quantity: 2, price: 160, storeProduct: { stock: 20, product: { name: 'Aashirvaad Atta', image: '', gstRate: 0 } } }
        ]
    },
    {
        id: 'mock-3',
        displayId: 'PAS-4024',
        status: 'PENDING',
        totalAmount: 1250,
        isPaid: false,
        createdAt: new Date(Date.now() - 45000).toISOString(), // 45s ago
        user: { name: 'Vikram Roy', phone: '9123456789' },
        items: [
            { id: 'mi-9', quantity: 1, price: 850, storeProduct: { stock: 10, product: { name: 'Cooking Oil 5L', image: '', gstRate: 5 } } },
            { id: 'mi-10', quantity: 5, price: 40, storeProduct: { stock: 45, product: { name: 'Toor Dal 500g', image: '', gstRate: 5 } } },
            { id: 'mi-11', quantity: 2, price: 100, storeProduct: { stock: 12, product: { name: 'Sugar 1kg', image: '', gstRate: 5 } } }
        ]
    },
    {
        id: 'mock-4',
        displayId: 'PAS-4025',
        status: 'PENDING',
        totalAmount: 420,
        isPaid: true,
        createdAt: new Date(Date.now() - 15000).toISOString(), // 15s ago
        user: { name: 'Priya Patel', phone: '9898989898' },
        items: [
            { id: 'mi-12', quantity: 6, price: 20, storeProduct: { stock: 60, product: { name: 'Milk Bread', image: '', gstRate: 0 } } },
            { id: 'mi-13', quantity: 2, price: 110, storeProduct: { stock: 4, product: { name: 'Peanut Butter', image: '', gstRate: 12 } } },
            { id: 'mi-14', quantity: 4, price: 20, storeProduct: { stock: 30, product: { name: 'Curd 200g', image: '', gstRate: 5 } } }
        ]
    },
    {
        id: 'mock-5',
        displayId: 'PAS-4026',
        status: 'PENDING',
        totalAmount: 1845,
        isPaid: false,
        createdAt: new Date(Date.now() - 90000).toISOString(), // 90s ago
        user: { name: 'Arjun Mehra', phone: '9765432109' },
        items: [
            { id: 'mi-15', quantity: 2, price: 55, storeProduct: { stock: 25, product: { name: 'Dettol Soap', image: '', gstRate: 18 } } },
            { id: 'mi-16', quantity: 1, price: 120, storeProduct: { stock: 14, product: { name: 'Colgate 200g', image: '', gstRate: 18 } } },
            { id: 'mi-17', quantity: 4, price: 20, storeProduct: { stock: 8, product: { name: 'Washing Soap', image: '', gstRate: 12 } } },
            { id: 'mi-18', quantity: 1, price: 45, storeProduct: { stock: 100, product: { name: 'Dishwash Bar', image: '', gstRate: 18 } } },
            { id: 'mi-19', quantity: 2, price: 75, storeProduct: { stock: 2, product: { name: 'Floor Cleaner', image: '', gstRate: 18 } } },
            { id: 'mi-20', quantity: 6, price: 10, storeProduct: { stock: 40, product: { name: 'Matches Box', image: '', gstRate: 5 } } },
            { id: 'mi-21', quantity: 1, price: 299, storeProduct: { stock: 5, product: { name: 'Honey 500g', image: '', gstRate: 0 } } },
            { id: 'mi-22', quantity: 2, price: 150, storeProduct: { stock: 12, product: { name: 'Nescafe Classic', image: '', gstRate: 18 } } },
            { id: 'mi-23', quantity: 3, price: 85, storeProduct: { stock: 30, product: { name: 'Peanut Butter Mini', image: '', gstRate: 12 } } },
            { id: 'mi-24', quantity: 5, price: 40, storeProduct: { stock: 20, product: { name: 'Cadbury Dairy Milk', image: '', gstRate: 12 } } },
            { id: 'mi-25', quantity: 1, price: 180, storeProduct: { stock: 15, product: { name: 'Ghee 200g', image: '', gstRate: 12 } } },
            { id: 'mi-26', quantity: 2, price: 65, storeProduct: { stock: 6, product: { name: 'Tomato Ketchup', image: '', gstRate: 12 } } }
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
                setOrders([]);
            } else {
                setOrders(fetchedOrders);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            // Only use mock fallback if we have NO storeId (demo mode)
            if (!storeId) {
                setOrders(MOCK_ORDERS);
            }
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

    const updateOrderStatus = async (orderId: string, status: OrderStatus, reason?: string) => {
        if (orderId.startsWith('mock-')) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, cancelledReason: reason } : o));
            return { success: true };
        }

        try {
            const body: any = { status };
            if (reason) body.reason = reason;

            const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('Failed to update status');

            const updatedOrder = await response.json();
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: updatedOrder.status, cancelledReason: updatedOrder.cancelledReason } : o));
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
