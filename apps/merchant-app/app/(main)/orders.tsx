import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, ScrollView, Animated, LayoutAnimation, Platform, UIManager, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useOrders, Order, OrderStatus, DateRange } from '../../src/hooks/useOrders';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useFocusEffect } from 'expo-router';
import { useStore } from '../../src/hooks/useStore';
import OTPVerificationModal from '../../src/components/OTPVerificationModal';
import ReceiptSummaryModal from '../../src/components/ReceiptSummaryModal';
import RejectionReasonModal from '../../src/components/RejectionReasonModal';
import { parseUtc } from '../../src/utils/dateFormat';

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
    history: ['COMPLETED', 'CANCELLED', 'REJECTED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'EXCHANGE_REQUESTED', 'EXCHANGE_APPROVED', 'EXCHANGE_REJECTED', 'REFUNDED']
};

type HistoryFilter = 'All' | 'Completed' | 'Rejected' | 'Cancelled' | 'Refunded';
const HISTORY_FILTERS: HistoryFilter[] = ['All', 'Completed', 'Rejected', 'Cancelled', 'Refunded'];
const HISTORY_FILTER_STATUS_MAP: Record<HistoryFilter, OrderStatus[] | null> = {
    'All': null,
    'Completed': ['COMPLETED'],
    'Rejected': ['REJECTED'],
    'Cancelled': ['CANCELLED'],
    'Refunded': ['REFUNDED']
};

