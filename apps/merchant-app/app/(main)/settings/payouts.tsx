import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import BottomModal from '../../../src/components/BottomModal';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../src/lib/supabase';
import { useUser } from '../../../src/context/UserContext';
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';
import { useEarnings } from '../../../src/hooks/useEarnings';

function formatCurrency(amount: number) {
    return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PayoutsScreen() {
    const { user } = useUser();
    const { stats: earnings, loading: earningsLoading } = useEarnings();
    const [modalVisible, setModalVisible] = useState(false);

    // Realtime Bank Details
    const { data: merchants, loading: tableLoading } = useRealtimeTable({
        tableName: 'merchants',
        select: 'bank_account_number, ifsc_code, owner_name, bank_name, bank_beneficiary_name',
        filter: user?.id ? `id=eq.${user.id}` : undefined,
        enabled: !!user?.id
    });

    const bankDetails = React.useMemo(() => {
        if (merchants && merchants.length > 0) {
            const data = merchants[0];
            if (data.bank_account_number && data.bank_account_number.trim().length > 0 && data.bank_name && data.bank_name.trim().length > 0) {
                return {
                    bankName: data.bank_name,
                    accountNumber: `**** **** **** ${data.bank_account_number.slice(-4)}`,
                    ifsc: data.ifsc_code || '',
                    beneficiary: data.bank_beneficiary_name || data.owner_name || '',
                    isSet: true,
                    isVerified: true
                };
            }
        }
        return {
            bankName: '',
            accountNumber: '',
            ifsc: '',
            beneficiary: '',
            isSet: false,
            isVerified: false
        };
    }, [merchants]);

    const loading = (tableLoading && !merchants.length) || earningsLoading;

    const [newBank, setNewBank] = useState({ name: '', account: '', ifsc: '', beneficiary: '' });

    // OTP State
    const [step, setStep] = useState(1); // 1: Details, 2: OTP
    const [otp, setOtp] = useState('');

    const handleRequestOtp = () => {
        if (!newBank.name.trim() || !newBank.account.trim() || !newBank.ifsc.trim() || !newBank.beneficiary.trim()) {
            Alert.alert('Incomplete', 'Please fill in all bank details.');
            return;
        }
        Keyboard.dismiss();
        setStep(2);
    };

    const handleVerifyOtp = async () => {
        Keyboard.dismiss();
        if (otp === '123456') {
            try {
                if (!user?.id) return;

                // Update DB — save all bank fields
                const { error } = await supabase
                    .from('merchants')
                    .update({
                        bank_account_number: newBank.account,
                        ifsc_code: newBank.ifsc,
                        bank_name: newBank.name,
                        bank_beneficiary_name: newBank.beneficiary
                    })
                    .eq('id', user.id);

                if (error) throw error;

                setModalVisible(false);
                setStep(1);
                setOtp('');
                setNewBank({ name: '', account: '', ifsc: '', beneficiary: '' });
                Alert.alert('Success', 'Bank account updated successfully!');
            } catch (err: any) {
                Alert.alert('Error', 'Failed to update bank details: ' + err.message);
            }
        } else {
            Alert.alert('Error', 'Invalid OTP. Use 123456 for testing.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payouts & Banking</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Earnings Summary Card */}
                <View style={styles.earningsCard}>
                    <Text style={styles.earningsCardTitle}>EARNINGS OVERVIEW</Text>

                    <View style={styles.earningsMainRow}>
                        <View style={styles.earningsMainBox}>
                            <Text style={styles.earningsMainLabel}>Today</Text>
                            <Text style={styles.earningsMainValue}>
                                {loading ? '...' : formatCurrency(earnings.today)}
                            </Text>
                            <Text style={styles.earningsSubtext}>
                                {loading ? '' : `${earnings.todayOrders} orders`}
                            </Text>
                        </View>
                        <View style={styles.earningsDivider} />
                        <View style={styles.earningsMainBox}>
                            <Text style={styles.earningsMainLabel}>This Week</Text>
                            <Text style={styles.earningsMainValue}>
                                {loading ? '...' : formatCurrency(earnings.weekly)}
                            </Text>
                            <Text style={styles.earningsSubtext}>completed</Text>
                        </View>
                    </View>

                    <View style={styles.earningsFooter}>
                        <View style={styles.earningsFooterBox}>
                            <Text style={styles.earningsFooterLabel}>TOTAL EARNINGS</Text>
                            <Text style={styles.earningsFooterValue}>
                                {loading ? '...' : formatCurrency(earnings.total)}
                            </Text>
                        </View>
                        <View style={[styles.earningsFooterBox, { marginLeft: 12 }]}>
                            <Text style={styles.earningsFooterLabel}>ALL-TIME ORDERS</Text>
                            <Text style={styles.earningsFooterValue}>
                                {loading ? '...' : `${earnings.orderCount}`}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Payout Info Note */}
                <View style={styles.payoutNote}>
                    <Ionicons name="time-outline" size={18} color="#6B7280" />
                    <Text style={styles.payoutNoteText}>
                        Payouts are processed automatically. Contact support for payout schedule details.
                    </Text>
                </View>

                <Text style={styles.sectionTitle}>Linked Bank Account</Text>

                {bankDetails.isSet ? (
                    <View style={[styles.bankCard, bankDetails.isVerified && { borderColor: '#10B981' }]}>
                        <View style={styles.bankHeader}>
                            <View style={styles.bankIcon}>
                                <MaterialCommunityIcons name="bank-outline" size={24} color="#4B5563" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.bankName}>{bankDetails.bankName}</Text>
                                <Text style={styles.accountNumber}>{bankDetails.accountNumber}</Text>
                            </View>
                            {bankDetails.isVerified && (
                                <View style={styles.verifiedBadge}>
                                    <Text style={styles.verifiedText}>PRIMARY</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.bankDetailsRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>IFSC Code</Text>
                                <Text style={styles.detailValue}>{bankDetails.ifsc}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>Beneficiary</Text>
                                <Text style={styles.detailValue}>{bankDetails.beneficiary}</Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.emptyBankCard}>
                        <View style={styles.emptyBankIconCircle}>
                            <MaterialCommunityIcons name="bank-plus" size={32} color="#9CA3AF" />
                        </View>
                        <Text style={styles.emptyBankTitle}>No Bank Account Added</Text>
                        <Text style={styles.emptyBankText}>Add a bank account to receive your payouts automatically.</Text>
                    </View>
                )}

                <TouchableOpacity style={styles.changeButton} onPress={() => setModalVisible(true)}>
                    <Ionicons name={bankDetails.isSet ? "card-outline" : "add-circle-outline"} size={20} color="#374151" style={{ marginRight: 8 }} />
                    <Text style={styles.changeButtonText}>{bankDetails.isSet ? "Change Bank Account" : "Add Bank Account"}</Text>
                </TouchableOpacity>

                <View style={styles.infoNote}>
                    <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
                    <Text style={styles.infoNoteText}>
                        For security, we will send an OTP to your registered mobile number to verify your identity before adding or changing bank details.
                    </Text>
                </View>

            </ScrollView>

            <BottomModal
                visible={modalVisible}
                onClose={() => { setModalVisible(false); setStep(1); }}
                title={step === 1 ? (bankDetails.isSet ? "Change Bank Account" : "Add Bank Account") : "Verify OTP"}
            >
                {step === 1 ? (
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Bank Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. HDFC Bank"
                                value={newBank.name}
                                onChangeText={t => setNewBank({ ...newBank, name: t })}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Account Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter account number"
                                keyboardType="numeric"
                                value={newBank.account}
                                onChangeText={t => setNewBank({ ...newBank, account: t })}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>IFSC Code</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="E.G. HDFC0001234"
                                autoCapitalize="characters"
                                value={newBank.ifsc}
                                onChangeText={t => setNewBank({ ...newBank, ifsc: t })}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Beneficiary Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="As per bank records"
                                value={newBank.beneficiary}
                                onChangeText={t => setNewBank({ ...newBank, beneficiary: t })}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSave} onPress={handleRequestOtp}>
                                <Text style={styles.modalSaveText}>Continue</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.form}>
                        <Text style={styles.otpDesc}>
                            Enter the 6-digit verification code sent to your registered mobile number by PickAtStore.
                        </Text>

                        <View style={styles.inputGroup}>
                            <TextInput
                                style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 24 }]}
                                placeholder="000000"
                                keyboardType="number-pad"
                                maxLength={6}
                                value={otp}
                                onChangeText={setOtp}
                                autoFocus
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setStep(1)}>
                                <Text style={styles.modalCancelText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSave} onPress={handleVerifyOtp}>
                                <Text style={styles.modalSaveText}>Verify & Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </BottomModal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
    content: { padding: 16 },

    // Earnings Card
    earningsCard: { backgroundColor: Colors.text, borderRadius: 20, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    earningsCardTitle: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 20 },
    earningsMainRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    earningsMainBox: { flex: 1, alignItems: 'center' },
    earningsDivider: { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.15)' },
    earningsMainLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', marginBottom: 4 },
    earningsMainValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    earningsSubtext: { color: '#6B7280', fontSize: 11, marginTop: 2 },
    earningsFooter: { flexDirection: 'row' },
    earningsFooterBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 12 },
    earningsFooterLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
    earningsFooterValue: { color: '#fff', fontSize: 16, fontWeight: '600' },

    // Payout Note
    payoutNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, marginBottom: 24, gap: 10 },
    payoutNoteText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 18 },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },

    bankCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
    bankHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    bankIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: Colors.border },
    bankName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    accountNumber: { fontSize: 14, color: '#9CA3AF', marginTop: 2, letterSpacing: 1 },
    verifiedBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, position: 'absolute', right: 0, top: -4 },
    verifiedText: { color: Colors.white, fontSize: 10, fontWeight: 'bold' },

    // Empty Bank State
    emptyBankCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', marginBottom: 20 },
    emptyBankIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    emptyBankTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
    emptyBankText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },


    divider: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
    bankDetailsRow: { flexDirection: 'row' },
    detailLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4, fontWeight: '600' },
    detailValue: { fontSize: 14, color: '#374151' },

    changeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 },
    changeButtonText: { color: '#374151', fontSize: 16, fontWeight: 'bold' },

    otpDesc: { fontSize: 14, color: '#9CA3AF', marginBottom: 16, textAlign: 'center', lineHeight: 20 },

    infoNote: { flexDirection: 'row', gap: 12, paddingHorizontal: 4 },
    infoNoteText: { flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 18 },

    form: { gap: 16, paddingBottom: 20 },
    inputGroup: {},
    inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 16, color: Colors.text },

    modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
    modalCancel: { flex: 1, padding: 16, backgroundColor: Colors.background, borderRadius: 12, alignItems: 'center' },
    modalCancelText: { fontWeight: '700', color: '#374151', fontSize: 16 },
    modalSave: { flex: 1, padding: 16, backgroundColor: Colors.text, borderRadius: 12, alignItems: 'center' },
    modalSaveText: { fontWeight: '700', color: Colors.white, fontSize: 16 },
});
