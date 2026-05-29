import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface Slot {
    time: string;
    booked: number;
    capacity: number;
    remaining: number;
}

interface SlotAvailabilityResult {
    available: boolean;
    slots: Slot[];
    capacity: number;
}

export function useSlotAvailability(branchId: string | null, date: string | null) {
    const [slots, setSlots] = useState<Slot[]>([]);
    const [loading, setLoading] = useState(false);
    const [available, setAvailable] = useState(false);

    const fetchSlots = useCallback(async () => {
        if (!branchId || !date) {
            setSlots([]);
            setAvailable(false);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/bookings/availability?branchId=${branchId}&date=${date}`);
            const data: SlotAvailabilityResult = await res.json();

            if (res.ok && data.available) {
                setSlots(data.slots || []);
                setAvailable(true);
            } else {
                setSlots([]);
                setAvailable(false);
            }
        } catch (err) {
            console.error('[useSlotAvailability] Error:', err);
            setSlots([]);
            setAvailable(false);
        } finally {
            setLoading(false);
        }
    }, [branchId, date]);

    useEffect(() => {
        fetchSlots();
    }, [fetchSlots]);

    // Realtime subscription for live slot updates
    useEffect(() => {
        if (!branchId) return;

        const channel = supabase
            .channel(`slot_availability_${branchId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'table_bookings',
                filter: `branch_id=eq.${branchId}`
            }, () => {
                // Re-fetch on any booking change
                fetchSlots();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [branchId, fetchSlots]);

    return { slots, loading, available, refresh: fetchSlots };
}
