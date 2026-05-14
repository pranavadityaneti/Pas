import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type OrderRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface OrderRequest {
    id: string;
    consumer_user_id: string;
    store_id: string;
    branch_id: string;
    store_name: string;
    items: { id?: string | number; name: string; quantity: number; price: number }[];
    subtotal: number;
    status: OrderRequestStatus;
    rejection_reason: string | null;
    expires_at: string;
    created_at: string;
    updated_at: string;
}

interface UseOrderRequestsReturn {
    requests: OrderRequest[];
    loading: boolean;
    allResolved: boolean;
    acceptedRequests: OrderRequest[];
    rejectedRequests: OrderRequest[];
    createRequests: (stores: {
        storeId: string | number;
        storeName: string;
        items: { id?: string | number; name: string; quantity: number; price: number }[];
        total: number;
        arrivalTime?: string;
        orderType?: 'pickup' | 'dine-in';
        guestsCount?: number;
    }[], replaceRequestId?: string) => Promise<OrderRequest[]>;
    expireRequest: (requestId: string) => Promise<void>;
    cleanup: () => void;
}

const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export function useOrderRequests(): UseOrderRequestsReturn {
    const [requests, setRequests] = useState<OrderRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const channelRef = useRef<any>(null);
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Derived state
    const allResolved = requests.length > 0 && requests.every(r => r.status !== 'PENDING');
    const acceptedRequests = requests.filter(r => r.status === 'ACCEPTED');
    const rejectedRequests = requests.filter(r => r.status === 'REJECTED' || r.status === 'EXPIRED');

    // Create order requests for each store
    const createRequests = useCallback(async (stores: {
        storeId: string | number;
        storeName: string;
        items: { id?: string | number; name: string; quantity: number; price: number }[];
        total: number;
        arrivalTime?: string;
        orderType?: 'pickup' | 'dine-in';
        guestsCount?: number;
    }[], replaceRequestId?: string): Promise<OrderRequest[]> => {
        setLoading(true);

        try {
            // First check session — if expired or expiring soon, refresh proactively
            let { data: { session } } = await supabase.auth.getSession();
            
            // Check if token is expired or expiring within 60 seconds
            const tokenExpired = session?.expires_at 
                ? (session.expires_at * 1000) - Date.now() < 60_000 
                : true;
            
            if (!session || tokenExpired) {
                console.warn('[useOrderRequests] Session missing or expiring — attempting refresh');
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError || !refreshData.session) {
                    throw new Error('Your session has expired. Please log in again.');
                }
                session = refreshData.session;
            }
            
            const user = session.user;
            if (!user) throw new Error('User not authenticated');

            // Fetch the parent merchant IDs for the legacy schema constraints
            const branchIds = stores.map(s => String(s.storeId));
            const { data: branchData } = await supabase
                .from('merchant_branches')
                .select('id, merchant_id')
                .in('id', branchIds);

            const merchantIdMap = new Map(branchData?.map(b => [b.id, b.merchant_id]));

            const rows = stores.map(store => {
                const bId = String(store.storeId);
                return {
                    // Note: expires_at, created_at, and updated_at are handled server-side
                    consumer_user_id: user.id,
                    store_id: merchantIdMap.get(bId) || bId,
                    branch_id: bId,
                    store_name: store.storeName,
                    items: store.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
                    subtotal: store.total,
                    status: 'PENDING' as const,
                    arrival_time: store.arrivalTime || null,
                    order_type: store.orderType || null,
                    guests_count: store.guestsCount || null
                };
            });

            if (__DEV__) {
                console.log("PAYLOAD_AUDIT:", JSON.stringify(rows, null, 2));
            }

            // Use the new API endpoint instead of direct Supabase insert
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            if (!apiUrl) throw new Error('API URL is not defined');

            if (!session?.access_token) throw new Error('No valid session token');

            const response = await fetch(`${apiUrl}/order-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ requests: rows })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API error: ${errText}`);
            }

            const data = await response.json();
            const insertedRequests = (data || []) as OrderRequest[];

            setRequests(prev => {
                if (replaceRequestId) {
                    return [...prev.filter(r => r.id !== replaceRequestId), ...insertedRequests];
                }
                return [...prev, ...insertedRequests];
            });

            // Subscribe to realtime updates
            subscribeToUpdates(insertedRequests.map(r => r.id), user.id);

            // Set auto-expire timers
            insertedRequests.forEach(req => {
                const timer = setTimeout(() => {
                    expireRequest(req.id);
                }, TIMEOUT_MS);
                timersRef.current.set(req.id, timer);
            });

            return insertedRequests;
        } catch (err) {
            console.error('[useOrderRequests] Error creating requests:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Subscribe to realtime changes
    const subscribeToUpdates = useCallback((requestIds: string[], userId: string) => {
        // Clean up previous subscription
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase
            .channel(`order_requests_${userId}_${Date.now()}`)
            .on(
                'postgres_changes' as any,
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'order_requests',
                    filter: `consumer_user_id=eq.${userId}`
                },
                (payload: any) => {
                    const updated = payload.new as OrderRequest;
                    console.log('[useOrderRequests] Realtime update:', updated.store_name, updated.status);

                    setRequests(prev => prev.map(r =>
                        r.id === updated.id ? { ...r, ...updated } : r
                    ));

                    // Clear the expiry timer if already resolved
                    if (updated.status !== 'PENDING') {
                        const timer = timersRef.current.get(updated.id);
                        if (timer) {
                            clearTimeout(timer);
                            timersRef.current.delete(updated.id);
                        }
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;
    }, []);

    // Expire a request (auto-called after 2 minutes)
    const expireRequest = useCallback(async (requestId: string) => {
        try {
            const { error } = await supabase
                .from('order_requests')
                .update({
                    status: 'EXPIRED',
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId)
                .eq('status', 'PENDING'); // Only expire if still pending

            if (error) console.error('[useOrderRequests] Error expiring:', error);

            // Update local state
            setRequests(prev => prev.map(r =>
                r.id === requestId && r.status === 'PENDING'
                    ? { ...r, status: 'EXPIRED' as const }
                    : r
            ));

            // Cleanup timer reference
            const timer = timersRef.current.get(requestId);
            if (timer) {
                clearTimeout(timer);
                timersRef.current.delete(requestId);
            }
        } catch (err) {
            console.error('[useOrderRequests] expireRequest error:', err);
        }
    }, []);

    // Cleanup
    const cleanup = useCallback(() => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
        timersRef.current.forEach(timer => clearTimeout(timer));
        timersRef.current.clear();
        setRequests([]);
    }, []);

    // Auto-cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        requests,
        loading,
        allResolved,
        acceptedRequests,
        rejectedRequests,
        createRequests,
        expireRequest,
        cleanup
    };
}
