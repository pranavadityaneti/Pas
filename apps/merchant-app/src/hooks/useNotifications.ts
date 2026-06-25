import { useState, useEffect, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/audio';
import { showToast } from '../components/NotificationToast';
import { useStore } from './useStore';

// Canonical UPPERCASE notification types — matches what the server emits.
// Server source: apps/api/src/services/notification.service.ts + index.ts dispatch sites.
// Keep in sync with TYPE_CONFIG in NotificationToast.tsx and getIcon in app/(main)/notifications.tsx.
export type NotificationType =
    | 'NEW_ORDER'
    | 'NEW_ORDER_REQUEST'
    | 'ORDER_CANCELLED'
    | 'CANCELLED'
    | 'RIDER_ARRIVED'
    | 'ORDER_UPDATE'
    | 'COMPLETED'
    | 'READY'
    | 'LOW_STOCK'
    | string; // permissive — accepts future types without forcing a rebuild

// Field names mirror the REAL snake_case columns PostgREST returns from the
// `notifications` table (Prisma maps camelCase model fields → snake_case columns).
// Reading camelCase (e.g. `createdAt`) yields undefined → "NaN min ago" bugs.
export interface Notification {
    id: string;
    user_id: string;
    store_id?: string;
    type: NotificationType;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    link?: string;
    reference_id?: string;
    metadata?: any;
    recipient_role?: string | null;  // server-set role tag; this inbox is scoped to 'merchant'
}

export function useNotifications(user: any) {
    const { activeStoreId } = useStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !activeStoreId) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .eq('store_id', activeStoreId)
                .eq('recipient_role', 'merchant')
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.is_read).length);
            }

            if (error) {
                console.error('Error fetching notifications:', error);
            }
        } catch (e) {
            console.error('Notification fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, [activeStoreId]);

    const prefsRef = useRef(user?.notification_preferences);

    // Keep ref in sync
    useEffect(() => {
        prefsRef.current = user?.notification_preferences;
    }, [user?.notification_preferences]);

    useEffect(() => {
        let subscription: any;

        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !activeStoreId) return;

            fetchNotifications();

            // Subscribe to real-time INSERTs for this merchant.
            // Realtime postgres_changes supports only ONE filter condition (no
            // comma-AND), so we filter by user_id here and narrow to the active
            // store in the callback. The previous two-part filter
            // (`user_id=eq.…,store_id=eq.…`) was invalid — it matched nothing, so
            // no live in-app notifications arrived while the app was open.
            subscription = supabase
                .channel(`notifications-${activeStoreId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    const newNotif = payload.new as Notification;
                    // Narrow to the currently-active store (the store_id half of the old filter).
                    if (newNotif.store_id !== activeStoreId) return;
                    // Role guard: only merchant-role rows belong here. A dual-role account's
                    // consumer rows can share user_id + store_id; recipient_role disambiguates.
                    // NULL/missing fails closed (treated as not-merchant).
                    if ((newNotif.recipient_role || '') !== 'merchant') return;
                    const notifType = (newNotif.type || '').toUpperCase();

                    // --- Preference-Gated Alerting ---
                    const prefs = prefsRef.current;

                    // Determine if this notification type should trigger audio/vibration
                    let shouldAlert = true; // Default: alert for all types

                    if (prefs) {
                        // Gate specific types behind their toggles
                        if (notifType === 'NEW_ORDER' && prefs.newOrder === false) {
                            shouldAlert = false;
                        }
                        // Cancellations: covers both lifecycle cancel (`CANCELLED`)
                        // AND customer-side request cancel (`ORDER_CANCELLED`).
                        if ((notifType === 'CANCELLED' || notifType === 'ORDER_CANCELLED') && prefs.orderCancelled === false) {
                            shouldAlert = false;
                        }
                        // All other types (LOW_STOCK, READY, COMPLETED, etc.) always alert
                        // unless the global sound toggle is off

                        if (shouldAlert) {
                            // Sound: use merchant's selected tone, never hardcoded
                            if (prefs.sound !== false) {
                                playSound(prefs.soundType || 'Amber');
                            }
                            // Vibration: only if explicitly enabled
                            if (prefs.vibration === true) {
                                Vibration.vibrate();
                            }
                        }
                    } else {
                        // No preferences saved yet — use safe defaults
                        playSound('Amber');
                        Vibration.vibrate();
                    }

                    // --- Visual Toast Alert (always shown regardless of sound prefs) ---
                    showToast({
                        title: newNotif.title,
                        body: newNotif.message,
                        type: notifType,
                    });

                    // Refresh the notification list
                    fetchNotifications();
                })
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [fetchNotifications, activeStoreId]);

    const markAsRead = async (notificationId: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (!error) {
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const markAllAsRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !activeStoreId) return;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('store_id', activeStoreId)
            .eq('recipient_role', 'merchant')
            .eq('is_read', false);

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        }
    };

    return {
        notifications,
        loading,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refetch: fetchNotifications
    };
}
