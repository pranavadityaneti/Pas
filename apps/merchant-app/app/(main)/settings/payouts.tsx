// @lock — Do NOT overwrite. Approved layout as of March 22, 2026.
import React, { useState, useMemo } from 'react';
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

import { useStoreContext } from '../../../src/context/StoreContext';

function formatCurrency(amount: number) {
    return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface BankAccount {
    id: string;
    bankName: string;
    accountNumber: string;
    displayAccount?: string;
    ifsc: string;
    beneficiary: string;
    isPrimary: boolean;
}

const NAME_REGEX = /^[a-zA-Z\s]*$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_REGEX = /^[0-9]{9,18}$/;

export default function PayoutsScreen() {
    const { user } = useUser();
    const { store } = useStoreContext();
    const targetId = store?.id;
    
    const { stats: earnings, loading: earningsLoading } = useEarnings();
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    // Realtime Bank Details
    const { data: merchants, loading: tableLoading, setData } = useRealtimeTable({
        tableName: 'merchants',
        select: 'bank_account_number, ifsc_code, owner_name, bank_name, bank_beneficiary_name, bank_accounts',
        filter: targetId ? `id.eq.${targetId}` : undefined,
        enabled: !!targetId
    });

    const bankAccountsList = useMemo<BankAccount[]>(() => {
        // Step 1: Mandatory Debug Logs
        console.log("DEBUG_PAYOUT_ID:", targetId);
        console.log("RAW_BANK_DATA:", merchants);

        if (merchants && merchants.length > 0) {
            const data = merchants[0];
            const list: BankAccount[] = [];

            // Step 2: Aggressive Mapping - Check for legacy signup columns first
            if (data.bank_account_number) {
                list.push({
                    id: 'signup-primary',
                    bankName: data.bank_name || 'Primary Account',
                    accountNumber: data.bank_account_number,
                    displayAccount: `**** ${data.bank_account_number.slice(-4)}`,
                    ifsc: data.ifsc_code || '',
                    beneficiary: data.bank_beneficiary_name || data.owner_name || '',
                    isPrimary: true
                });
            }

            // Append any accounts from the JSON array if they exist
            if (Array.isArray(data.bank_accounts)) {
                data.bank_accounts.forEach((acc: any, index: number) => {
                    // avoid duplicating the signup one if it has the same account number
                    if (!list.some(existing => existing.accountNumber === acc.accountNumber)) {
                        list.push({
                            id: acc.id || `acc-${index}`,
                            bankName: acc.bankName || 'Bank',
                            accountNumber: acc.accountNumber,
                            displayAccount: `**** ${acc.accountNumber?.slice(-4)}`,
                            ifsc: acc.ifsc || '',
                            beneficiary: acc.beneficiary || '',
                            isPrimary: !!acc.isPrimary && list.length === 0
                        });
                    }
                });
            }
            return list;
        }
        return [];
    }, [merchants, targetId]);

    const loading = (tableLoading && !merchants.length) || earningsLoading;

    const [newBank, setNewBank] = useState({ name: '', account: '', ifsc: '', beneficiary: '' });
    const [errors, setErrors] = useState({ name: '', account: '', ifsc: '', beneficiary: '' });

    const validate = () => {
        let isValid = true;
        const newErrors = { name: '', account: '', ifsc: '', beneficiary: '' };

        if (!newBank.name.trim()) {
            newErrors.name = 'Bank name is required';
            isValid = false;
        } else if (!NAME_REGEX.test(newBank.name)) {
            newErrors.name = 'Only letters and spaces allowed';
            isValid = false;
        }

        if (!newBank.account.trim()) {
            newErrors.account = 'Account number is required';
            isValid = false;
        } else if (!ACCOUNT_REGEX.test(newBank.account)) {
            newErrors.account = 'Enter 9 to 18 digits';
            isValid = false;
        }

        if (!newBank.ifsc.trim()) {
            newErrors.ifsc = 'IFSC code is required';
            isValid = false;
        } else if (!IFSC_REGEX.test(newBank.ifsc)) {
            newErrors.ifsc = 'Invalid format (e.g. HDFC0001234)';
            isValid = false;
        }

        if (!newBank.beneficiary.trim()) {
            newErrors.beneficiary = 'Beneficiary name is required';
            isValid = false;
        } else if (!NAME_REGEX.test(newBank.beneficiary)) {
            newErrors.beneficiary = 'Only letters and spaces allowed';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleSaveBankDetails = async () => {
        if (!validate()) return;
        Keyboard.dismiss();
        
        try {
            if (!targetId) return;
            setSaving(true);

            // 1. Prepare new account object
            const newAcc = {
                id: Math.random().toString(36).substring(7),
                bankName: newBank.name,
                accountNumber: newBank.account,
                ifsc: newBank.ifsc,
                beneficiary: newBank.beneficiary,
                isPrimary: bankAccountsList.length === 0 // Make primary if first one
            };

            const updatedList = [...bankAccountsList, newAcc];

            // 2. Map back to compatible state
            const primary = updatedList.find((a: BankAccount) => a.isPrimary) || newAcc;

            // 3. Update DB
            const { data: updatedRecord, error } = await supabase
                .from('merchants')
                .update({
                    // Legacy singleton fields (for system compatibility)
                    bank_account_number: primary.accountNumber,
                    ifsc_code: primary.ifsc,
                    bank_name: primary.bankName,
                    bank_beneficiary_name: primary.beneficiary,
                    // New multi-account list
                    bank_accounts: updatedList
                })
                .eq('id', targetId)
                .select()
                .single();

            if (error) throw error;

            // 4. Manually update state to ensure UI reflects changes immediately
            if (updatedRecord) {
                setData([updatedRecord as any]);
            }

            setModalVisible(false);
            setNewBank({ name: '', account: '', ifsc: '', beneficiary: '' });
            Alert.alert('Success', 'Bank account added successfully!');
        } catch (err: any) {
            Alert.alert('Error', 'Failed to add bank account: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSetPrimaryBank = async (accId: string) => {
        try {
            if (!targetId) return;
            setSaving(true);

            const updatedList = bankAccountsList.map((acc: BankAccount) => ({
                ...acc,
                isPrimary: acc.id === accId
            }));

            const primary = updatedList.find((a: BankAccount) => a.isPrimary)!;

            const { data: updatedRecord, error } = await supabase
                .from('merchants')
                .update({
                    bank_account_number: primary.accountNumber,
                    ifsc_code: primary.ifsc,
                    bank_name: primary.bankName,
                    bank_beneficiary_name: primary.beneficiary,
                    bank_accounts: updatedList
                })
                .eq('id', targetId)
                .select()
                .single();

            if (error) throw error;
            if (updatedRecord) {
                setData([updatedRecord as any]);
            }
            Alert.alert('Updated', 'Primary bank account changed successfully.');
        } catch (err: any) {
            Alert.alert('Error', 'Failed to change primary bank: ' + err.message);
        } finally {
            setSaving(false);
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

                <Text style={styles.sectionTitle}>Linked Bank Accounts</Text>

                {bankAccountsList.length > 0 ? (
                    bankAccountsList.map((acc: BankAccount) => (
                        <View key={acc.id} style={[styles.bankCard, acc.isPrimary && { borderColor: '#10B981' }]}>
                            <View style={styles.bankHeader}>
                                <View style={styles.bankIcon}>
                                    <MaterialCommunityIcons name="bank-outline" size={24} color="#4B5563" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.bankName}>{acc.bankName}</Text>
                                    <Text style={styles.accountNumber}>{acc.displayAccount}</Text>
                                </View>
                                {acc.isPrimary && (
                                    <View style={styles.verifiedBadge}>
                                        <Text style={styles.verifiedText}>PRIMARY</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.bankDetailsRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.detailLabel}>IFSC Code</Text>
                                    <Text style={styles.detailValue}>{acc.ifsc}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.detailLabel}>Beneficiary</Text>
                                    <Text style={styles.detailValue}>{acc.beneficiary}</Text>
                                </View>
                            </View>
                            
                            {!acc.isPrimary && (
                                <TouchableOpacity 
                                    style={styles.setPrimaryBtn} 
                                    onPress={() => handleSetPrimaryBank(acc.id)}
                                    disabled={saving}
                                >
                                    <Text style={styles.setPrimaryText}>Set as Primary</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyBankCard}>
                        <View style={styles.emptyBankIconCircle}>
                            <MaterialCommunityIcons name="bank-plus" size={32} color="#9CA3AF" />
                        </View>
                        <Text style={styles.emptyBankTitle}>No Bank Account Added</Text>
                        <Text style={styles.emptyBankText}>Add a bank account to receive your payouts automatically.</Text>
                    </View>
                )}

                {/* Step 3: Restore Add Button conditionally */}
                {bankAccountsList.length === 0 && (
                    <TouchableOpacity style={styles.changeButton} onPress={() => setModalVisible(true)}>
                        <Ionicons name="add-circle-outline" size={20} color="#374151" style={{ marginRight: 8 }} />
                        <Text style={styles.changeButtonText}>Add Bank Account</Text>
                    </TouchableOpacity>
                )}

                {/* Debug info - only if developer check needed */}



            </ScrollView>

            <BottomModal
                visible={modalVisible}
                onClose={() => { setModalVisible(false); }}
                title="Add Bank Account"
            >
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Bank Name</Text>
                        <TextInput
                            style={[styles.input, errors.name && styles.inputError]}
                            placeholder="e.g. HDFC Bank"
                            value={newBank.name}
                            onChangeText={t => {
                                if (NAME_REGEX.test(t)) {
                                    setNewBank({ ...newBank, name: t });
                                    setErrors({ ...errors, name: '' });
                                }
                            }}
                        />
                        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Account Number</Text>
                        <TextInput
                            style={[styles.input, errors.account && styles.inputError]}
                            placeholder="Enter account number"
                            keyboardType="numeric"
                            maxLength={18}
                            value={newBank.account}
                            onChangeText={t => {
                                setNewBank({ ...newBank, account: t.replace(/[^0-9]/g, '') });
                                setErrors({ ...errors, account: '' });
                            }}
                        />
                        {errors.account ? <Text style={styles.errorText}>{errors.account}</Text> : null}
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>IFSC Code</Text>
                        <TextInput
                            style={[styles.input, errors.ifsc && styles.inputError]}
                            placeholder="E.G. HDFC0001234"
                            autoCapitalize="characters"
                            maxLength={11}
                            value={newBank.ifsc}
                            onChangeText={t => {
                                setNewBank({ ...newBank, ifsc: t.toUpperCase() });
                                setErrors({ ...errors, ifsc: '' });
                            }}
                        />
                        {errors.ifsc ? <Text style={styles.errorText}>{errors.ifsc}</Text> : null}
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Beneficiary Name</Text>
                        <TextInput
                            style={[styles.input, errors.beneficiary && styles.inputError]}
                            placeholder="As per bank records"
                            value={newBank.beneficiary}
                            onChangeText={t => {
                                if (NAME_REGEX.test(t)) {
                                    setNewBank({ ...newBank, beneficiary: t });
                                    setErrors({ ...errors, beneficiary: '' });
                                }
                            }}
                        />
                        {errors.beneficiary ? <Text style={styles.errorText}>{errors.beneficiary}</Text> : null}
                    </View>

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.modalSave, saving && { opacity: 0.7 }]} 
                            onPress={handleSaveBankDetails}
                            disabled={saving}
                        >
                            <Text style={styles.modalSaveText}>{saving ? 'Saving...' : 'Save Bank Details'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
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
    setPrimaryBtn: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },
    setPrimaryText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
    inputError: { borderColor: '#EF4444' },
    errorText: { color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4 },
});
