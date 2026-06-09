// @lock
// VERIFIED WORKING in production (Android pickup order, May 25 2026). Polling
// fallback + AppState reconnect for Supabase Realtime. Do NOT edit without
// explicit user approval — order acceptance UX hangs on this hook.
//
// Approved layers:
//   1. store_id silent-fallback fix (approved 2026-06-08, Option A patch #7 —
//      makes merchant-resolution failures loud instead of silently writing
//      branch_id as store_id. Does not touch realtime/polling/timer logic.)
import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
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
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pendingIdsRef = useRef<string[]>([]);
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
            // Always refresh the session before calling protected endpoints — safer than
            // relying on local expires_at math (which can drift if device clock is off
            // or the session was loaded from stale storage).
            console.log('[useOrderRequests] Forcing session refresh before request');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            let session: any = refreshData?.session;
            if (refreshError || !session) {
                // Fall back to existing session
                const { data: { session: existingSession } } = await supabase.auth.getSession();
                session = existingSession;
                if (!session) {
                    throw new Error('Your session has expired. Please sign out and sign in again.');
                }
                console.warn('[useOrderRequests] refreshSession failed, using existing session', refreshError);
            }
            
            const user = session.user;
            if (!user) throw new Error('User not authenticated');

            // Fetch the parent merchant IDs for the legacy schema constraints
            const branchIds = stores.map(s => String(s.storeId));
            const { data: branchData } = await supabase
                .from('merchant_branches')
                .select('id, merchant_id')
                .in('id', branchIds);

            // Option A patch #7 (2026-06-08): loud merchant-resolution failure.
            // Previously the silent fallback `merchantIdMap.get(bId) || bId` would write
            // branch_id into store_id when the merchant_branches lookup failed (RLS,
            // null merchant_id, missing row). The merchant-app inbox filters by store_id,
            // so the request would never be visible to the merchant → 2-min timeout →
            // silent order death. Now we throw before building the requests.
            if (!branchData || branchData.length !== branchIds.length) {
                throw new Error('Could not resolve merchant for one or more stores. Please refresh and try again.');
            }
            const missingMerchant = branchData.find((b: any) => !b.merchant_id);
            if (missingMerchant) {
                throw new Error('One or more stores are missing a merchant assignment. Please contact support.');
            }

            const merchantIdMap = new Map(branchData?.map(b => [b.id, b.merchant_id]));

            const rows = stores.map(store => {
                const bId = String(store.storeId);
                return {
                    // Note: expires_at, created_at, and updated_at are handled server-side
                    consumer_user_id: user.id,
                    store_id: (() => {
                        const mid = merchantIdMap.get(bId);
                        if (!mid) throw new Error(`Missing merchant for branch ${bId}`);
                        return mid;
                    })(),
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
                let errBody: any = {};
                try { errBody = await response.json(); } catch { errBody = { error: await response.text() }; }
                if (errBody.error === 'STORE_OFFLINE') {
                    throw new Error(errBody.message || 'This store is currently offline and not accepting orders.');
                }
                throw new Error(errBody.message || errBody.error || 'Failed to submit order request');
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

    // Apply a realtime update to local state (shared by WebSocket and poll)
    const applyUpdate = useCallback((updated: OrderRequest) => {
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
    }, []);

    // Poll order_requests status as a safety net (Android kills WebSockets aggressively)
    const startPolling = useCallback((requestIds: string[]) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pendingIdsRef.current = requestIds;

        pollRef.current = setInterval(async () => {
            const ids = pendingIdsRef.current;
            if (ids.length === 0) {
                if (pollRef.current) clearInterval(pollRef.current);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('order_requests')
                    .select('*')
                    .in('id', ids)
                    .neq('status', 'PENDING');

                if (error) {
                    console.warn('[useOrderRequests] Poll error:', error.message);
                    return;
                }

                if (data && data.length > 0) {
                    console.log('[useOrderRequests] Poll caught update:', data.map(d => `${d.store_name}=${d.status}`).join(', '));
                    data.forEach(updated => {
                        applyUpdate(updated as OrderRequest);
                        // Remove from pending list so we stop polling for it
                        pendingIdsRef.current = pendingIdsRef.current.filter(id => id !== updated.id);
                    });

                    // Stop polling if nothing left
                    if (pendingIdsRef.current.length === 0 && pollRef.current) {
                        clearInterval(pollRef.current);
                    }
                }
            } catch (e) {
                console.warn('[useOrderRequests] Poll exception:', e);
            }
        }, 5000); // Every 5 seconds
    }, [applyUpdate]);

    // Subscribe to realtime changes + start polling fallback
    const subscribeToUpdates = useCallback((requestIds: string[], userId: string) => {
        // Clean up previous subscription
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const setupChannel = () => {
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
                        applyUpdate(updated);

                        // Remove from polling pending list (poll is now redundant for this id)
                        pendingIdsRef.current = pendingIdsRef.current.filter(id => id !== updated.id);
                    }
                )
                .subscribe((status: string) => {
                    console.log('[useOrderRequests] Channel status:', status);
                });

            channelRef.current = channel;
        };

        setupChannel();

        // Start polling fallback (catches updates if Android kills the WebSocket)
        startPolling(requestIds);

        // Re-subscribe when app returns to foreground (Android reconnect)
        const appStateListener = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                console.log('[useOrderRequests] App foregrounded — re-subscribing + polling');
                if (channelRef.current) {
                    supabase.removeChannel(channelRef.current);
                }
                setupChannel();
                // Restart polling with remaining pending IDs
                if (pendingIdsRef.current.length > 0) {
                    startPolling(pendingIdsRef.current);
                }
            }
        });

        // Store listener ref for cleanup (attach to channel for convenience)
        if (channelRef.current) {
            (channelRef.current as any).__appStateListener = appStateListener;
        }
    }, [applyUpdate, startPolling]);

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
        // Remove AppState listener if attached
        if (channelRef.current && (channelRef.current as any).__appStateListener) {
            (channelRef.current as any).__appStateListener.remove();
        }
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        pendingIdsRef.current = [];
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
