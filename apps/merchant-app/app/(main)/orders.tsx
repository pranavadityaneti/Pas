import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, ScrollView, Animated, LayoutAnimation, Platform, UIManager, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useOrders, Order, OrderStatus } from '../../src/hooks/useOrders';
import { useFocusEffect } from 'expo-router';
import { useStore } from '../../src/hooks/useStore';
import OTPVerificationModal from '../../src/components/OTPVerificationModal';
import ReceiptSummaryModal from '../../src/components/ReceiptSummaryModal';
import RejectionReasonModal from '../../src/components/RejectionReasonModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TABS = [
    { label: 'Pending', value: 'pending' },
    { label: 'Processing', value: 'processing' },
    { label: 'Ready', value: 'ready' },
    { label: 'History', value: 'history' }
];

const STATUS_MAP: Record<string, OrderStatus[]> = {
    pending: ['PENDING'],
    processing: ['CONFIRMED', 'PREPARING'],
    ready: ['READY'],
    history: ['COMPLETED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'REFUNDED']
};

export default function OrdersScreen() {
    const { orders, loading, refreshing, refetch, updateOrderStatus, verifyOTP } = useOrders();
    const { store } = useStore();
    const [activeTab, setActiveTab] = useState('pending');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
    const [now, setNow] = useState(Date.now());

    // Update 'now' every second to drive the countdown timers
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [])
    );

    // Modal states
    const [showOTPModal, setShowOTPModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [rejectionOrder, setRejectionOrder] = useState<Order | null>(null);

    // Toast state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const showToast = (message: string) => {
        setToastMessage(message);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(3000),
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
        ]).start(() => setToastMessage(null));
    };

    const toggleAccordion = (orderId: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
    };

    const filteredOrders = useMemo(() => {
        const allowedStatuses = STATUS_MAP[activeTab];
        let filtered = orders.filter(o =>
            allowedStatuses.includes(o.status) &&
            (search === '' || o.displayId.toLowerCase().includes(search.toLowerCase()))
        );

        // Apply date filter (only for History tab)
        if (activeTab === 'history' && dateFilter !== 'all') {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const startOfWeek = startOfToday - (now.getDay() * 24 * 60 * 60 * 1000);
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

            filtered = filtered.filter(o => {
                const orderTime = new Date(o.createdAt).getTime();
                if (dateFilter === 'today') return orderTime >= startOfToday;
                if (dateFilter === 'week') return orderTime >= startOfWeek;
                if (dateFilter === 'month') return orderTime >= startOfMonth;
                return true;
            });
        }

        return filtered;
    }, [orders, activeTab, search, dateFilter]);

    const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus, displayId: string) => {
        // Intercept rejection to show reason modal
        if (nextStatus === 'CANCELLED') {
            const orderToReject = orders.find(o => o.id === orderId);
            if (orderToReject) {
                setRejectionOrder(orderToReject);
                setShowRejectionModal(true);
            }
            return;
        }

        const res = await updateOrderStatus(orderId, nextStatus);
        if (res.success) {
            showToast(`Order #${displayId} moved to ${nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}`);
        } else {
            alert('Failed to update order status');
        }
    };

    const handleConfirmRejection = async (reason: string) => {
        if (!rejectionOrder) return;

        const res = await updateOrderStatus(rejectionOrder.id, 'CANCELLED', reason);
        if (res.success) {
            setShowRejectionModal(false);
            showToast(`Order #${rejectionOrder.displayId} Rejected: ${reason}`);
            setRejectionOrder(null);
        } else {
            alert('Failed to reject order');
        }
    };

    const formatTimer = (createdAtStr: string) => {
        const createdAt = new Date(createdAtStr).getTime();
        const expiresAt = createdAt + (2 * 60 * 1000); // 2 minutes auto-reject
        const remaining = Math.max(0, expiresAt - now);

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const timerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const isExpiringSoon = remaining < (30 * 1000); // 30 seconds left
        return { timerText, isExpiringSoon };
    };

    const handleEnterOTP = (order: Order) => {
        setSelectedOrder(order);
        setShowOTPModal(true);
    };

    const handleVerifyOTP = async (otp: string) => {
        if (!selectedOrder) return false;
        const res = await verifyOTP(selectedOrder.id, otp);
        if (res.success) {
            setShowOTPModal(false);
            setReceiptOrder(selectedOrder);
            setShowReceiptModal(true);
            showToast(`Order #${selectedOrder.displayId} Completed Successfully`);
            return true;
        }
        return false;
    };

    const renderOrderCard = ({ item }: { item: Order }) => {
        const isPending = item.status === 'PENDING';
        const isProcessing = item.status === 'CONFIRMED' || item.status === 'PREPARING';
        const isReady = item.status === 'READY';
        const { timerText, isExpiringSoon } = formatTimer(item.createdAt);
        const isExpanded = expandedOrderId === item.id;

        const subTotal = item.items.reduce((acc, oi) => acc + (oi.price * oi.quantity), 0);
        const tax = item.items.reduce((acc, oi) => {
            const rate = oi.storeProduct.product.gstRate || 0;
            return acc + (oi.price * oi.quantity * (rate / 100));
        }, 0);

        return (
            <View style={styles.orderCard}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.orderId}>Order #{item.displayId}</Text>
                        <Text style={styles.placedAt}>Placed at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    {isPending && (
                        <View style={styles.approvalBadge}>
                            <Text style={styles.approvalText}>APPROVAL NEEDED</Text>
                        </View>
                    )}
                    {item.isPaid && isProcessing && (
                        <View style={styles.paidBadge}>
                            <Text style={styles.paidBadgeText}>PAID - START PACKING</Text>
                        </View>
                    )}
                    {item.status === 'COMPLETED' && (
                        <View style={[styles.paidBadge, { backgroundColor: '#10B981' }]}>
                            <Text style={styles.paidBadgeText}>COMPLETED</Text>
                        </View>
                    )}
                    {item.status === 'CANCELLED' && (
                        <View style={[styles.approvalBadge, { backgroundColor: '#EF4444' }]}>
                            <Text style={styles.approvalText}>CANCELLED</Text>
                        </View>
                    )}
                    {item.status === 'RETURN_REQUESTED' && (
                        <View style={[styles.approvalBadge, { backgroundColor: '#F97316' }]}>
                            <Text style={styles.approvalText}>RETURN REQUESTED</Text>
                        </View>
                    )}
                    {item.status === 'RETURN_APPROVED' && (
                        <View style={[styles.paidBadge, { backgroundColor: '#10B981' }]}>
                            <Text style={styles.paidBadgeText}>RETURN APPROVED</Text>
                        </View>
                    )}
                    {item.status === 'RETURN_REJECTED' && (
                        <View style={[styles.approvalBadge, { backgroundColor: '#EF4444' }]}>
                            <Text style={styles.approvalText}>RETURN REJECTED</Text>
                        </View>
                    )}
                    {item.status === 'REFUNDED' && (
                        <View style={[styles.approvalBadge, { backgroundColor: '#8B5CF6' }]}>
                            <Text style={styles.approvalText}>REFUNDED</Text>
                        </View>
                    )}
                </View>

                {isPending && (
                    <View style={[styles.timerBar, isExpiringSoon && styles.timerBarUrgent]}>
                        <Ionicons name="time-outline" size={16} color={isExpiringSoon ? '#EF4444' : '#10B981'} />
                        <Text style={[styles.timerText, isExpiringSoon && styles.timerTextUrgent]}>
                            Auto-rejects in {timerText}
                        </Text>
                    </View>
                )}

                <View style={styles.itemsSection}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="cube-outline" size={18} color="#6B7280" />
                        <Text style={styles.sectionTitle}>Items ({item.items.length})</Text>
                    </View>
                    {item.items.map((oi) => (
                        <View key={oi.id} style={styles.itemRow}>
                            <View style={styles.itemMainInfo}>
                                <View style={styles.itemDot} />
                                <Text style={styles.itemText} numberOfLines={1}>
                                    <Text style={styles.itemQty}>{oi.quantity}x</Text> {oi.storeProduct.product.name}
                                </Text>
                            </View>

                            <View style={styles.itemSideInfo}>
                                {oi.storeProduct.stock < 5 ? (
                                    <View style={styles.lowStockBadge}>
                                        <Text style={styles.lowStockText}>⚠️ Low</Text>
                                    </View>
                                ) : (
                                    <View style={styles.stockBadge}>
                                        <Text style={styles.stockText}>Stock: {oi.storeProduct.stock}</Text>
                                    </View>
                                )}
                                <Text style={styles.itemPrice}>₹{oi.price * oi.quantity}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={[styles.cardFooter, isExpanded && styles.cardFooterExpanded]}>
                    <View>
                        <Text style={styles.valueLabel}>Total Bill: <Text style={styles.valueAmount}>₹{item.totalAmount}</Text></Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleAccordion(item.id)} style={styles.breakupBtn}>
                        <Text style={styles.breakupText}>View Breakup</Text>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                {isExpanded && (
                    <View style={styles.breakupContent}>
                        <View style={styles.breakupRow}>
                            <Text style={styles.breakupLabel}>Subtotal</Text>
                            <Text style={styles.breakupValue}>₹{subTotal.toFixed(0)}</Text>
                        </View>
                        <View style={styles.breakupRow}>
                            <Text style={styles.breakupLabel}>Tax</Text>
                            <Text style={styles.breakupValue}>₹{tax.toFixed(0)}</Text>
                        </View>
                        <View style={styles.breakupDivider} />
                        <View style={styles.breakupRow}>
                            <Text style={styles.breakupTotalLabel}>Total</Text>
                            <Text style={styles.breakupTotalValue}>₹{item.totalAmount}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.actionRow}>
                    {isPending && (
                        <>
                            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleUpdateStatus(item.id, 'CANCELLED', item.displayId)}>
                                <Text style={styles.rejectBtnText}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleUpdateStatus(item.id, 'CONFIRMED', item.displayId)}>
                                <Text style={styles.acceptBtnText}>Accept Order</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {isProcessing && (
                        <>
                            <TouchableOpacity style={styles.kotBtn} onPress={() => {
                                showToast(`Printing KOT for Order #${item.displayId}...`);
                                // In a real app, this would trigger a Bluetooth print job
                            }}>
                                <Ionicons name="print-outline" size={20} color="#111827" />
                                <Text style={styles.kotBtnText}>Print KOT</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.readyBtn}
                                onPress={() => handleUpdateStatus(item.id, 'READY', item.displayId)}
                            >
                                <Text style={styles.readyBtnText}>Mark Ready</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {isReady && (
                        <TouchableOpacity style={styles.otpBtn} onPress={() => handleEnterOTP(item)}>
                            <Text style={styles.otpBtnText}>Enter OTP</Text>
                            <Ionicons name="chevron-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const isOffline = !store?.active;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {isOffline && (
                <View style={styles.offlineBanner}>
                    <Ionicons name="close-circle" size={20} color="#FFF" />
                    <Text style={styles.offlineText}>Store Offline - Not accepting new orders</Text>
                </View>
            )}

            <View style={[styles.mainContent, isOffline && styles.greyscale]}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Orders</Text>
                    <View style={styles.storeInfo}>
                        <Text style={styles.storeName}>{store?.name || 'Loading Store...'} - Main Branch</Text>
                        <View style={styles.onlineBadge}>
                            <View style={[styles.onlineDot, { backgroundColor: store?.active !== false ? '#10B981' : '#9CA3AF' }]} />
                            <Text style={[styles.onlineText, { color: store?.active !== false ? '#10B981' : '#9CA3AF' }]}>
                                {store?.active !== false ? 'Online' : 'Offline'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.searchBox}>
                    <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search Order ID..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                <View style={styles.tabContainer}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.value}
                            onPress={() => setActiveTab(tab.value)}
                            style={[styles.tab, activeTab === tab.value && styles.activeTab]}
                        >
                            <Text style={[styles.tabText, activeTab === tab.value && styles.activeTabText]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Date Filter - Only show for History tab */}
                {activeTab === 'history' && (
                    <View style={styles.dateFilterContainer}>
                        <View style={styles.dateFilterButtons}>
                            {[{ label: 'All', value: 'all' }, { label: 'Today', value: 'today' }, { label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }].map(filter => (
                                <TouchableOpacity
                                    key={filter.value}
                                    style={[styles.dateFilterBtn, dateFilter === filter.value && styles.dateFilterBtnActive]}
                                    onPress={() => setDateFilter(filter.value as any)}
                                >
                                    <Text style={[styles.dateFilterBtnText, dateFilter === filter.value && styles.dateFilterBtnTextActive]}>{filter.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                <FlatList
                    data={filteredOrders}
                    renderItem={renderOrderCard}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={Colors.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="receipt" size={64} color="#E5E7EB" />
                            <Text style={styles.emptyTitle}>No {activeTab} orders</Text>
                            <Text style={styles.emptyDesc}>New orders in this category will appear here.</Text>
                        </View>
                    }
                />

                {toastMessage && (
                    <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
                        <Text style={styles.toastText}>{toastMessage}</Text>
                    </Animated.View>
                )}

                <OTPVerificationModal
                    visible={showOTPModal}
                    onClose={() => setShowOTPModal(false)}
                    onVerify={handleVerifyOTP}
                    orderId={selectedOrder?.id || ''}
                />

                <ReceiptSummaryModal
                    visible={showReceiptModal}
                    onClose={() => setShowReceiptModal(false)}
                    order={receiptOrder}
                />

                <RejectionReasonModal
                    visible={showRejectionModal}
                    onClose={() => setShowRejectionModal(false)}
                    onConfirm={handleConfirmRejection}
                    orderId={rejectionOrder?.displayId || ''}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        padding: 12,
        gap: 8
    },
    offlineText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    mainContent: { flex: 1 },
    greyscale: { opacity: 0.6 },
    header: { paddingHorizontal: 20, paddingTop: 10, alignItems: 'center' },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#111827' },
    storeInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    storeName: { fontSize: 14, color: '#6B7280', marginRight: 8 },
    onlineBadge: { flexDirection: 'row', alignItems: 'center' },
    onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
    onlineText: { fontSize: 14, fontWeight: '600' },

    searchBox: {
        margin: 20,
        paddingHorizontal: 16,
        height: 52,
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6'
    },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: '#111827' },

    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        justifyContent: 'space-between'
    },
    tab: {
        paddingVertical: 12,
        flex: 1,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent'
    },
    activeTab: { borderBottomColor: Colors.primary },
    tabText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
    activeTabText: { color: Colors.primary },

    list: { padding: 20, paddingBottom: 20 },
    orderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    orderId: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    placedAt: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    approvalBadge: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    approvalText: { fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' },
    paidBadge: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    paidBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' },

    timerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        gap: 8
    },
    timerBarUrgent: { backgroundColor: '#FEF2F2' },
    timerText: { fontSize: 15, fontWeight: 'bold', color: '#059669' },
    timerTextUrgent: { color: '#EF4444' },

    itemsSection: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#374151' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    itemMainInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
    itemSideInfo: { flexDirection: 'row', alignItems: 'center' },
    itemDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 12 },
    itemText: { flex: 1, fontSize: 15, color: '#111827' },
    itemQty: { fontWeight: '700' },
    itemPrice: { fontSize: 15, fontWeight: '700', color: '#111827', marginLeft: 16, minWidth: 50, textAlign: 'right' },
    lowStockBadge: { backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    lowStockText: { fontSize: 11, fontWeight: 'bold', color: '#C2410C' },
    stockBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    stockText: { fontSize: 11, fontWeight: '600', color: '#15803D' },

    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 16
    },
    cardFooterExpanded: {
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        marginBottom: 16
    },
    valueLabel: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    valueAmount: { color: '#111827' },
    breakupBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    breakupText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },

    breakupContent: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 16 },
    breakupRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    breakupLabel: { fontSize: 15, color: '#6B7280' },
    breakupValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
    breakupDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
    breakupTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    breakupTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#111827' },

    actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    rejectBtn: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
        justifyContent: 'center',
        alignItems: 'center'
    },
    rejectBtnText: { fontSize: 16, fontWeight: 'bold', color: '#EF4444' },
    acceptBtn: {
        flex: 2,
        height: 56,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    acceptBtnText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },

    kotBtn: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    reasonContainer: {
        backgroundColor: '#FEF2F2',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FECACA'
    },
    reasonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
    },
    reasonTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#991B1B'
    },
    reasonText: {
        fontSize: 14,
        color: '#7F1D1D',
        lineHeight: 20
    },
    imageScroll: {
        marginTop: 12
    },
    evidenceImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 8,
        backgroundColor: '#E5E7EB',
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    kotBtnText: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    readyBtn: {
        flex: 2,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center'
    },
    readyBtnText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },

    otpBtn: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#000000',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    otpBtnText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },

    toast: {
        position: 'absolute',
        bottom: 120,
        left: 20,
        right: 20,
        backgroundColor: '#111827',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10
    },
    toastText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

    dateFilterContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F9FAFB' },
    dateFilterButtons: { flexDirection: 'row', gap: 8 },
    dateFilterBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
    dateFilterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    dateFilterBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    dateFilterBtnTextActive: { color: '#FFFFFF' },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, padding: 40 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#374151', marginTop: 20 },
    emptyDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 }
});