export default function OrdersScreen() {
    const getDefaultRange = (): DateRange => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return { startDate: start.toISOString(), endDate: end.toISOString(), isDefault: true };
    };
    const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);

    const { orders, loading, refreshing, refetch, updateOrderStatus, verifyOTP, refundOrder } = useOrders(dateRange);
    const { store, activeStoreId, branches, merchantId } = useStore();
    
    const activeBranch = branches.find(b => b.id === activeStoreId);
    const isMainStore = activeStoreId === merchantId;
    const [activeTab, setActiveTab] = useState('pending');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('All');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [now, setNow] = useState(Date.now());

    // Calendar picker state
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [calendarPickingField, setCalendarPickingField] = useState<'start' | 'end'>('start');

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

        // Apply history sub-filter
        if (activeTab === 'history' && historyFilter !== 'All') {
            const subStatuses = HISTORY_FILTER_STATUS_MAP[historyFilter];
            if (subStatuses) {
                filtered = filtered.filter(o => subStatuses.includes(o.status));
            }
        }

        // Apply sort
        filtered = [...filtered].sort((a, b) => {
            const tA = parseUtc(a.createdAt).getTime();
            const tB = parseUtc(b.createdAt).getTime();
            return sortOrder === 'desc' ? tB - tA : tA - tB;
        });

        return filtered;
    }, [orders, activeTab, search, historyFilter, sortOrder]);

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
            const statusLabel = nextStatus === 'CONFIRMED' ? 'Processing' : nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase();
            showToast(`Order #${displayId} moved to ${statusLabel}`);
        } else {
            alert('Failed to update order status');
        }
    };

    const handleConfirmRejection = async (reason: string) => {
        if (!rejectionOrder) return;

        const res = await updateOrderStatus(rejectionOrder.id, 'CANCELLED', reason);
        if (res.success) {
            // Auto-refund if the order was already paid (skip for order_requests)
            if (rejectionOrder.isPaid && !rejectionOrder.id.startsWith('req_')) {
                const refundRes = await refundOrder(rejectionOrder.id, undefined, reason);
                if (refundRes.success) {
                    showToast(`Order #${rejectionOrder.displayId} Rejected & Refunded`);
                } else {
                    showToast(`Order Rejected. Refund failed — process manually.`);
                }
            } else {
                showToast(`Order #${rejectionOrder.displayId} Rejected: ${reason}`);
            }
            setShowRejectionModal(false);
            setRejectionOrder(null);
        } else {
            alert('Failed to reject order');
        }
    };

    const formatTimer = (createdAtStr: string) => {
        const createdAt = parseUtc(createdAtStr).getTime();
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
            // Fallback to 5% (standard restaurant GST) when storeProduct join is null (dine-in items)
            const rate = oi.storeProduct?.product?.gstRate ?? 5;
            return acc + (oi.price * oi.quantity * (rate / 100));
        }, 0);

        return (
            <View style={styles.orderCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.orderId}>#{item.displayId}</Text>
                    {item.orderType === 'dine-in' ? (
                        <View style={[styles.orderTypeBadge, { backgroundColor: '#7C3AED' }]}>
                            <Text style={styles.orderTypeBadgeText}>DINE-IN</Text>
                        </View>
                    ) : (
                        <View style={[styles.orderTypeBadge, { backgroundColor: '#3B82F6' }]}>
                            <Text style={styles.orderTypeBadgeText}>PICKUP</Text>
                        </View>
                    )}
                </View>

                {/* Status Strip Container */}
                <View style={styles.statusStripContainer}>
                    {isPending && (
                        <View style={[styles.approvalStrip, isExpiringSoon && styles.approvalStripUrgent]}>
                            <Text style={styles.approvalStripText}>APPROVAL NEEDED</Text>
                            <Text style={[styles.approvalStripTimer, isExpiringSoon && styles.approvalStripTimerUrgent]}>
                                {timerText}
                            </Text>
                        </View>
                    )}
                    {item.isPaid && isProcessing && (
                        <View style={[styles.approvalStrip, { backgroundColor: '#10B981', justifyContent: 'center' }]}>
                            <Text style={styles.approvalStripText}>PAID - START PACKING</Text>
                        </View>
                    )}
                    {!item.isPaid && isProcessing && (
                        <View style={[styles.approvalStrip, { backgroundColor: '#F59E0B', justifyContent: 'center' }]}>
                            <Text style={styles.approvalStripText}>AWAITING PAYMENT</Text>
                        </View>
                    )}
                    {item.status === 'COMPLETED' && (
                        <View style={[styles.approvalStrip, { backgroundColor: '#10B981', justifyContent: 'center' }]}>
                            <Text style={styles.approvalStripText}>COMPLETED</Text>
                        </View>
                    )}
                    {item.status === 'CANCELLED' && (
                        <View style={[styles.approvalStrip, { backgroundColor: '#EF4444', justifyContent: 'center' }]}>
                            <Text style={styles.approvalStripText}>CANCELLED</Text>
                        </View>
                    )}
                    {item.status === 'REJECTED' && (
                        <View style={[styles.approvalStrip, { backgroundColor: '#6B7280', justifyContent: 'center' }]}>
                            <Text style={styles.approvalStripText}>REJECTED</Text>
                        </View>
                    )}
                    {item.status === 'RETURN_REQUESTED' && (
                        <View style={[styles.approvalStrip, { backgroundColor: '#F97316', justifyContent: 'center' }]}>
                            <Text style={styles.approvalStripText}>RETURN REQUESTED</Text>
                        </View>
                    )}
                    {item.status === 'RETURN_APPROVED' && (
                        <View style={[styles.approvalStrip, { backgroundColor: '#10B981', justifyContent: 'center' }]}>
                            <Text style={styles.approvalStripText}>RETURN APPROVED</Text>
                        </View>
                    )}
                    {item.status === 'RETURN_REJECTED' && (
                        <View style={[styles.approvalStrip, { backgroundColor: '#EF4444', justifyContent: 'center' }]}>
                            <Text style={styles.approvalStripText}>RETURN REJECTED</Text>
                        </View>
                    )}
                    {item.status === 'REFUNDED' && (
                        <View style={[styles.approvalStrip, { backgroundColor: '#8B5CF6', justifyContent: 'center' }]}>
                            <Text style={styles.approvalStripText}>REFUNDED</Text>
                        </View>
                    )}
                </View>

                <View style={styles.dottedSeparator} />

                <View style={styles.timeSection}>
                    <Text style={styles.placedAt}>Placed at {parseUtc(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    {item.arrivalTime ? (
                        <Text style={styles.pickupAt}>{item.orderType === 'dine-in' ? 'Dine-in time' : 'Pickup'}: {item.arrivalTime}</Text>
                    ) : null}
                    {item.guestsCount ? (
                        <Text style={{ fontSize: 13, color: '#7C3AED', marginTop: 2, fontWeight: '600' }}>
                            👥 {item.guestsCount} {item.guestsCount === 1 ? 'Guest' : 'Guests'}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.dottedSeparator} />





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
                                    <Text style={styles.itemQty}>{oi.quantity}x</Text> {oi.product_name || oi.storeProduct?.product?.name || 'Unknown Product'}
                                </Text>
                            </View>

                            <View style={styles.itemSideInfo}>
                                {oi.storeProduct?.stock != null && oi.storeProduct.stock < 5 ? (
                                    <View style={styles.lowStockBadge}>
                                        <Text style={styles.lowStockText}>⚠️ Low</Text>
                                    </View>
                                ) : oi.storeProduct?.stock != null ? (
                                    <View style={styles.stockBadge}>
                                        <Text style={styles.stockText}>Stock: {oi.storeProduct?.stock ?? 'N/A'}</Text>
                                    </View>
                                ) : null}
                                <Text style={styles.itemPrice}>₹{oi.price * oi.quantity}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={[styles.cardFooter, isExpanded && styles.cardFooterExpanded]}>
                    <View>
                        <Text style={styles.valueLabel}>Total Bill: <Text style={styles.valueAmount}>₹{(subTotal + tax).toFixed(2)}</Text></Text>
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
                            <Text style={styles.breakupValue}>₹{subTotal.toFixed(2)}</Text>
                        </View>
                        <View style={styles.breakupRow}>
                            <Text style={styles.breakupLabel}>Tax</Text>
                            <Text style={styles.breakupValue}>₹{tax.toFixed(2)}</Text>
                        </View>
                        <View style={styles.breakupDivider} />
                        <View style={styles.breakupRow}>
                            <Text style={styles.breakupTotalLabel}>Total</Text>
                            <Text style={styles.breakupTotalValue}>₹{(subTotal + tax).toFixed(2)}</Text>
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
                            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleUpdateStatus(item.id, 'CANCELLED', item.displayId)}>
                                <Text style={styles.rejectBtnText}>Reject</Text>
                            </TouchableOpacity>
                            {item.isPaid ? (
                                <>

                                    <TouchableOpacity
                                        style={styles.readyBtn}
                                        onPress={() => handleUpdateStatus(item.id, 'READY', item.displayId)}
                                    >
                                        <Text style={styles.readyBtnText}>Mark Ready</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <View style={styles.awaitingPaymentBtn}>
                                    <Ionicons name="hourglass-outline" size={18} color="#92400E" />
                                    <Text style={styles.awaitingPaymentText}>Awaiting Payment</Text>
                                </View>
                            )}
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

    const isOffline = isMainStore ? !store?.active : !activeBranch?.isActive;

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
                        <Text style={styles.storeName}>{activeBranch?.name || store?.name || 'Loading Store...'}</Text>
                        <View style={styles.onlineBadge}>
                            <View style={[styles.onlineDot, { backgroundColor: !isOffline ? '#10B981' : '#9CA3AF' }]} />
                            <Text style={[styles.onlineText, { color: !isOffline ? '#10B981' : '#9CA3AF' }]}>
                                {!isOffline ? 'Online' : 'Offline'}
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

                {/* History Filters — Only show for History tab */}
                {activeTab === 'history' && (
                    <View style={styles.historyControlsContainer}>
                        {/* Date Range Row */}
                        <View style={styles.dateRangeRow}>
                            <TouchableOpacity 
                                style={styles.dateRangeBtn} 
                                onPress={() => { setCalendarPickingField('start'); setCalendarVisible(true); }}
                            >
                                <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                                <Text style={styles.dateRangeBtnText}>{new Date(dateRange.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                            </TouchableOpacity>
                            <Text style={styles.dateRangeSeparator}>→</Text>
                            <TouchableOpacity 
                                style={styles.dateRangeBtn} 
                                onPress={() => { setCalendarPickingField('end'); setCalendarVisible(true); }}
                            >
                                <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                                <Text style={styles.dateRangeBtnText}>{new Date(dateRange.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.sortToggleBtn} 
                                onPress={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                            >
                                <Ionicons name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} size={18} color="#111827" />
                                <Text style={styles.sortToggleText}>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Status Pill Filters */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyPillRow}>
                            {HISTORY_FILTERS.map(f => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.historyPill, historyFilter === f && styles.historyPillActive]}
                                    onPress={() => setHistoryFilter(f)}
                                >
                                    <Text style={[styles.historyPillText, historyFilter === f && styles.historyPillTextActive]}>{f}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
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

                <DateTimePickerModal
                    isVisible={calendarVisible}
                    mode="date"
                    onConfirm={(date) => {
                        setCalendarVisible(false);
                        if (calendarPickingField === 'start') {
                            const d = new Date(date);
                            d.setHours(0, 0, 0, 0);
                            setDateRange(prev => ({ ...prev, startDate: d.toISOString(), isDefault: false }));
                        } else {
                            const d = new Date(date);
                            d.setHours(23, 59, 59, 999);
                            setDateRange(prev => ({ ...prev, endDate: d.toISOString(), isDefault: false }));
                        }
                    }}
                    onCancel={() => setCalendarVisible(false)}
                    maximumDate={new Date()}
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
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderId: { fontSize: 18, fontWeight: '800', color: '#111827' },
    orderTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    orderTypeBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },

    statusStripContainer: { width: '100%', marginTop: 12 },
    approvalStrip: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: Colors.primary, 
        padding: 12, 
        borderRadius: 10, 
        width: '100%' 
    },
    approvalStripUrgent: { backgroundColor: '#DC2626' },
    approvalStripText: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' },
    approvalStripTimer: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: '#FFFFFF', 
        fontVariant: ['tabular-nums'] 
    },
    approvalStripTimerUrgent: { color: '#FEF2F2' },

    dottedSeparator: {
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        borderStyle: 'dashed',
        marginVertical: 12
    },
    
    timeSection: { width: '100%' },
    placedAt: { fontSize: 13, color: '#6B7280' },
    pickupAt: { fontSize: 13, color: '#B52725', marginTop: 4, fontWeight: '600' },

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
    readyBtn: {
        flex: 2,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center'
    },
    readyBtnText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
    awaitingPaymentBtn: {
        flex: 2,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#FEF3C7',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    awaitingPaymentText: { fontSize: 14, fontWeight: '700', color: '#92400E' },

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

    historyControlsContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, backgroundColor: '#F9FAFB' },
    dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    dateRangeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    dateRangeBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
    dateRangeSeparator: { fontSize: 16, color: '#9CA3AF', fontWeight: '600' },
    sortToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    sortToggleText: { fontSize: 13, fontWeight: '600', color: '#111827' },
    historyPillRow: { flexDirection: 'row', gap: 8, paddingBottom: 8 },
    historyPill: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    historyPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    historyPillText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    historyPillTextActive: { color: '#FFFFFF' },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, padding: 40 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#374151', marginTop: 20 },
    emptyDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 }
});
