import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

interface OTPVerificationModalProps {
    visible: boolean;
    onClose: () => void;
    onVerify: (otp: string) => Promise<boolean>;
    orderId: string;
}

export default function OTPVerificationModal({ visible, onClose, onVerify, orderId }: OTPVerificationModalProps) {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePress = (num: string) => {
        if (otp.length < 4) {
            setOtp(prev => prev + num);
            setError(null);
        }
    };

    const handleClear = () => {
        setOtp('');
        setError(null);
    };

    const handleBackspace = () => {
        setOtp(prev => prev.slice(0, -1));
        setError(null);
    };

    const handleVerify = async () => {
        if (otp.length !== 4) return;
        setLoading(true);
        const success = await onVerify(otp);
        setLoading(false);
        if (!success) {
            setError('Invalid PIN. Please try again.');
        }
    };

    const renderKey = (val: string, label?: string, type: 'num' | 'action' = 'num') => (
        <TouchableOpacity
            style={[styles.key, type === 'action' && styles.actionKey]}
            onPress={() => {
                if (val === 'CLR') handleClear();
                else if (val === 'BK') handleBackspace();
                else handlePress(val);
            }}
        >
            {label ? (
                <Text style={[styles.keyText, type === 'action' && styles.actionKeyText]}>{label}</Text>
            ) : val === 'BK' ? (
                <Ionicons name="backspace-outline" size={24} color="#111827" />
            ) : (
                <Text style={styles.keyText}>{val}</Text>
            )}
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.dismiss} activeOpacity={1} onPress={onClose} />
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Pickup Verification</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={28} color="#D1D5DB" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>Ask the customer for the 4-digit PIN to mark this order as completed.</Text>

                    <View style={styles.otpContainer}>
                        {[0, 1, 2, 3].map((index) => (
                            <View key={index} style={[styles.otpDot, otp.length > index && styles.otpDotActive]} />
                        ))}
                    </View>

                    {error && <Text style={styles.errorText}>{error}</Text>}

                    <View style={styles.keypad}>
                        <View style={styles.row}>
                            {renderKey('1')}
                            {renderKey('2')}
                            {renderKey('3')}
                        </View>
                        <View style={styles.row}>
                            {renderKey('4')}
                            {renderKey('5')}
                            {renderKey('6')}
                        </View>
                        <View style={styles.row}>
                            {renderKey('7')}
                            {renderKey('8')}
                            {renderKey('9')}
                        </View>
                        <View style={styles.row}>
                            {renderKey('CLR', 'CLR', 'action')}
                            {renderKey('0')}
                            {renderKey('BK', '', 'action')}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.verifyBtn, (otp.length < 4 || loading) && styles.verifyBtnDisabled]}
                        onPress={handleVerify}
                        disabled={otp.length < 4 || loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.verifyBtnText}>Verify & Complete</Text>
                        )}
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
        alignItems: 'center'
    },
    header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
    subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32, paddingHorizontal: 20, lineHeight: 22 },
    otpContainer: { flexDirection: 'row', gap: 16, marginBottom: 24 },
    otpDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E5E7EB' },
    otpDotActive: { backgroundColor: '#111827' },
    errorText: { color: '#EF4444', fontSize: 14, fontWeight: '600', marginBottom: 16 },
    keypad: { width: '100%', gap: 12, marginBottom: 32 },
    row: { flexDirection: 'row', gap: 12 },
    key: {
        flex: 1,
        height: 64,
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6'
    },
    keyText: { fontSize: 24, fontWeight: '600', color: '#111827' },
    actionKey: { backgroundColor: '#FFF7ED' },
    actionKeyText: { fontSize: 16, color: '#EF4444', fontWeight: 'bold' },
    verifyBtn: {
        width: '100%',
        height: 64,
        backgroundColor: '#374151',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    },
    verifyBtnDisabled: { backgroundColor: '#9CA3AF' },
    verifyBtnText: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' }
});
