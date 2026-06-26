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

// Customer-facing inbox is scoped by recipient_role = 'consumer', set server-side
// by NotificationService on every insert. This replaces the former hardcoded type
// allowlist: a dual-role account (merchant + customer) keyed by the same user_id
// sees ONLY its customer notifications here, and every new customer notification
// type appears automatically — there is no allowlist to keep in sync.

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
    recipient_role?: string | null;  // server-set role tag; this inbox is scoped to 'consumer'
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
                .eq('recipient_role', 'consumer')
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
                    // recipient_role is the server-set source of truth; NULL/missing
                    // fails closed (treated as not-consumer), so nothing leaks in.
                    if ((n.recipient_role || '') !== 'consumer') return;
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
            .eq('recipient_role', 'consumer')
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
