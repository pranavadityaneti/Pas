import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type UseRealtimeTableProps = {
    tableName: string;
    select?: string;
    filter?: string; // e.g., "storeId=eq.123"
    orderBy?: { column: string; ascending?: boolean };
    enabled?: boolean;
};

export function useRealtimeTable<T extends Record<string, any> = any>({
    tableName,
    select = '*',
    filter,
    orderBy,
    enabled = true
}: UseRealtimeTableProps) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        let mounted = true;

        const fetchData = async () => {
            try {
                let query = supabase.from(tableName).select(select);

                if (filter) {
                    const filterParts = filter.split(',');
                    filterParts.forEach(p => {
                        const parts = p.split('=');
                        if (parts.length === 2) {
                            const [col, rest] = parts;
                            const [op, val] = rest.split('.');
                            if (op === 'eq') query = query.eq(col, val);
                            if (op === 'neq') query = query.neq(col, val);
                            if (op === 'gt') query = query.gt(col, val);
                            if (op === 'lt') query = query.lt(col, val);
                        }
                    });
                }

                if (orderBy) {
                    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
                }

                const { data: fetchedData, error: fetchError } = await query;

                if (fetchError) throw fetchError;
                if (mounted) setData(fetchedData as unknown as T[]);
            } catch (err: any) {
                console.error(`[useRealtimeTable] Error fetching ${tableName}:`, err);
                if (mounted) setError(err.message);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();

        // Subscription - Use the first filter part only as Supabase Realtime doesn't support multiple
        const subscriptionFilter = filter?.split(',')[0];

        const channel = supabase.channel(`realtime_${tableName}_${subscriptionFilter || 'all'}`)
            .on(
                'postgres_changes' as any, // Cast to any to avoid strict literal type mismatch if SDK types are older/newer
                {
                    event: '*',
                    schema: 'public',
                    table: tableName,
                    filter: subscriptionFilter
                },
                (payload: RealtimePostgresChangesPayload<T>) => {
                    console.log(`[useRealtimeTable] Update in ${tableName}:`, payload.eventType);

                    if (payload.eventType === 'INSERT') {
                        // Prepend new items (assuming newest first for UI)
                        setData(prev => {
                            // Prevent duplicates if already added via optimistic update or double event
                            // @ts-ignore
                            if (prev.some(item => item.id === payload.new.id)) return prev;
                            return [payload.new as T, ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setData(prev => prev.map(item =>
                            // @ts-ignore - assuming 'id' exists
                            item.id === payload.new.id ? { ...item, ...payload.new } : item
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setData(prev => prev.filter(item =>
                            // @ts-ignore - assuming 'id' exists
                            item.id !== payload.old.id
                        ));
                    }
                }
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [tableName, filter, select, orderBy?.column, orderBy?.ascending, enabled]);

    return { data, loading, error, setData }; // setData exposed for optimistic updates if needed
}
