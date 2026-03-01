import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors } from '../../constants/Colors';
import { formatDistanceToNow } from 'date-fns';
import BottomModal from './BottomModal';

interface Notification {
    id: string;
    type: 'ORDER' | 'SYSTEM' | 'INVENTORY';
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    link?: string;
}

interface NotificationCenterProps {
    visible: boolean;
    onClose: () => void;
}

export default function NotificationCenter({ visible, onClose }: NotificationCenterProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchNotifications();
        }
    }, [visible]);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);
    };

    const markAllAsRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const renderItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.notificationItem, !item.is_read && styles.unreadItem]}
            onPress={() => markAsRead(item.id)}
        >
            <View style={[styles.iconContainer, { backgroundColor: getIconColor(item.type) }]}>
                <MaterialCommunityIcons name={getIconName(item.type)} size={24} color={Colors.white} />
            </View>
            <View style={styles.contentContainer}>
                <View style={styles.headerRow}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.time}>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</Text>
                </View>
                <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    const getIconName = (type: string) => {
        switch (type) {
            case 'ORDER': return 'food';
            case 'INVENTORY': return 'alert-circle';
            case 'SYSTEM': return 'information';
            default: return 'bell';
        }
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case 'ORDER': return Colors.primary;
            case 'INVENTORY': return '#EF4444'; // Red
            case 'SYSTEM': return '#3B82F6'; // Blue
            default: return Colors.textSecondary;
        }
    };

    return (
        <BottomModal visible={visible} onClose={onClose} title="Notifications">
            <View style={styles.container}>
                <View style={styles.actionsBar}>
                    <TouchableOpacity onPress={markAllAsRead}>
                        <Text style={styles.actionText}>Mark all as read</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={Colors.primary} />
                ) : (
                    <FlatList
                        data={notifications}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="bell-sleep" size={48} color={Colors.border} />
                                <Text style={styles.emptyText}>No notifications yet</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </BottomModal>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 500, // Fixed height or max height
        backgroundColor: Colors.white,
    },
    actionsBar: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        alignItems: 'flex-end',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    actionText: {
        color: Colors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.background,
        alignItems: 'center',
    },
    unreadItem: {
        backgroundColor: '#FFF7ED', // Very light orange/primary tint
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
        flex: 1,
    },
    time: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    message: {
        fontSize: 14,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
        marginLeft: 8,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        gap: 12
    },
    emptyText: {
        color: Colors.textSecondary,
        fontSize: 16
    }
});
