import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

interface RejectionReasonModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    orderId: string;
}

const REASONS = [
    'Store Closing Soon',
    'Too Many Orders',
    'Price Mismatch',
    'Other'
];

export default function RejectionReasonModal({ visible, onClose, onConfirm, orderId }: RejectionReasonModalProps) {
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [customReason, setCustomReason] = useState('');

    const handleConfirm = () => {
        if (selectedReason === 'Other') {
            if (customReason.trim()) {
                onConfirm(customReason.trim());
                resetState();
            }
        } else if (selectedReason) {
            onConfirm(selectedReason);
            resetState();
        }
    };

    const resetState = () => {
        setSelectedReason(null);
        setCustomReason('');
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Reject Order</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Please select a reason for rejecting Order #{orderId.replace('PAS-', '')}
                    </Text>

                    <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                        {REASONS.map((reason) => (
                            <View key={reason}>
                                <TouchableOpacity
                                    style={[
                                        styles.reasonRow,
                                        selectedReason === reason && styles.reasonRowSelected
                                    ]}
                                    onPress={() => setSelectedReason(reason)}
                                >
                                    <Text style={[
                                        styles.reasonText,
                                        selectedReason === reason && styles.reasonTextSelected
                                    ]}>
                                        {reason}
                                    </Text>
                                    {selectedReason === reason && (
                                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                                    )}
                                </TouchableOpacity>

                                {reason === 'Other' && selectedReason === 'Other' && (
                                    <TextInput
                                        style={styles.customInput}
                                        placeholder="Type reason here..."
                                        value={customReason}
                                        onChangeText={setCustomReason}
                                        autoFocus
                                    />
                                )}
                            </View>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        style={[
                            styles.confirmBtn,
                            (!selectedReason || (selectedReason === 'Other' && !customReason.trim())) && styles.confirmBtnDisabled
                        ]}
                        onPress={handleConfirm}
                        disabled={!selectedReason || (selectedReason === 'Other' && !customReason.trim())}
                    >
                        <Text style={styles.confirmBtnText}>Confirm Rejection</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    content: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '80%'
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
    list: { marginBottom: 24 },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F3F4F6'
    },
    reasonRowSelected: {
        backgroundColor: '#FEF2F2',
        borderColor: Colors.primary
    },
    reasonText: { fontSize: 15, color: '#374151', fontWeight: '500' },
    reasonTextSelected: { color: Colors.primary, fontWeight: '700' },
    customInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        fontSize: 15,
        color: '#111827'
    },
    confirmBtn: {
        width: '100%',
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center'
    },
    confirmBtnDisabled: { backgroundColor: '#E5E7EB' },
    confirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
