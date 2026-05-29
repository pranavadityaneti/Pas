import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

import { useStore } from '../../src/hooks/useStore';
import { useEarnings } from '../../src/hooks/useEarnings';
import { useOrders } from '../../src/hooks/useOrders';
import { useRouter } from 'expo-router';
import { useNotificationContext } from '../../src/context/NotificationContext';
import { ActivityIndicator } from 'react-native';

export default function DashboardScreen() {
    const router = useRouter();
    const { unreadCount } = useNotificationContext();
    const { store, loading: storeLoading, toggleStoreStatus } = useStore();
    const { stats, loading: earningsLoading } = useEarnings();
    const { orders, loading: ordersLoading } = useOrders();

    // ── All hooks MUST be above the early return (React Rules of Hooks) ──
    const [isLunchBreak, setIsLunchBreak] = React.useState(false);
    const [isClosedToday, setIsClosedToday] = React.useState(false);
    const [isOutsideHours, setIsOutsideHours] = React.useState(false);

    // Evaluate schedule status from current store data + current time
    const checkStatus = React.useCallback(() => {
        if (!store?.operating_hours) {
            setIsClosedToday(false);
            setIsLunchBreak(false);
            setIsOutsideHours(false);
            return;
        }
        const oh = store.operating_hours;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const parseTime = (timeStr: string) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        // 1. Check if closed today
        // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
        // Store days: 0=Mon, 1=Tue, ..., 6=Sun
        const todayJS = now.getDay();
        const todayIndex = (todayJS + 6) % 7;

        setIsClosedToday(oh.days ? !oh.days.includes(todayIndex) : false);

        // 2. Check if current time is outside open/close window
        if (oh.open && oh.close) {
            const openMinutes = parseTime(oh.open);
            const closeMinutes = parseTime(oh.close);
            const prepTime = store?.prep_time_minutes || 15;
            setIsOutsideHours(currentMinutes < openMinutes || currentMinutes > (closeMinutes - prepTime));
        } else {
            setIsOutsideHours(false);
        }

        // 3. Check for lunch break status
        if (oh.hasLunchBreak && oh.lunchStart && oh.lunchEnd) {
            const lunchStartMinutes = parseTime(oh.lunchStart);
            const lunchEndMinutes = parseTime(oh.lunchEnd);
            setIsLunchBreak(currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes);
        } else {
            setIsLunchBreak(false);
        }
    }, [store?.operating_hours, store?.prep_time_minutes]);

    // Re-evaluate every 30 seconds so time-based transitions are near-instant
    React.useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, [checkStatus]);

    // No useFocusEffect needed: updateStoreDetails already calls fetchStore()
    // before returning, so store data is fresh when navigating back from Timings.
    // The useEffect above re-evaluates immediately when store.operating_hours changes.
    // The 30s timer handles ongoing time-based transitions (open/close boundary).

    // ── Guard: don't render dashboard until store data is loaded ──
    // Without this, store is null during fetch → !store?.active → offline banner flash.
    if (storeLoading || !store) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ marginTop: 12, color: '#6B7280', fontSize: 14 }}>Loading store...</Text>
                </View>
            </SafeAreaView>
        );
    }

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

    const handleToggleStatus = () => {
        if (isClosedToday) {
            Alert.alert(
                'Store Closed Today',
                'Your store is scheduled as closed today. To go online, please enable this day in the Store Timings settings.'
            );
            return;
        }

        if (isOutsideHours) {
            const oh = store?.operating_hours;
            Alert.alert(
                'Outside Operating Hours',
                `Your store is scheduled to open at ${oh?.open || '—'} and close at ${oh?.close || '—'}. You can go online when operating hours begin.`
            );
            return;
        }

        if (isLunchBreak) {
            Alert.alert('Lunch Break', 'Store is currently on lunch break. Please wait until lunch time is over to go online.');
            return;
        }

        const newStatus = !store?.active;
        const title = newStatus ? 'Go Online?' : 'Go Offline?';
        const message = newStatus
            ? 'Your store will start accepting new orders.'
            : 'Your store will stop accepting new orders. Existing orders can still be processed.';

        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                onPress: async () => {
                    const result = await toggleStoreStatus(newStatus);
                    if (!result.success) {
                        Alert.alert('Error', result.error || 'Failed to update store status.');
                    }
                }
            }
        ]);
    };

    // Schedule-based reasons (closed day, outside hours, lunch break) use amber banner.
    // Manual offline (is_active toggle) uses red banner.
    const isScheduleOffline = isClosedToday || isOutsideHours || isLunchBreak;
    const isOffline = !store?.active || isScheduleOffline;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {isOffline && (
                <View style={[styles.offlineBanner, isScheduleOffline && { backgroundColor: '#F59E0B' }]}>
                    <Ionicons name={isClosedToday ? "calendar" : isOutsideHours ? "time" : isLunchBreak ? "restaurant" : "close-circle"} size={20} color="#FFF" />
                    <Text style={styles.offlineText}>
                        {isClosedToday
                            ? "Store Closed - Today is a non-working day"
                            : isOutsideHours
                                ? `Outside Hours - Opens at ${store?.operating_hours?.open || '—'}`
                                : isLunchBreak
                                    ? "Lunch Break - Store is temporarily offline"
                                    : "Store Offline - Not accepting new orders"}
                    </Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.contentWrapper, isOffline && styles.greyscale]}>
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.greeting}>{getGreeting()}</Text>
                            <Text style={styles.storeName}>{store?.name || 'Loading...'}</Text>
                        </View>
                        <View style={styles.headerRight}>
                            <View style={styles.switchWrapper}>
                                <Switch
                                    value={store?.active && !isScheduleOffline}
                                    onValueChange={handleToggleStatus}
                                    trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                                    thumbColor="#fff"
                                    disabled={isScheduleOffline}
                                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                                />
                                <Text style={[styles.switchLabel, !(store?.active && !isScheduleOffline) && styles.switchLabelOff]}>
                                    {isClosedToday ? 'Closed' : isOutsideHours ? 'Closed' : isLunchBreak ? 'Break' : store?.active ? 'Online' : 'Offline'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.notificationButton}
                                onPress={() => router.push('/(main)/notifications')}
                            >
                                <Ionicons name="notifications-outline" size={24} color="#374151" />
                                {unreadCount > 0 && (
                                    <View style={styles.notificationBadge}>
                                        <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
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
    storeName: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 4 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    switchWrapper: { alignItems: 'center' },
    switchLabel: { fontSize: 10, fontWeight: '600', color: '#10B981', marginTop: -2 },
    switchLabelOff: { color: '#6B7280' },
    notificationButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    notificationBadge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
    notificationBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
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
