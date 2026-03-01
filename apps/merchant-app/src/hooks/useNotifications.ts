import { useState, useEffect, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/audio';

export interface Notification {
    id: string;
    merchantId: string;
    type: 'order' | 'stock' | 'payout' | 'system';
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    link?: string;
    metadata?: any;
}

export function useNotifications(user: any) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.read).length);
            }

            if (error) {
                console.error('Error fetching notifications:', error);
            }
        } catch (e) {
            console.error('Notification fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const prefsRef = useRef(user?.notification_preferences);

    // Keep ref in sync
    useEffect(() => {
        prefsRef.current = user?.notification_preferences;
    }, [user?.notification_preferences]);

    useEffect(() => {
        let subscription: any;

        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            fetchNotifications();

            // Subscribe to real-time updates with filter for currentUser
            subscription = supabase
                .channel('notifications')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    const newNotif = payload.new as Notification;

                    // Logic to check preferences
                    const prefs = prefsRef.current;
                    if (prefs) {
                        const isCancelled = newNotif.title.toLowerCase().includes('cancel') || newNotif.message.toLowerCase().includes('cancel');
                        const isNewOrder = newNotif.title.toLowerCase().includes('order') && !isCancelled;

                        let shouldAlert = false;
                        if (isNewOrder && prefs.newOrder) shouldAlert = true;
                        if (isCancelled && prefs.orderCancelled) shouldAlert = true;

                        // Fallback for other types if strictly not disabled? 
                        // For now, only alert if matches these specifically or if it's a general alert?
                        // Let's assume general system alerts also respect 'sound' global toggle at least.
                        if (!isNewOrder && !isCancelled) shouldAlert = true;

                        if (shouldAlert) {
                            if (prefs.sound) {
                                playSound(prefs.soundType || 'Amber');
                            }
                            if (prefs.vibration) {
                                Vibration.vibrate();
                            }
                        }
                    } else {
                        // Default behavior if no prefs found (e.g. first load)
                        Vibration.vibrate();
                        playSound('Amber');
                    }

                    // Optimistic update or refetch
                    fetchNotifications();
                })
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [fetchNotifications]);

    const markAsRead = async (notificationId: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (!error) {
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const markAllAsRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false);

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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
