import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Platform, ActivityIndicator, Alert, Image, Modal
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase, setSessionFromTokens } from '../../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { useStore } from '../../src/context/StoreContext';
import { useOtpPad } from '../../src/hooks/useOtpPad';
import { useSendVerifyOtp } from '../../src/hooks/useSendVerifyOtp';

// 2026-06-04 (Phase 1.4.C): local getApiUrl + fetchWithTimeout helpers
// removed — OTP send/verify now uses the shared useSendVerifyOtp primitive
// (apps/merchant-app/src/hooks/useSendVerifyOtp.ts). Per-request OTP timeout
// is 15s (down from this file's prior 30s default) to match signup.tsx.

type AuthMode = 'phone-input' | 'phone-otp';

export default function LoginScreen() {
    const [mode, setMode] = useState<AuthMode>('phone-input');
    const [loading, setLoading] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [multiRoles, setMultiRoles] = useState<any[]>([]);

    // 2026-06-04 (Phase 1.4.C): pad mechanics + send/verify shared with signup
    // via Phase 1.4.A primitives (useOtpPad + useSendVerifyOtp). Login keeps
    // its post-verify role-discovery + multi-context modal inline below.
    const [phoneNumber, setPhoneNumber] = useState('');
    const pad = useOtpPad(6);
    const otp = useSendVerifyOtp('login');

    const { refreshStore } = useStore();

    const handleSendOtp = async () => {
        const cleaned = phoneNumber.replace(/\s/g, '');
        if (cleaned.length !== 10) {
            Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
            return;
        }

        setLoading(true);
        try {
            const result = await otp.sendOtp(`91${cleaned}`);
            if (!result.ok) {
                Alert.alert('Error', result.error || 'Failed to send OTP. Please try again.');
                return;
            }
            setMode('phone-otp');
            pad.reset();
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otpValue = pad.getValue();
        if (otpValue.length !== 6) {
            Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
            return;
        }

        const cleaned = phoneNumber.replace(/\s/g, '');
        setLoading(true);

        try {
            const result = await otp.verifyOtp(`91${cleaned}`, otpValue);
            if (!result.ok) {
                console.error('[Login] Verify OTP Error:', result.error);
                Alert.alert('Verification Failed', result.error || 'Incorrect OTP or network error. Please try again.');
                return;
            }
            const data = result.data;

            // Set Supabase Session
            await setSessionFromTokens(data.session.access_token, data.session.refresh_token);

            // AGGREGATED ROLE DISCOVERY
            let userPhone = data.user?.phone || '';
            if (!userPhone && data.user?.email?.includes('@phone.pickatstore.app')) {
                userPhone = data.user.email.split('@')[0];
            }
            const rawPhone = userPhone.replace(/\D/g, '').slice(-10);
            const phoneQuery = `phone.eq.${rawPhone},phone.eq.91${rawPhone},phone.eq.+91${rawPhone}`;

            const { data: ownerData } = await supabase.from('merchants').select('id, store_name, status, address').or(phoneQuery);
            const { data: managerData } = await supabase.from('merchant_branches').select('id, branch_name, merchant_id, is_active, address').or(phoneQuery);
            const { data: staffRoles } = await supabase.from('store_staff').select('store_id, role').eq('user_id', data.user.id);

            const contextMap = new Map<string, any>();

            if (ownerData) {
                ownerData.forEach((o: any) => {
                    contextMap.set(o.id, {
                        merchantId: o.id,
                        merchantName: o.store_name || 'Main Store',
                        role: 'owner',
                        branches: [{ branchId: o.id, branchName: o.store_name || 'Main Store' }]
                    });
                });
            }

            const addManagerBranch = (merchantId: string, branchId: string, branchName: string, role: string = 'manager') => {
                if (contextMap.has(merchantId)) {
                    const ctx = contextMap.get(merchantId)!;
                    if (role === 'owner') ctx.role = 'owner';
                    if (!ctx.branches.find((b: any) => b.branchId === branchId)) {
                        ctx.branches.push({ branchId, branchName });
                    }
                } else {
                    contextMap.set(merchantId, {
                        merchantId,
                        merchantName: '',
                        role: role,
                        branches: [{ branchId, branchName }]
                    });
                }
            };

            if (managerData) {
                managerData.forEach((b: any) => {
                    const staffRecord = staffRoles?.find((s: any) => s.store_id === b.id);
                    addManagerBranch(b.merchant_id, b.id, b.branch_name, staffRecord?.role);
                });
            }

            if (staffRoles && staffRoles.length > 0) {
                const storeIds = staffRoles.map((s: any) => s.store_id);
                const { data: branchCheck } = await supabase.from('merchant_branches').select('id, branch_name, merchant_id').in('id', storeIds);
                if (branchCheck) {
                    branchCheck.forEach((b: any) => {
                        const staffRecord = staffRoles.find((s: any) => s.store_id === b.id);
                        addManagerBranch(b.merchant_id, b.id, b.branch_name, staffRecord?.role);
                    });
                }
                const { data: mainStoreCheck } = await supabase.from('merchants').select('id, store_name').in('id', storeIds);
                if (mainStoreCheck) {
                    mainStoreCheck.forEach((m: any) => {
                        const staffRecord = staffRoles.find((s: any) => s.store_id === m.id);
                        const role = staffRecord?.role || 'manager';

                        if (contextMap.has(m.id)) {
                             const ctx = contextMap.get(m.id)!;
                             if (role === 'owner') ctx.role = 'owner';
                             if (!ctx.branches.find((b: any) => b.branchId === m.id)) {
                                 ctx.branches.push({ branchId: m.id, branchName: m.store_name || 'Main Store' });
                             }
                        } else {
                             contextMap.set(m.id, {
                                 merchantId: m.id,
                                 merchantName: m.store_name || 'Main Store',
                                 role: role,
                                 branches: [{ branchId: m.id, branchName: m.store_name || 'Main Store' }]
                             });
                        }
                    });
                }
            }

            // Fetch ALL branches for every merchant where the user is an owner
            const ownerMerchantIds = Array.from(contextMap.entries())
                .filter(([_, ctx]) => ctx.role === 'owner')
                .map(([id]) => id);
            if (ownerData) {
                ownerData.forEach((o: any) => {
                    if (!ownerMerchantIds.includes(o.id)) ownerMerchantIds.push(o.id);
                });
            }
            if (ownerMerchantIds.length > 0) {
                 const { data: ownedBranches } = await supabase.from('merchant_branches').select('id, branch_name, merchant_id').in('merchant_id', ownerMerchantIds);
                 if (ownedBranches) {
                     ownedBranches.forEach((b: any) => {
                          const ctx = contextMap.get(b.merchant_id);
                          if (ctx && !ctx.branches.find((x: any) => x.branchId === b.id)) {
                              ctx.branches.push({ branchId: b.id, branchName: b.branch_name });
                          }
                     });
                 }
            }

            const contextsWithoutName = Array.from(contextMap.values()).filter(c => !c.merchantName);
            if (contextsWithoutName.length > 0) {
                 const missingIds = contextsWithoutName.map(c => c.merchantId);
                 const { data: missingMerchants } = await supabase.from('merchants').select('id, store_name').in('id', missingIds);
                 if (missingMerchants) {
                     missingMerchants.forEach((m: any) => {
                         const ctx = contextMap.get(m.id);
                         if (ctx) ctx.merchantName = m.store_name || 'Main Store';
                     });
                 }
            }

            const discoveredContexts = Array.from(contextMap.values());

            if (discoveredContexts.length === 0) {
                Alert.alert('Access Denied', 'No owner or branch roles found for this account.');
                await supabase.auth.signOut();
                return;
            }

            if (discoveredContexts.length === 1) {
                await AsyncStorage.setItem('active_context', JSON.stringify(discoveredContexts[0]));
                if (refreshStore) {
                    await refreshStore();
                }
                setTimeout(() => {
                    router.replace('/');
                }, 600);
                return;
            } else {
                setMultiRoles(discoveredContexts);
                setShowRoleModal(true);
            }

            return;
        } catch (error: any) {
            console.error('[Login] Verify OTP Error:', error);
            Alert.alert('Verification Failed', error.message || 'Incorrect OTP or network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectBranch = async (context: any, branchId: string) => {
        console.log('\n=== BRANCH SELECTION ===');
        console.log('1. User tapped:', context.merchantName, 'branch:', branchId);

        await AsyncStorage.setItem('active_context', JSON.stringify(context));
        await AsyncStorage.setItem('active_branch_id', branchId);
        setShowRoleModal(false);

        if (refreshStore) {
            console.log('2. Triggering Context Refresh...');
            await refreshStore();
        }

        setTimeout(() => {
            console.log('3. Executing route to /');
            router.replace('/');
        }, 800);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* @ts-ignore: Library type definition missing children prop */}
            <KeyboardAwareScrollView
                contentContainerStyle={styles.scrollContent}
                enableOnAndroid={true}
                extraScrollHeight={100}
                enableAutomaticScroll={true}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
                {mode === 'phone-otp' && (
                    <TouchableOpacity onPress={() => setMode('phone-input')} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.primary} />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.logoContainer}>
                    <View style={styles.logoBox}>
                        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
                    </View>
                    <Text style={styles.title}>Partner Portal</Text>
                    <Text style={styles.subtitle}>Manage your store, orders, and inventory</Text>
                </View>

                <View style={styles.formContainer}>
                    {mode === 'phone-input' ? (
                        <>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>WhatsApp Number</Text>
                                <View style={styles.phoneInputBox}>
                                    <Text style={styles.countryCode}>+91</Text>
                                    <View style={styles.verticalLine} />
                                    <TextInput
                                        style={styles.inputPhone}
                                        placeholder="Phone Number"
                                        placeholderTextColor="#9CA3AF"
                                        value={phoneNumber}
                                        onChangeText={setPhoneNumber}
                                        keyboardType="phone-pad"
                                        maxLength={10}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.button, (loading || phoneNumber.length !== 10) && styles.buttonDisabled]}
                                onPress={handleSendOtp}
                                disabled={loading || phoneNumber.length !== 10}
                            >
                                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send OTP</Text>}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={styles.otpHeader}>
                                <Text style={styles.label}>Enter 6-digit OTP</Text>
                                {otp.resendTimer > 0 ? (
                                    <Text style={styles.timerText}>Resend in {otp.resendTimer}s</Text>
                                ) : (
                                    <TouchableOpacity onPress={handleSendOtp}>
                                        <Text style={styles.resendText}>Resend OTP</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.otpContainer}>
                                {pad.values.map((val, i) => (
                                    <TextInput
                                        key={i}
                                        ref={ref => { pad.refs.current[i] = ref; }}
                                        style={[styles.otpInput, val ? styles.otpInputActive : null]}
                                        maxLength={1}
                                        keyboardType="number-pad"
                                        value={val}
                                        onChangeText={(text) => pad.onChange(text, i)}
                                        onKeyPress={(e) => pad.onKeyPress(e, i)}
                                    />
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.button, (loading || pad.getValue().length !== 6) && styles.buttonDisabled]}
                                onPress={handleVerifyOtp}
                                disabled={loading || pad.getValue().length !== 6}
                            >
                                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify & Login</Text>}
                            </TouchableOpacity>
                        </>
                    )}

                    {mode === 'phone-input' && (
                        <>
                            <View style={styles.divider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>New to Pick At Store?</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            <TouchableOpacity
                                style={styles.signupButton}
                                onPress={() => router.push('/(auth)/signup')}
                            >
                                <Text style={styles.signupButtonText}>Apply as Partner</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <Text style={styles.footer}>Protected by Pick At Store Secure Gateway</Text>

                {/* Context Selection Modal — shows individual branches */}
                <Modal visible={showRoleModal} transparent={true} animationType="slide">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '70%' }}>
                            <View style={{ width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
                            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 20 }}>Select Store</Text>
                            {multiRoles.map((context, ctxIndex) => (
                                <View key={ctxIndex} style={{ marginBottom: 16 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                                        {context.merchantName} {context.role === 'owner' ? '· Owner' : '· Manager'}
                                    </Text>
                                    {context.branches.map((branch: any, bIndex: number) => (
                                        <TouchableOpacity
                                            key={branch.branchId}
                                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: bIndex < context.branches.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
                                            onPress={() => handleSelectBranch(context, branch.branchId)}
                                        >
                                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                                <Ionicons name="storefront-outline" size={18} color="#374151" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>{branch.branchName}</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                        </View>
                    </View>
                </Modal>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
        paddingBottom: 40,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    backButtonText: {
        color: Colors.primary,
        fontWeight: 'bold',
        marginLeft: 8,
        fontSize: 16,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoBox: {
        marginBottom: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    formContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    phoneInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        height: 48,
        backgroundColor: '#FFFFFF',
    },
    countryCode: {
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
    },
    verticalLine: {
        width: 1,
        height: 24,
        backgroundColor: '#E5E7EB',
    },
    inputPhone: {
        flex: 1,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#111827',
        fontWeight: 'bold',
    },
    otpHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    resendText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    timerText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '500',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    otpInput: {
        width: 44,
        height: 52,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        backgroundColor: '#F9FAFB',
    },
    otpInputActive: {
        borderColor: Colors.primary,
        backgroundColor: '#FFFFFF',
    },
    button: {
        height: 52,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    dividerText: {
        paddingHorizontal: 16,
        color: '#6B7280',
        fontSize: 14,
    },
    signupButton: {
        height: 48,
        borderWidth: 1,
        borderColor: Colors.primary + '30',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.primary + '08',
    },
    signupButtonText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 24,
    },
    logo: {
        width: 120,
        height: 120,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
    },
    roleOption: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
    },
    roleOptionText: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '600',
    },
    closeModalButton: {
        marginTop: 16,
        paddingVertical: 12,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeModalButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
