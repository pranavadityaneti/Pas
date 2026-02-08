import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Notification {
    id: string;
    merchantId: string;
    type: 'order' | 'stock' | 'payout' | 'system';
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    metadata?: any;
}

export function useNotifications() {
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
                .from('notification')
                .select('*')
                .eq('merchantId', user.id)
                .order('createdAt', { ascending: false })
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

    useEffect(() => {
        fetchNotifications();

        // Subscribe to real-time updates
        const subscription = supabase
            .channel('notifications')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notification'
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchNotifications]);

    const markAsRead = async (notificationId: string) => {
        const { error } = await supabase
            .from('notification')
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
            .from('notification')
            .update({ read: true })
            .eq('merchantId', user.id)
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
