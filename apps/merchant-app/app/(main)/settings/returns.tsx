import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { useOrders, Order } from '../../../src/hooks/useOrders';

export default function ReturnsScreen() {
    const { orders, loading, updateOrderStatus } = useOrders();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const returnOrders = orders.filter(o =>
        ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'REFUNDED'].includes(o.status)
    );

    const handleAction = async (orderId: string, action: 'APPROVE' | 'REJECT') => {
        setProcessingId(orderId);
        const newStatus = action === 'APPROVE' ? 'RETURN_APPROVED' : 'RETURN_REJECTED';

        const result = await updateOrderStatus(orderId, newStatus);

        setProcessingId(null);
        if (result.success) {
            Alert.alert('Success', `Return request ${action === 'APPROVE' ? 'approved' : 'rejected'}`);
        } else {
            Alert.alert('Error', 'Failed to update return status');
        }
    };

    const renderItem = ({ item }: { item: Order }) => (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.orderId}>Order #{item.displayId}</Text>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>

            <View style={styles.statusRow}>
                <View style={[styles.badge, styles[item.status]]}>
                    <Text style={styles.badgeText}>{item.status.replace('RETURN_', '').replace('_', ' ')}</Text>
                </View>
                <Text style={styles.amount}>₹{item.totalAmount}</Text>
            </View>

            <View style={styles.itemsContainer}>
                <Text style={styles.label}>Items:</Text>
                {item.items.map(i => (
                    <Text key={i.id} style={styles.itemText}>{i.quantity}x {i.storeProduct.product.name}</Text>
                ))}
            </View>

            {/* TODO: Show Return Reason if available in schema/hook */}

            {item.status === 'RETURN_REQUESTED' && (
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.btn, styles.rejectBtn]}
                        onPress={() => handleAction(item.id, 'REJECT')}
                        disabled={!!processingId}
                    >
                        {processingId === item.id ? <ActivityIndicator color="#EF4444" /> : <Text style={styles.rejectText}>Reject</Text>}
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
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Returns & Disputes</Text>
            </View>

            <FlatList
                data={returnOrders}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="checkmark-circle-outline" size={64} color="#D1D5DB" />
                        <Text style={styles.emptyText}>No return requests pending</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    navBar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backBtn: { marginRight: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    list: { padding: 16 },
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    orderId: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    date: { fontSize: 14, color: '#6B7280' },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 12, fontWeight: 'bold', color: '#FFF' },
    RETURN_REQUESTED: { backgroundColor: '#F97316' },
    RETURN_APPROVED: { backgroundColor: '#10B981' },
    RETURN_REJECTED: { backgroundColor: '#EF4444' },
    REFUNDED: { backgroundColor: '#8B5CF6' },
    amount: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    itemsContainer: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 16 },
    label: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
    itemText: { fontSize: 14, color: '#374151', marginBottom: 2 },
    actions: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
    approveBtn: { backgroundColor: Colors.primary },
    rejectText: { color: '#EF4444', fontWeight: 'bold' },
    approveText: { color: '#FFF', fontWeight: 'bold' },
    empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { color: '#9CA3AF', marginTop: 16, fontSize: 16 }
});
