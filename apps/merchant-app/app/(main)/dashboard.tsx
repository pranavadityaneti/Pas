import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

import { useStore } from '../../src/hooks/useStore';
import { useEarnings } from '../../src/hooks/useEarnings';
import { useOrders } from '../../src/hooks/useOrders';
import { useRouter } from 'expo-router';
import { useNotificationContext } from '../../src/context/NotificationContext';

export default function DashboardScreen() {
    const router = useRouter();
    const { unreadCount } = useNotificationContext();
    const { store, toggleStoreStatus } = useStore();
    const { stats, loading: earningsLoading } = useEarnings();
    const { orders, loading: ordersLoading } = useOrders();

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning 👋';
        if (hour < 17) return 'Good Afternoon ☀️';
        return 'Good Evening 🌙';
    };

    const formatCurrency = (amt: number) => {
        if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
        if (amt >= 1000) return `₹${(amt / 1000).toFixed(1)}K`;
        return `₹${amt}`;
    };

    const dashboardStats = [
        { label: "Today's Orders", value: stats.todayOrders.toString(), icon: 'receipt', color: Colors.primary },
        { label: 'Pending', value: stats.pendingCount.toString(), icon: 'hourglass', color: '#F59E0B' },
        { label: 'Completed', value: stats.orderCount.toString(), icon: 'checkmark-circle', color: '#10B981' },
        { label: "Revenue", value: formatCurrency(stats.today), icon: 'wallet', color: '#8B5CF6' },
    ];

    const recentOrders = orders.slice(0, 5);

    const [isLunchBreak, setIsLunchBreak] = React.useState(false);

    // Check for lunch break status
    React.useEffect(() => {
        const checkLunchStatus = () => {
            if (!store?.operating_hours) return;
            const oh = store.operating_hours;

            if (!oh.hasLunchBreak || !oh.lunchStart || !oh.lunchEnd) {
                setIsLunchBreak(false);
                return;
            }

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const [startH, startM] = oh.lunchStart.split(':').map(Number);
            const startMinutes = startH * 60 + startM;

            const [endH, endM] = oh.lunchEnd.split(':').map(Number);
            const endMinutes = endH * 60 + endM;

            if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
                setIsLunchBreak(true);
            } else {
                setIsLunchBreak(false);
            }
        };

        checkLunchStatus();
        const interval = setInterval(checkLunchStatus, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [store?.operating_hours]);

    const handleToggleStatus = () => {
        if (isLunchBreak) {
            Alert.alert('Lunch Break', 'Store is currently on lunch break. Please wait until lunch time is over to go online.');
            return;
        }

        const newStatus = !store?.active;
        const title = newStatus ? 'Go Online?' : 'Go Offline?';
        const message = newStatus
            ? 'Your store will start accepting new orders.'
            : 'Your store will stop accepting new orders. Existing orders can still be processed.';

        Alert.alert(
            title,
            message,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        const result = await toggleStoreStatus(newStatus);
                        if (!result.success) {
                            Alert.alert('Error', result.error || 'Failed to update store status. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    const isOffline = !store?.active || isLunchBreak;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {isOffline && (
                <View style={[styles.offlineBanner, isLunchBreak && { backgroundColor: '#F59E0B' }]}>
                    <Ionicons name={isLunchBreak ? "restaurant" : "close-circle"} size={20} color="#FFF" />
                    <Text style={styles.offlineText}>
                        {isLunchBreak
                            ? "Lunch Break - Store is temporarily offline"
                            : "Store Offline - Not accepting new orders"}
                    </Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.contentWrapper, isOffline && styles.greyscale]}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.greeting}>{getGreeting()}</Text>
                            <View style={styles.storeHeader}>
                                <Text style={styles.storeName}>{store?.name || 'Loading...'}</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.statusBadgeButton,
                                        !store?.active && styles.statusBadgeOffline,
                                        isLunchBreak && { backgroundColor: '#FEF3C7' }
                                    ]}
                                    onPress={handleToggleStatus}
                                >
                                    <View style={[
                                        styles.statusDot,
                                        !store?.active && styles.statusDotOffline,
                                        isLunchBreak && { backgroundColor: '#F59E0B' }
                                    ]} />
                                    <Text style={[
                                        styles.statusLabel,
                                        !store?.active && styles.statusLabelOffline,
                                        isLunchBreak && { color: '#B45309' }
                                    ]}>
                                        {isLunchBreak ? 'Lunch Break' : (store?.active ? 'Online' : 'Offline')}
                                    </Text>
                                    <Ionicons name="chevron-down" size={14} color={store?.active ? '#10B981' : '#6B7280'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.notificationButton}
                            onPress={() => router.push('/(main)/notifications')}
                        >
                            <Ionicons name="notifications-outline" size={24} color="#374151" />
                            {unreadCount > 0 && <View style={styles.notificationBadge} />}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.statsGrid}>
                        {dashboardStats.map((stat, i) => (
                            <View key={i} style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                                    <Ionicons name={stat.icon as any} size={22} color={stat.color} />
                                </View>
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Performance Banner */}
                    <View style={styles.payoutCard}>
                        <View>
                            <Text style={styles.payoutLabel}>Estimated Payout (Today)</Text>
                            <Text style={styles.payoutValue}>{formatCurrency(stats.estimatedPayout)}</Text>
                        </View>
                        <View style={styles.payoutTag}>
                            <Text style={styles.payoutTagText}>Net Earnings</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <View style={styles.actionsRow}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => router.push('/catalog-picker')}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '15' }]}>
                                    <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                                </View>
                                <Text style={styles.actionLabel}>Add Product</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => router.push('/inventory')}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                                    <Ionicons name="pricetags-outline" size={24} color="#F59E0B" />
                                </View>
                                <Text style={styles.actionLabel}>Manage Items</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => router.push('/orders')}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: '#ECFDF5' }]}>
                                    <Ionicons name="scan-outline" size={24} color="#10B981" />
                                </View>
                                <Text style={styles.actionLabel}>All Orders</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Recent Orders</Text>
                            <TouchableOpacity onPress={() => router.push('/orders')}>
                                <Text style={styles.viewAllText}>View All</Text>
                            </TouchableOpacity>
                        </View>

                        {recentOrders.length === 0 ? (
                            <View style={styles.emptyOrders}>
                                <Text style={styles.emptyText}>No orders yet</Text>
                            </View>
                        ) : (
                            recentOrders.map((order) => (
                                <TouchableOpacity
                                    key={order.id}
                                    style={styles.orderCard}
                                    onPress={() => router.push({ pathname: '/orders', params: { orderId: order.id } })}
                                >
                                    <View style={styles.orderIcon}>
                                        <Ionicons name="bag-handle-outline" size={20} color={Colors.primary} />
                                    </View>
                                    <View style={styles.orderInfo}>
                                        <Text style={styles.orderTitle}>Order #{order.displayId}</Text>
                                        <Text style={styles.orderSubtitle}>
                                            {order.items.length} items • ₹{order.totalAmount}
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.statusBadge,
                                        order.status === 'PENDING' && styles.statusBadgePending,
                                        order.status === 'READY' && styles.statusBadgeReady,
                                        order.status === 'COMPLETED' && styles.statusBadgeCompleted
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            order.status === 'PENDING' && styles.statusTextPending,
                                            order.status === 'READY' && styles.statusTextReady,
                                            order.status === 'COMPLETED' && styles.statusTextCompleted
                                        ]}>
                                            {order.status}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        padding: 12,
        gap: 8
    },
    offlineText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    contentWrapper: {},
    greyscale: { opacity: 0.6 },
    scrollContent: { padding: 16, paddingBottom: 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    greeting: { fontSize: 14, color: '#6B7280' },
    storeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    storeName: { fontSize: 22, fontWeight: '700', color: '#111827' },
    statusBadgeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 4
    },
    statusBadgeOffline: {
        backgroundColor: '#F3F4F6'
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981'
    },
    statusDotOffline: {
        backgroundColor: '#6B7280'
    },
    statusLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#10B981'
    },
    statusLabelOffline: {
        color: '#6B7280'
    },
    notificationButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    notificationBadge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    statCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    statValue: { fontSize: 24, fontWeight: '700', color: '#111827' },
    statLabel: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    payoutCard: { backgroundColor: '#111827', borderRadius: 20, padding: 20, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    payoutLabel: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },
    payoutValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: 4 },
    payoutTag: { backgroundColor: '#10B98120', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    payoutTagText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
    viewAllText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    actionButton: { flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginHorizontal: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    actionLabel: { fontSize: 12, fontWeight: '500', color: '#374151', textAlign: 'center' },
    orderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    orderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
    orderInfo: { flex: 1, marginLeft: 12 },
    orderTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
    orderSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#D1FAE5' },
    statusBadgePending: { backgroundColor: '#FEF3C7' },
    statusBadgeReady: { backgroundColor: '#DBEAFE' },
    statusBadgeCompleted: { backgroundColor: '#D1FAE5' },
    statusText: { fontSize: 12, fontWeight: '600', color: '#059669' },
    statusTextPending: { color: '#D97706' },
    statusTextReady: { color: '#2563EB' },
    statusTextCompleted: { color: '#059669' },
    emptyOrders: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 40, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#D1D5DB' },
    emptyText: { color: '#9CA3AF', fontSize: 14 },
});
