import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { useOrders, Order } from '../../../src/hooks/useOrders';

export default function ReturnsScreen() {
    const { orders, loading, updateOrderStatus, refundOrder } = useOrders();
    const [activeTab, setActiveTab] = useState<'RETURNS' | 'REFUNDS'>('RETURNS');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const filteredOrders = orders.filter(o => {
        if (activeTab === 'RETURNS') {
            return o.status === 'RETURN_REQUESTED';
        } else {
            return ['RETURN_APPROVED', 'RETURN_REJECTED', 'REFUNDED'].includes(o.status);
        }
    });

    const handleAction = async (orderId: string, action: 'APPROVE' | 'REJECT') => {
        setProcessingId(orderId);
        const newStatus = action === 'APPROVE' ? 'RETURN_APPROVED' : 'RETURN_REJECTED';
        const result = await updateOrderStatus(orderId, newStatus, action === 'REJECT' ? 'Return Rejected' : undefined);
        setProcessingId(null);

        if (result.success) {
            Alert.alert('Success', `Return request ${action === 'APPROVE' ? 'approved' : 'rejected'}`);
        } else {
            Alert.alert('Error', typeof result.error === 'string' ? result.error : 'Failed to update return status');
        }
    };

    const handleRefund = async (orderId: string, amount: number) => {
        setProcessingId(orderId);
        const result = await refundOrder(orderId, amount, 'Return Refund');
        setProcessingId(null);

        if (result.success) {
            Alert.alert('Success', 'Refund processed successfully');
        } else {
            Alert.alert('Error', typeof result.error === 'string' ? result.error : 'Failed to process refund');
        }
    };

    const renderItem = ({ item }: { item: Order }) => {
        const subTotal = item.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
        const tax = item.totalAmount - subTotal; // Simplified tax calc

        return (
            <View style={styles.card}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.orderId}>Order #{item.displayId}</Text>
                        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <View style={[styles.badge, (styles as any)[item.status] || styles.badge]}>
                        <Text style={styles.badgeText}>{item.status.replace('RETURN_', '').replace('_', ' ')}</Text>
                    </View>
                </View>

                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Payment Method:</Text>
                        <Text style={styles.detailValue}>Online (Razorpay)</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Total Bill:</Text>
                        <Text style={styles.amount}>₹{item.totalAmount}</Text>
                    </View>
                </View>

                {/* Return Reason & Images */}
                {(item.returnReason || (item.returnImages?.length ?? 0) > 0) && (
                    <View style={styles.reasonContainer}>
                        <View style={styles.reasonHeader}>
                            <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
                            <Text style={styles.reasonTitle}>Return Reason</Text>
                        </View>
                        <Text style={styles.reasonText}>{item.returnReason}</Text>

                        {item.returnImages && item.returnImages.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                {item.returnImages.map((img, index) => (
                                    <TouchableOpacity key={index} onPress={() => setSelectedImage(img)}>
                                        <Image
                                            source={img}
                                            style={styles.evidenceImage}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* Items Section */}
                <View style={styles.itemsContainer}>
                    <Text style={styles.sectionHeader}>Items Included:</Text>
                    {item.items.map(i => (
                        <View key={i.id} style={styles.itemRow}>
                            <Text style={styles.itemText} numberOfLines={1}>
                                <Text style={{ fontWeight: 'bold' }}>{i.quantity}x</Text> {i.storeProduct.product.name}
                            </Text>
                            <Text style={styles.itemPrice}>₹{i.price * i.quantity}</Text>
                        </View>
                    ))}
                    <View style={styles.divider} />
                    <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Subtotal</Text>
                        <Text style={styles.billValue}>₹{subTotal.toFixed(0)}</Text>
                    </View>
                    <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Tax</Text>
                        <Text style={styles.billValue}>₹{tax.toFixed(0)}</Text>
                    </View>
                </View>

                {/* Actions */}
                {activeTab === 'RETURNS' && item.status === 'RETURN_REQUESTED' && (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.rejectBtn]}
                            onPress={() => handleAction(item.id, 'REJECT')}
                            disabled={!!processingId}
                        >
                            {processingId === item.id ? <ActivityIndicator color="#EF4444" /> : <Text style={styles.rejectText}>Reject Request</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, styles.approveBtn]}
                            onPress={() => handleAction(item.id, 'APPROVE')}
                            disabled={!!processingId}
                        >
                            {processingId === item.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.approveText}>Approve Return</Text>}
                        </TouchableOpacity>
                    </View>
                )}

                {activeTab === 'REFUNDS' && item.status === 'RETURN_APPROVED' && (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.refundBtn]}
                            onPress={() => handleRefund(item.id, item.totalAmount)}
                            disabled={!!processingId}
                        >
                            {processingId === item.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.approveText}>Initiate Refund ₹{item.totalAmount}</Text>}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Returns & Refunds</Text>
            </View>

            {/* Toggle Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'RETURNS' && styles.activeTab]}
                    onPress={() => setActiveTab('RETURNS')}
                >
                    <Text style={[styles.tabText, activeTab === 'RETURNS' && styles.activeTabText]}>Returns (Requests)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'REFUNDS' && styles.activeTab]}
                    onPress={() => setActiveTab('REFUNDS')}
                >
                    <Text style={[styles.tabText, activeTab === 'REFUNDS' && styles.activeTabText]}>Refunds (Payments)</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredOrders}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name={activeTab === 'RETURNS' ? "cube-outline" : "cash-outline"} size={64} color="#D1D5DB" />
                        <Text style={styles.emptyText}>No {activeTab.toLowerCase()} pending</Text>
                    </View>
                }
            />

            {/* Image Viewer Modal */}
            <Modal visible={!!selectedImage} transparent={true} onRequestClose={() => setSelectedImage(null)}>
                <View style={styles.modalContainer}>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedImage(null)}>
                        <Ionicons name="close" size={30} color="#FFF" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image
                            source={selectedImage}
                            style={styles.fullImage}
                            contentFit="contain"
                            transition={200}
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    navBar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backBtn: { marginRight: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },

    tabContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#FFF' },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: Colors.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    activeTabText: { color: Colors.primary },

    list: { padding: 16 },
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    orderId: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    date: { fontSize: 13, color: '#6B7280', marginTop: 2 },

    detailsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    detailRow: {},
    detailLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
    detailValue: { fontSize: 14, color: '#111827', fontWeight: '500' },

    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
    RETURN_REQUESTED: { backgroundColor: '#F97316' },
    RETURN_APPROVED: { backgroundColor: '#10B981' }, // Green for approved, ready for refund
    RETURN_REJECTED: { backgroundColor: '#EF4444' },
    REFUNDED: { backgroundColor: '#8B5CF6' }, // Purple for completed refunds

    amount: { fontSize: 16, fontWeight: 'bold', color: '#111827' },

    itemsContainer: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 16 },
    sectionHeader: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    itemText: { fontSize: 14, color: '#374151', flex: 1 },
    itemPrice: { fontSize: 14, color: '#374151', fontWeight: '500' },
    divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
    billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    billLabel: { fontSize: 13, color: '#6B7280' },
    billValue: { fontSize: 13, color: '#374151', fontWeight: '600' },

    actions: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
    approveBtn: { backgroundColor: Colors.primary },
    refundBtn: { backgroundColor: '#8B5CF6' },
    rejectText: { color: '#EF4444', fontWeight: 'bold' },
    approveText: { color: '#FFF', fontWeight: 'bold' },

    empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { color: '#9CA3AF', marginTop: 16, fontSize: 16 },

    reasonContainer: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
    reasonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    reasonTitle: { fontSize: 13, fontWeight: 'bold', color: '#991B1B' },
    reasonText: { fontSize: 14, color: '#7F1D1D', lineHeight: 20 },
    imageScroll: { marginTop: 8 },
    evidenceImage: { width: 60, height: 60, borderRadius: 6, marginRight: 8, backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#E5E7EB' },


    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '80%' },
    closeBtn: { position: 'absolute', top: 40, right: 20, zIndex: 1, padding: 10 }
});
