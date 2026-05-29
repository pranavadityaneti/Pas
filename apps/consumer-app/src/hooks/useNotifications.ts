// Consumer in-app notifications hook: fetch + realtime + read-state mutations.
//
// Mirrors the merchant app's useNotifications, with two deliberate differences:
//   1. Scoped by user_id ONLY (a customer isn't tied to a store, unlike a merchant).
//   2. Reads the REAL snake_case columns PostgREST returns (is_read, created_at,
//      message, reference_id) — the merchant screen's `notif.createdAt` is a latent
//      camelCase bug we intentionally do not copy.
//
// Realtime INSERTs (delivered while foregrounded) trigger a subtle haptic + an
// in-app toast, then refetch to keep the list + unread badge current.
import { useState, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/NotificationToast';

// Customer-facing notification types only. The `notifications` table is keyed by
// user_id with no role column yet, so a dual-role account (merchant + customer)
// would otherwise see its MERCHANT notifications in this inbox. This allowlist
// scopes the customer inbox to customer notifications.
// JUNE 6 (Option B): once the `recipient_role` column migration is live AND the API
// writes it, replace this allowlist with `.eq('recipient_role', 'consumer')`.
const CONSUMER_NOTIFICATION_TYPES = [
    'ORDER_CONFIRMED',
    'PAYMENT_SUCCESSFUL',
    'ORDER_READY',
    'ORDER_COMPLETED',
    'ORDER_CANCELLED',
    'DINING_BOOKED',
    'DINING_READY',
    'PICKUP_REMINDER_30MIN',
    'PICKUP_REMINDER_10MIN',
    'DINING_REMINDER_30MIN',
];

export interface ConsumerNotification {
    id: string;
    user_id: string;
    store_id?: string | null;
    type: string;
    title: string;
    message: string;       // the body text (DB column is `message`; server writes body → message)
    is_read: boolean;
    link?: string | null;
    reference_id?: string | null;
    metadata?: any;
    created_at: string;
}

export function useNotifications(userId: string | undefined) {
    const [notifications, setNotifications] = useState<ConsumerNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!userId) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .in('type', CONSUMER_NOTIFICATION_TYPES)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('[Notif] fetch error:', error);
            }
            if (data) {
                setNotifications(data as ConsumerNotification[]);
                setUnreadCount((data as ConsumerNotification[]).filter(n => !n.is_read).length);
            }
        } catch (e) {
            console.error('[Notif] fetch exception:', e);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        let channel: any;

        fetchNotifications();

        // Realtime: new notifications for THIS user only. RLS + the filter ensure
        // we never receive another user's rows. (notifications is already in the
        // supabase_realtime publication — the merchant app relies on it.)
        channel = supabase
            .channel(`consumer-notifications-${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const n = payload.new as ConsumerNotification;
                    // Ignore inserts that aren't customer notifications (e.g. this
                    // account's own merchant notifications) — keeps toast + list clean.
                    if (!CONSUMER_NOTIFICATION_TYPES.includes((n.type || '').toUpperCase())) return;
                    try {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch {
                        // haptics unavailable — non-fatal
                    }
                    showToast({ title: n.title, body: n.message, type: (n.type || '').toUpperCase() });
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [userId, fetchNotifications]);

    const markAsRead = useCallback(async (id: string) => {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (!error) {
            setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } else {
            console.error('[Notif] markAsRead error:', error);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!userId) return;
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);
        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } else {
            console.error('[Notif] markAllAsRead error:', error);
        }
    }, [userId]);

    return { notifications, loading, unreadCount, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
