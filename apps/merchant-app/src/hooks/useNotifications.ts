import { useState, useEffect, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/audio';
import { showToast } from '../components/NotificationToast';
import { useStore } from './useStore';

export interface Notification {
    id: string;
    merchantId: string;
    storeId?: string;
    type: 'order' | 'stock' | 'payout' | 'system';
    title: string;
    message: string;
    is_read: boolean;
    createdAt: string;
    link?: string;
    metadata?: any;
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

            // Subscribe to real-time updates scoped to user AND store
            subscription = supabase
                .channel(`notifications-${activeStoreId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id},store_id=eq.${activeStoreId}`
                }, (payload) => {
                    const newNotif = payload.new as Notification;
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
                        if (notifType === 'CANCELLED' && prefs.orderCancelled === false) {
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
