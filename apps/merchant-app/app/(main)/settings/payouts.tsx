import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import BottomModal from '../../../src/components/BottomModal';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../src/lib/supabase';
import { useUser } from '../../../src/context/UserContext';
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';

export default function PayoutsScreen() {
    const { user } = useUser();
    const [modalVisible, setModalVisible] = useState(false);

    // Realtime Bank Details
    const { data: merchants, loading: tableLoading } = useRealtimeTable({
        tableName: 'merchants',
        select: 'bank_account_number, ifsc_code, owner_name',
        filter: user?.id ? `id=eq.${user.id}` : undefined,
        enabled: !!user?.id
    });

    const bankDetails = React.useMemo(() => {
        if (merchants && merchants.length > 0) {
            const data = merchants[0];
            return {
                bankName: 'Verified Bank', // Placeholder as before
                accountNumber: data.bank_account_number ? `**** **** **** ${data.bank_account_number.slice(-4)}` : 'Not Set',
                ifsc: data.ifsc_code || 'Not Set',
                beneficiary: data.owner_name || 'Partner',
                isVerified: !!data.bank_account_number
            };
        }
        return {
            bankName: 'HDFC Bank',
            accountNumber: '**** **** **** ****',
            ifsc: '----------',
            beneficiary: 'Loading...',
            isVerified: false
        };
    }, [merchants]);

    const loading = tableLoading && !merchants.length;

    const [newBank, setNewBank] = useState({ name: '', account: '', ifsc: '', beneficiary: '' });

    // OTP State
    const [step, setStep] = useState(1); // 1: Details, 2: OTP
    const [otp, setOtp] = useState('');

    const handleRequestOtp = () => {
        // Mock OTP send
        setStep(2);
    };

    const handleVerifyOtp = async () => {
        if (otp === '123456') {
            try {
                if (!user?.id) return;

                // Update DB
                const { error } = await supabase
                    .from('merchants')
                    .update({
                        bank_account_number: newBank.account,
                        ifsc_code: newBank.ifsc,
                        owner_name: newBank.beneficiary
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
                <Text style={styles.headerTitle}>Payouts & Bank</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Unsettled Balance Card */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>UNSETTLED BALANCE</Text>
                    <View style={styles.balanceRow}>
                        <Text style={styles.balanceAmount}>₹8,450.00</Text>
                        <Text style={styles.balanceStatus}>pending</Text>
                    </View>

                    <View style={styles.payoutInfoRow}>
                        <View style={styles.payoutInfoBox}>
                            <Text style={styles.infoLabel}>NEXT PAYOUT</Text>
                            <Text style={styles.infoValue}>Tomorrow, 10 AM</Text>
                        </View>
                        <View style={[styles.payoutInfoBox, { marginLeft: 12 }]}>
                            <Text style={styles.infoLabel}>FREQUENCY</Text>
                            <Text style={styles.infoValue}>Daily (T+1)</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Linked Bank Account</Text>

                <View style={styles.bankCard}>
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

                <TouchableOpacity style={styles.changeButton} onPress={() => setModalVisible(true)}>
                    <Ionicons name="card-outline" size={20} color="#374151" style={{ marginRight: 8 }} />
                    <Text style={styles.changeButtonText}>Change Bank Account</Text>
                </TouchableOpacity>

                <View style={styles.infoNote}>
                    <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
                    <Text style={styles.infoNoteText}>Changing bank account requires OTP verification and may pause payouts for 24-48 hours for security verification.</Text>
                </View>

            </ScrollView>

            <BottomModal
                visible={modalVisible}
                onClose={() => { setModalVisible(false); setStep(1); }}
                title={step === 1 ? "Change Bank Account" : "Verify OTP"}
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
                            Enter the 6-digit code sent to your registered mobile number ending in **210.
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

    balanceCard: { backgroundColor: Colors.text, borderRadius: 20, padding: 24, marginBottom: 30, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    balanceLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
    balanceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
    balanceAmount: { color: Colors.white, fontSize: 32, fontWeight: 'bold' },
    balanceStatus: { color: Colors.textSecondary, fontSize: 14, marginLeft: 8 },
    payoutInfoRow: { flexDirection: 'row' },
    payoutInfoBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12 },
    infoLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
    infoValue: { color: Colors.white, fontSize: 14, fontWeight: '600' },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },

    bankCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#10B981', marginBottom: 20 },
    bankHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    bankIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: Colors.border },
    bankName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    accountNumber: { fontSize: 14, color: Colors.textSecondary, marginTop: 2, letterSpacing: 1 },
    verifiedBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, position: 'absolute', right: 0, top: -4 },
    verifiedText: { color: Colors.white, fontSize: 10, fontWeight: 'bold' },

    divider: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
    bankDetailsRow: { flexDirection: 'row' },
    detailLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4, fontWeight: '600' },
    detailValue: { fontSize: 14, color: '#374151' },

    changeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 },
    changeButtonText: { color: '#374151', fontSize: 16, fontWeight: 'bold' },

    otpDesc: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16, textAlign: 'center', lineHeight: 20 },

    infoNote: { flexDirection: 'row', gap: 12, paddingHorizontal: 4 },
    infoNoteText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

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
