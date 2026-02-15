import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { useNotificationContext } from '../../src/context/NotificationContext';

export default function NotificationsScreen() {
    const router = useRouter();
    const { notifications, loading, markAsRead, markAllAsRead } = useNotificationContext();

    const getIcon = (type: string) => {
        switch (type) {
            case 'order': return 'receipt';
            case 'stock': return 'warning';
            case 'payout': return 'wallet';
            default: return 'notifications';
        }
    };

    const formatTime = (createdAt: string) => {
        const now = new Date();
        const then = new Date(createdAt);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    const handleNotificationPress = async (notificationId: string, read: boolean, link?: string) => {
        if (!read) {
            await markAsRead(notificationId);
        }
        if (link) {
            // Check if link is a relative path or requires special handling
            if (link.startsWith('/')) {
                router.push(link as any);
            } else {
                // Handle external links or other schemas if needed
                console.log("External link:", link);
            }
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Notifications</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Notifications</Text>
                {notifications.some(n => !n.read) && (
                    <TouchableOpacity onPress={markAllAsRead}>
                        <Text style={styles.markAllRead}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {notifications.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-off-outline" size={64} color="#E5E7EB" />
                        <Text style={styles.emptyText}>No notifications yet</Text>
                    </View>
                ) : (
                    notifications.map((notif) => (
                        <TouchableOpacity
                            key={notif.id}
                            style={[styles.notifCard, !notif.read && styles.unread]}
                            onPress={() => handleNotificationPress(notif.id, notif.read, notif.link)}
                        >
                            <View style={[styles.iconCircle, !notif.read && styles.iconCircleUnread]}>
                                <Ionicons name={getIcon(notif.type) as any} size={20} color={notif.read ? '#6B7280' : Colors.primary} />
                            </View>
                            <View style={styles.notifContent}>
                                <Text style={styles.notifTitle}>{notif.title}</Text>
                                <Text style={styles.notifMessage}>{notif.message}</Text>
                                <Text style={styles.notifTime}>{formatTime(notif.createdAt)}</Text>
                            </View>
                            {!notif.read && <View style={styles.unreadDot} />}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF' },
    backBtn: { padding: 4 },
    title: { fontSize: 22, fontWeight: '700', color: '#111827' },
    markAllRead: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 16 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
    notifCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    unread: { borderLeftWidth: 4, borderLeftColor: Colors.primary },
    iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    iconCircleUnread: { backgroundColor: Colors.primary + '15' },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
    notifMessage: { fontSize: 14, color: '#6B7280', marginBottom: 6 },
    notifTime: { fontSize: 12, color: '#9CA3AF' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary }
});
