import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from './useStore';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'RETURN_REQUESTED' | 'RETURN_APPROVED' | 'RETURN_REJECTED' | 'REFUNDED';

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
    cancelledReason?: string; // Added for cancellation reason
    returnReason?: string; // Added for return reason
    returnImages?: string[]; // Added for return proof
}

// MOCK DATA DEFINITION
const INITIAL_MOCK_ORDERS: Order[] = [
    // --- PENDING ORDERS ---
    { id: 'mock-p1', displayId: 'PAS-M001', status: 'PENDING', totalAmount: 450, isPaid: true, createdAt: new Date().toISOString(), user: { name: 'Rohan Gupta', phone: '9876500001' }, items: [{ id: 'mi-1', quantity: 1, price: 450, storeProduct: { stock: 10, product: { name: 'Basmati Rice 5kg', image: '', gstRate: 0 } } }] },
    { id: 'mock-p2', displayId: 'PAS-M002', status: 'PENDING', totalAmount: 120, isPaid: true, createdAt: new Date(Date.now() - 60000).toISOString(), user: { name: 'Sneha Reddy', phone: '9876500002' }, items: [{ id: 'mi-2', quantity: 2, price: 60, storeProduct: { stock: 20, product: { name: 'Amul Milk', image: '', gstRate: 0 } } }] },
    { id: 'mock-p3', displayId: 'PAS-M003', status: 'PENDING', totalAmount: 890, isPaid: false, createdAt: new Date(Date.now() - 120000).toISOString(), user: { name: 'Amit Kumar', phone: '9876500003' }, items: [{ id: 'mi-3', quantity: 1, price: 890, storeProduct: { stock: 5, product: { name: 'Sunflower Oil 5L', image: '', gstRate: 5 } } }] },

    // --- PROCESSING ORDERS ---
    { id: 'mock-pr1', displayId: 'PAS-M004', status: 'CONFIRMED', totalAmount: 340, isPaid: true, createdAt: new Date(Date.now() - 3600000).toISOString(), user: { name: 'Priya Singh', phone: '9876500004' }, items: [{ id: 'mi-4', quantity: 2, price: 170, storeProduct: { stock: 15, product: { name: 'Tata Tea', image: '', gstRate: 5 } } }] },
    { id: 'mock-pr2', displayId: 'PAS-M005', status: 'PREPARING', totalAmount: 1500, isPaid: true, createdAt: new Date(Date.now() - 7200000).toISOString(), user: { name: 'Vikram Malhotra', phone: '9876500005' }, items: [{ id: 'mi-5', quantity: 3, price: 500, storeProduct: { stock: 8, product: { name: 'Whey Protein', image: '', gstRate: 18 } } }] },

    // --- READY ORDERS ---
    { id: 'mock-r1', displayId: 'PAS-M006', status: 'READY', totalAmount: 220, isPaid: true, createdAt: new Date(Date.now() - 10000000).toISOString(), user: { name: 'Anjali Das', phone: '9876500006' }, items: [{ id: 'mi-6', quantity: 4, price: 55, storeProduct: { stock: 30, product: { name: 'Dettol Soap', image: '', gstRate: 12 } } }] },

    // --- RETURNS REQUESTED ---
    {
        id: 'mock-ret1',
        displayId: 'PAS-M007',
        status: 'RETURN_REQUESTED',
        totalAmount: 550,
        isPaid: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        returnReason: 'Damaged item',
        returnImages: ['https://placehold.co/300x300/red/white?text=Broken+Seal', 'https://placehold.co/300x300/orange/white?text=Leaking'],
        user: { name: 'Karan Johar', phone: '9876500007' },
        items: [{ id: 'mi-7', quantity: 1, price: 550, storeProduct: { stock: 12, product: { name: 'Mixer Grinder', image: '', gstRate: 18 } } }]
    },
    {
        id: 'mock-ret2',
        displayId: 'PAS-M008',
        status: 'RETURN_REQUESTED',
        totalAmount: 120,
        isPaid: true,
        createdAt: new Date(Date.now() - 90000000).toISOString(),
        returnReason: 'Expired product',
        returnImages: ['https://placehold.co/300x300/black/white?text=Expiry+Date'],
        user: { name: 'Simran Kaur', phone: '9876500008' },
        items: [{ id: 'mi-8', quantity: 2, price: 60, storeProduct: { stock: 25, product: { name: 'Bread', image: '', gstRate: 0 } } }]
    },
    { id: 'mock-ret3', displayId: 'PAS-M009', status: 'RETURN_REQUESTED', totalAmount: 2100, isPaid: true, createdAt: new Date(Date.now() - 95000000).toISOString(), returnReason: 'Wrong item delivered', user: { name: 'Raj Malhotra', phone: '9876500009' }, items: [{ id: 'mi-9', quantity: 1, price: 2100, storeProduct: { stock: 4, product: { name: 'Bluetooth Speaker', image: '', gstRate: 18 } } }] },

    // --- RETURNS APPROVED (For Refund) ---
    { id: 'mock-ref1', displayId: 'PAS-M010', status: 'RETURN_APPROVED', totalAmount: 800, isPaid: true, createdAt: new Date(Date.now() - 172800000).toISOString(), user: { name: 'Tina Ambani', phone: '9876500010' }, items: [{ id: 'mi-10', quantity: 1, price: 800, storeProduct: { stock: 7, product: { name: 'Dinner Set', image: '', gstRate: 12 } } }] },

    // --- HISTORY ---
    { id: 'mock-h1', displayId: 'PAS-M011', status: 'COMPLETED', totalAmount: 300, isPaid: true, createdAt: new Date(Date.now() - 200000000).toISOString(), user: { name: 'Old Customer', phone: '9876500011' }, items: [{ id: 'mi-11', quantity: 3, price: 100, storeProduct: { stock: 10, product: { name: 'Notebooks', image: '', gstRate: 5 } } }] },
    { id: 'mock-h2', displayId: 'PAS-M012', status: 'REFUNDED', totalAmount: 450, isPaid: false, createdAt: new Date(Date.now() - 250000000).toISOString(), user: { name: 'Refunded Guy', phone: '9876500012' }, items: [{ id: 'mi-12', quantity: 1, price: 450, storeProduct: { stock: 2, product: { name: 'Failed Item', image: '', gstRate: 12 } } }] }
];

