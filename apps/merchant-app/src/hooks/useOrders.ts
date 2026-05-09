import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from './useStore';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'REJECTED' | 'RETURN_REQUESTED' | 'RETURN_APPROVED' | 'RETURN_REJECTED' | 'REFUNDED';

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
    otp?: string;
    createdAt: string;
    user: {
        id?: string;
        name: string;
        phone: string;
    };
    items: OrderItem[];
    cancelledReason?: string; // Added for cancellation reason
    returnReason?: string; // Added for return reason
    returnImages?: string[]; // Added for return proof
}

// Removed Mock Data

export interface DateRange {
    startDate: string; // ISO string
    endDate: string;   // ISO string
}

function getDefaultDateRange(): DateRange {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return {
        startDate: start.toISOString(),
        endDate: end.toISOString()
    };
}

export function useOrders(dateRange?: DateRange) {
    const { merchantId, activeStoreId } = useStore();

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const fetchIdRef = useRef(0);

    // Ensure date range is always a valid, stable ISO string pair
    const safeStartDate = useMemo(() => {
        try {
            const d = dateRange?.startDate ? new Date(dateRange.startDate) : null;
            if (d && !isNaN(d.getTime())) return d.toISOString();
        } catch {}
        const fallback = new Date();
        fallback.setDate(fallback.getDate() - 7);
        fallback.setHours(0, 0, 0, 0);
        return fallback.toISOString();
    }, [dateRange?.startDate]);

    const safeEndDate = useMemo(() => {
        try {
            const d = dateRange?.endDate ? new Date(dateRange.endDate) : null;
            if (d && !isNaN(d.getTime())) return d.toISOString();
        } catch {}
        return new Date().toISOString();
    }, [dateRange?.endDate]);

    const formatId = (id: string) => {
        const hash = id.split('-')[0];
        const num = parseInt(hash, 16) % 10000;
        return `PAS-${num.toString().padStart(4, '0')}`;
    };

    const fetchOrders = useCallback(async (isRefresh = false) => {
        const currentFetchId = ++fetchIdRef.current;
        console.log("MERCHANT_QUERY_ID:", merchantId, "ACTIVE_BRANCH:", activeStoreId);
        if (!merchantId) {
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
                .eq('store_id', merchantId)
                .gte('created_at', safeStartDate)
                .lte('created_at', safeEndDate)
                .order('created_at', { ascending: false });

            // Branch routing: scope orders to the active workspace
            if (activeStoreId && merchantId) {
                if (activeStoreId === merchantId) {
                    // Main store selected — show orders without a branch OR where branch_id equals the main store's ID
                    query = query.or(`branch_id.is.null,branch_id.eq.${merchantId}`);
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
                otp: o.otp || o.otp_code,
                createdAt: o.created_at,
                user: { id: o.user_id, name: profilesMap[o.user_id]?.name || 'Guest', phone: 'N/A' },
                items: (o.items || []).map((item: any) => ({
                    id: item.id,
                    quantity: item.quantity,
                    price: item.price,
                    storeProduct: Array.isArray(item.storeProduct) ? item.storeProduct[0] : item.storeProduct
                })),
                cancelledReason: o.cancelled_reason, // Map cancelled_reason
                returnReason: o.return_reason, // Map return_reason
                returnImages: o.return_images || [], // Map return_images
                orderRequestId: o.metadata?.orderRequestId // Extract orderRequestId
            }));

            // 1. Fetch pending/accepted requests — scoped to merchant + active branch
            let reqQuery = supabase
                .from('order_requests')
                .select('*')
                .eq('store_id', merchantId)
                .in('status', ['PENDING', 'ACCEPTED', 'REJECTED'])
                .gte('created_at', safeStartDate)
                .lte('created_at', safeEndDate);

            // Branch routing: mirror the orders query logic
            if (activeStoreId === merchantId) {
                // Main store view — include requests with branch_id = merchantId or null
                reqQuery = reqQuery.or(`branch_id.is.null,branch_id.eq.${merchantId}`);
            } else {
                // Specific branch view
                reqQuery = reqQuery.eq('branch_id', activeStoreId);
            }

            const { data: requestData } = await reqQuery;

            // 2. Map to mimic real Orders, but flag the ID
            const statusMap = (s: string): OrderStatus => {
                if (s === 'ACCEPTED') return 'CONFIRMED';
                if (s === 'REJECTED') return 'REJECTED';
                return 'PENDING';
            };
            let mappedRequests = (requestData || []).map((r: any) => ({
                id: `req_${r.id}`, // Flagged ID
                displayId: `REQ-${r.id.substring(0,4).toUpperCase()}`,
                status: statusMap(r.status),
                totalAmount: r.subtotal,
                isPaid: false,
                createdAt: r.created_at,
                user: { id: r.consumer_user_id, name: r.status === 'REJECTED' ? 'Rejected Request' : 'Awaiting Payment', phone: 'N/A' },
                items: r.items.map((item: any) => ({
                    id: String(item.id || Math.random()),
                    quantity: item.quantity,
                    price: item.price,
                    storeProduct: { stock: 99, product: { name: item.name, image: '', gstRate: 0 } }
                })),
                cancelledReason: r.rejection_reason || undefined,
                returnReason: undefined,
                returnImages: []
            }));

            // Deduplication logic: Aggressively filter out order_requests if a real paid Order exists 
            // for the same user that was created recently (assuming it's the fulfillment of the request).
            mappedRequests = mappedRequests.filter((req: any) => {
                const rawReqId = req.id.replace('req_', '');
                const hasRealOrder = realOrders.some((ro: any) => 
                    ro.orderRequestId === rawReqId
                );
                return !hasRealOrder;
            });

            if (currentFetchId === fetchIdRef.current) {
                setOrders([...mappedRequests, ...realOrders]);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            setOrders([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [merchantId, activeStoreId, safeStartDate, safeEndDate]);

    useEffect(() => {
        fetchOrders();

        if (merchantId && activeStoreId) {
            // Keep realtime subscription broad (store-level) to avoid
            // Supabase filter quirks with is.null on branch_id
            const channel = supabase.channel(`orders-${merchantId}-${activeStoreId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `store_id=eq.${merchantId}`
                }, (payload) => {
                    if (payload.eventType === 'DELETE') {
                        console.log('Real-time order update (unconditional):', payload.eventType);
                        fetchOrders();
                        return;
                    }

                    console.log('[Realtime]', payload.eventType, payload.table);

                    const incoming = (payload.new ?? payload.old) as any;
                    const incomingBranchId = incoming?.branch_id;

                    // Branch view — only care about orders for the active branch
                    const isRelevant = incomingBranchId === activeStoreId;

                    if (isRelevant) {
                        console.log('Real-time order update (relevant):', payload.eventType);
                        fetchOrders();
                    } else {
                        console.log('Real-time order update (filtered out — different branch)');
                    }
                })
                .subscribe();

            // Secondary subscription for order_requests
            const reqChannel = supabase.channel(`requests-${merchantId}-${activeStoreId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'order_requests',
                    filter: `branch_id=eq.${activeStoreId}`
                }, (payload) => {
                    if (payload.eventType === 'DELETE') {
                        console.log('Real-time order request update (unconditional):', payload.eventType);
                        fetchOrders();
                        return;
                    }

                    // With server-side filtering on branch_id, all received events are relevant.
                    console.log('Real-time order request (relevant):', payload.eventType);
                    fetchOrders();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
                supabase.removeChannel(reqChannel);
            };
        }
    }, [merchantId, activeStoreId, fetchOrders]);

    const updateOrderStatus = async (orderId: string, status: OrderStatus, cancellationReason?: string) => {
        // INTERCEPT: If this is an order_request, bypass the backend and update Supabase directly
        if (orderId.startsWith('req_')) {
            const rawId = orderId.replace('req_', '');
            
            // Map the merchant status intent to the request status
            const newReqStatus = (status === 'CONFIRMED' || status === 'PREPARING') ? 'ACCEPTED' : 'REJECTED';
            
            const { error } = await supabase
                .from('order_requests')
                .update({ status: newReqStatus, rejection_reason: cancellationReason })
                .eq('id', rawId);
                
            if (error) return { success: false, error };
            
            // Optimistically remove the request from the UI. 
            // The real paid order will arrive via real-time websockets later.
            setOrders(prev => prev.filter(o => o.id !== orderId));
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
