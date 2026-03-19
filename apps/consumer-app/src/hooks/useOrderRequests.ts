import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type OrderRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface OrderRequest {
    id: string;
    consumer_user_id: string;
    store_id: string;
    store_name: string;
    items: { id?: number; name: string; quantity: number; price: number }[];
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
        storeId: number;
        storeName: string;
        items: { id?: number; name: string; quantity: number; price: number }[];
        total: number;
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
        storeId: number;
        storeName: string;
        items: { id?: number; name: string; quantity: number; price: number }[];
        total: number;
    }[], replaceRequestId?: string): Promise<OrderRequest[]> => {
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const expiresAt = new Date(Date.now() + TIMEOUT_MS).toISOString();
            const now = new Date().toISOString();

            const rows = stores.map(store => ({
                consumer_user_id: user.id,
                store_id: String(store.storeId),
                store_name: store.storeName,
                items: store.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
                subtotal: store.total,
                status: 'PENDING' as const,
                expires_at: expiresAt,
                created_at: now,
                updated_at: now
            }));

            const { data, error } = await supabase
                .from('order_requests')
                .insert(rows)
                .select();

            if (error) throw error;

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
