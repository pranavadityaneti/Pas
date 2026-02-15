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
                    // Primitive splitting to handle simple eq filters for initial fetch
                    // This is a bit fragile if filter is complex, but for "storeId=eq.xyz" it works
                    // Ideally, pass filter parts separately or use a builder pattern
                    // For now, we assume calling code might handle fetching if filter is complex, 
                    // OR we just use this for simple lists.

                    // Actually, let's just interpret filter string for basic equality if possible
                    // or rely on the caller to provide a more structured filter if we expand this hook.
                    // For now: specific implementation for our common case: "column=operator.value"
                    const parts = filter.split('=');
                    if (parts.length === 2) {
                        const [col, rest] = parts;
                        const [op, val] = rest.split('.');
                        if (op === 'eq') query = query.eq(col, val);
                    }
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

        // Subscription
        const channel = supabase.channel(`realtime_${tableName}_${filter || 'all'}`)
            .on(
                'postgres_changes' as any, // Cast to any to avoid strict literal type mismatch if SDK types are older/newer
                {
                    event: '*',
                    schema: 'public',
                    table: tableName,
                    filter: filter
                },
                (payload: RealtimePostgresChangesPayload<T>) => {
                    console.log(`[useRealtimeTable] Update in ${tableName}:`, payload.eventType);

                    if (payload.eventType === 'INSERT') {
                        // Prepend new items (assuming newest first for UI)
                        setData(prev => [payload.new as T, ...prev]);
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
