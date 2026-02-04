import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Order } from '../hooks/useOrders';

interface OrderBreakupModalProps {
    visible: boolean;
    onClose: () => void;
    order: Order | null;
}

export default function OrderBreakupModal({ visible, onClose, order }: OrderBreakupModalProps) {
    if (!order) return null;

    const subTotal = order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const tax = order.items.reduce((acc, item) => {
        const rate = item.storeProduct.product.gstRate || 0;
        return acc + (item.price * item.quantity * (rate / 100));
    }, 0);
    const total = subTotal + tax;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.dismiss} activeOpacity={1} onPress={onClose} />
                <View style={styles.content}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <Text style={styles.title}>Order Value Breakup</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={24} color="#D1D5DB" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.row}>
                        <Text style={styles.label}>Sub Total</Text>
                        <Text style={styles.value}>₹{subTotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Tax (GST)</Text>
                        <Text style={styles.value}>₹{tax.toFixed(2)}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <Text style={styles.totalLabel}>Grand Total</Text>
                        <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    dismiss: { flex: 1 },
    content: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20
    },
    handle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    label: { fontSize: 15, color: '#6B7280' },
    value: { fontSize: 15, fontWeight: '600', color: '#111827' },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
    totalLabel: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
    totalValue: { fontSize: 20, fontWeight: 'bold', color: Colors.primary },
    closeButton: { backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 32 },
    closeButtonText: { fontSize: 15, fontWeight: 'bold', color: '#4B5563' }
});
