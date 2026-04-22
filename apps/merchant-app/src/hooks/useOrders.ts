import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from './useStore';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

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

// Removed Mock Data

export function useOrders() {
    const { storeId, merchantId, activeStoreId } = useStore();

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const formatId = (id: string) => {
        const hash = id.split('-')[0];
        const num = parseInt(hash, 16) % 10000;
        return `PAS-${num.toString().padStart(4, '0')}`;
    };

    const fetchOrders = useCallback(async (isRefresh = false) => {
        if (!storeId) {
            setOrders([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    items:order_items(
                        id, quantity, price,
                        storeProduct:"StoreProduct"(
                            stock,
                            product:"Product"(name, image, gstRate)
                        )
                    )
                `)
                .eq('store_id', storeId)
                .order('created_at', { ascending: false });

            // Branch routing: scope orders to the active workspace
            if (activeStoreId && merchantId) {
                if (activeStoreId === merchantId) {
                    // Main store selected — show orders without a branch
                    query = query.is('branch_id', null);
                } else {
                    // Specific branch selected
                    query = query.eq('branch_id', activeStoreId);
                }
            }

            const { data, error } = await query;

            if (error) throw error;

            // Application-level JOIN for user profiles to bypass missing physical foreign keys
            const userIds = [...new Set((data || []).map((o: any) => o.user_id).filter(Boolean))];
            let profilesMap: Record<string, any> = {};
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);
                if (profiles) {
                    profiles.forEach((p: any) => {
                        profilesMap[p.id] = { name: p.full_name || 'Guest', phone: 'N/A' };
                    });
                }
            }

            // Use real data strictly
            const realOrders = (data || []).map((o: any) => ({
                id: o.id,
                displayId: formatId(o.id), // Use formatId for real orders too
                status: o.status,
                totalAmount: o.total_amount,
                isPaid: o.ispaid,
                createdAt: o.created_at,
                user: profilesMap[o.user_id] || { name: 'Guest', phone: 'N/A' },
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

            setOrders(realOrders);

        } catch (error) {
            console.error('Error fetching orders:', error);
            setOrders([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [storeId, activeStoreId]);

    useEffect(() => {
        fetchOrders();

        if (storeId) {
            // Keep realtime subscription broad (store-level) to avoid
            // Supabase filter quirks with is.null on branch_id
            const channel = supabase.channel(`orders-${storeId}-${activeStoreId || 'main'}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `store_id=eq.${storeId}`
                }, (payload) => {
                    const incoming = payload.new as any;
                    const incomingBranchId = incoming?.branch_id || null;

                    // Manually filter: only process if the payload matches the active workspace
                    let isRelevant = true;
                    if (activeStoreId && merchantId) {
                        if (activeStoreId === merchantId) {
                            // Main store view — only care about orders with no branch
                            isRelevant = incomingBranchId === null;
                        } else {
                            // Branch view — only care about orders for this branch
                            isRelevant = incomingBranchId === activeStoreId;
                        }
                    }

                    if (isRelevant) {
                        console.log('Real-time order update (relevant):', payload.eventType);
                        fetchOrders();
                    } else {
                        console.log('Real-time order update (filtered out — different branch)');
                    }
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [storeId, activeStoreId, merchantId, fetchOrders]);

    const updateOrderStatus = async (orderId: string, status: OrderStatus, cancellationReason?: string) => {

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
