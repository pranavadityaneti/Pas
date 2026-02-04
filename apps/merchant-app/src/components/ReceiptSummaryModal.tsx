import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Order } from '../hooks/useOrders';

interface ReceiptSummaryModalProps {
    visible: boolean;
    onClose: () => void;
    order: Order | null;
}

export default function ReceiptSummaryModal({ visible, onClose, order }: ReceiptSummaryModalProps) {
    if (!order) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.successIcon}>
                        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                    </View>

                    <Text style={styles.title}>Pickup Successful!</Text>
                    <Text style={styles.subtitle}>Order #{order.displayId} has been marked as completed.</Text>

                    <View style={styles.orderCard}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>Order Summary</Text>
                            <Text style={styles.cardPrice}>₹{order.totalAmount}</Text>
                        </View>

                        <View style={styles.divider} />

                        <ScrollView style={styles.itemList} showsVerticalScrollIndicator={false}>
                            {order.items.map((item, index) => (
                                <View key={index} style={styles.itemRow}>
                                    <Text style={styles.itemText}>
                                        <Text style={styles.itemQty}>{item.quantity}x</Text> {item.storeProduct.product.name}
                                    </Text>
                                    <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.receiptBtn} onPress={() => alert('Generating PDF Receipt...\nSent to your printer/downloads.')}>
                            <Ionicons name="cloud-download-outline" size={20} color={Colors.primary} />
                            <Text style={styles.receiptBtnText}>Download</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.receiptBtn, { marginLeft: 10 }]} onPress={() => alert('Opening share sheet...')}>
                            <Ionicons name="share-outline" size={20} color={Colors.primary} />
                            <Text style={styles.receiptBtnText}>Share</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                        <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    content: {
        backgroundColor: '#fff',
        borderRadius: 32,
        width: '100%',
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10
    },
    successIcon: { marginBottom: 16 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
    orderCard: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 20,
        padding: 16,
        maxHeight: 250,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#F3F4F6'
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
    cardPrice: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    divider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 12 },
    itemList: { width: '100%' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    itemText: { fontSize: 14, color: '#4B5563', flex: 1 },
    itemQty: { fontWeight: 'bold', color: '#111827' },
    itemPrice: { fontSize: 14, fontWeight: '600', color: '#111827' },
    receiptBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.primary,
        marginBottom: 20,
    },
    actionButtons: {
        flexDirection: 'row',
        width: '100%',
    },
    receiptBtnText: {
        color: Colors.primary,
        fontWeight: '600',
        marginLeft: 8,
    },
    doneBtn: {
        width: '100%',
        backgroundColor: '#000',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    doneBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