export function useOrders() {
    const { storeId } = useStore();
    // Use REF to persist mock state across re-renders and refetches
    const mockOrdersRef = React.useRef<Order[]>(INITIAL_MOCK_ORDERS);

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
            setOrders([...mockOrdersRef.current]);
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
                    *,
                    user:User!Order_user_id_fkey(name, phone),
                    items:OrderItem(
                        id, quantity, price,
                        storeProduct:StoreProduct(
                            stock,
                            product:Product(name, image, gstRate)
                        )
                    )
                `)
                .eq('store_id', storeId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // MERGE: Real Data + Persistent Mock Data
            const realOrders = (data || []).map((o: any) => ({
                id: o.id,
                displayId: formatId(o.id), // Use formatId for real orders too
                status: o.status,
                totalAmount: o.total_amount,
                isPaid: o.ispaid,
                createdAt: o.created_at,
                user: Array.isArray(o.user) ? o.user[0] : o.user,
                items: (o.items || []).map((item: any) => ({
                    id: item.id,
                    quantity: item.quantity,
                    price: item.price,
                    storeProduct: Array.isArray(item.storeProduct) ? item.storeProduct[0] : item.storeProduct
                })),
                cancelledReason: o.cancelled_reason, // Map cancelled_reason
                returnReason: o.return_reason, // Map return_reason
                returnImages: o.return_images || [] // Map return_images
            }));

            setOrders([...mockOrdersRef.current, ...realOrders]);

        } catch (error) {
            console.error('Error fetching orders:', error);
            // On error, still show mocks
            setOrders([...mockOrdersRef.current]);
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
                    filter: `store_id=eq.${storeId}`
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

    const updateOrderStatus = async (orderId: string, status: OrderStatus, cancellationReason?: string) => {
        // Handle MOCK IDs locally
        if (orderId.startsWith('mock-')) {
            // Update the Ref so change persists on next fetch
            mockOrdersRef.current = mockOrdersRef.current.map(o =>
                o.id === orderId ? { ...o, status, cancelledReason: cancellationReason } : o
            );
            // Update State for immediate UI reflection
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, cancelledReason: cancellationReason } : o));
            return { success: true };
        }

        try {
            const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, cancellationReason })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[useOrders] Backend Error:', errorData);
                throw new Error(errorData.error || errorData.details || 'Failed to update status');
            }

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

    const refundOrder = async (orderId: string, amount?: number, reason?: string) => {
        if (orderId.startsWith('mock-')) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'REFUNDED' } : o));
            return { success: true };
        }

        try {
            const body: any = {};
            if (amount) body.amount = amount;
            if (reason) body.reason = reason;

            const response = await fetch(`${API_URL}/orders/${orderId}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const text = await response.text();
                let err;
                try {
                    err = JSON.parse(text);
                } catch (e) {
                    err = { error: `Server Error (${response.status}): ${text.substring(0, 100)}...` };
                }
                throw new Error(err.error || err.details || 'Refund failed');
            }

            const result = await response.json();
            if (result.order) {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: result.order.status } : o));
            }
            return { success: true };
        } catch (error: any) {
            console.error('Error refunding order:', error);
            return { success: false, error: error.message };
        }
    };

    return {
        orders,
        loading,
        refreshing,
        refetch: () => fetchOrders(true),
        updateOrderStatus,
        verifyOTP,
        refundOrder
    };
}
