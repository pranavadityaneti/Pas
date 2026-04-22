import React, { useState, useRef, useEffect } from 'react';
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

const getApiUrl = () => {
    return process.env.EXPO_PUBLIC_API_URL;
};

const fetchWithTimeout = async (resource: RequestInfo | string, options: RequestInit & { timeout?: number } = {}) => {
    const { timeout = 15000, ...fetchOptions } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...fetchOptions, signal: controller.signal as any });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') throw new Error('Network timeout.');
        throw error;
    }
};

type AuthMode = 'phone-input' | 'phone-otp';

export default function LoginScreen() {
    const [mode, setMode] = useState<AuthMode>('phone-input');
    const [loading, setLoading] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [multiRoles, setMultiRoles] = useState<any[]>([]);

    // Phone OTP state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef<(TextInput | null)[]>([]);

    const { refreshStore } = useStore();

    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    const handleSendOtp = async () => {
        const cleaned = phoneNumber.replace(/\s/g, '');
        if (cleaned.length !== 10) {
            Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: `91${cleaned}`, isLogin: true })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to send OTP');

            setMode('phone-otp');
            setResendTimer(60);
            setOtpValues(['', '', '', '', '', '']);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otp = otpValues.join('');
        if (otp.length !== 6) {
            Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
            return;
        }

        const cleaned = phoneNumber.replace(/\s/g, '');
        setLoading(true);

        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: `91${cleaned}`, otp })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'OTP verification failed');

            // Set Supabase Session
            await setSessionFromTokens(data.session.access_token, data.session.refresh_token);

            // AGGREGATED ROLE DISCOVERY (Owners + Branch Managers)
            // Safe phone parsing: extract exactly the last 10 digits
            let userPhone = data.user?.phone || '';
            if (!userPhone && data.user?.email?.includes('@phone.pickatstore.app')) {
                userPhone = data.user.email.split('@')[0];
            }
            const rawPhone = userPhone.replace(/\D/g, '').slice(-10);
            const phoneQuery = `phone.eq.${rawPhone},phone.eq.91${rawPhone},phone.eq.+91${rawPhone}`;

            const availableRoles: Array<any> = [];
            const seenIds = new Set<string>();

            // Step A: Owner lookup
            const { data: owners } = await supabase
                .from('merchants')
                .select('id, store_name, status, kyc_status')
                .or(phoneQuery);

            if (owners && owners.length > 0) {
                owners.forEach((owner: any) => {
                    availableRoles.push({ type: 'owner', id: owner.id, name: owner.store_name || data.user.email, status: owner.status, kyc_status: owner.kyc_status, merchantId: owner.id });
                    seenIds.add(`owner-${owner.id}`);
                });
            }

            // Step B: Explicit manager lookup
            const { data: managedBranches } = await supabase
                .from('merchant_branches')
                .select('id, branch_name, merchant_id')
                .or(phoneQuery);

            if (managedBranches && managedBranches.length > 0) {
                managedBranches.forEach((b: any) => {
                    availableRoles.push({ type: 'manager', id: b.id, name: b.branch_name, storeId: b.merchant_id, merchantId: b.merchant_id });
                    seenIds.add(`manager-${b.id}`);
                });
            }

            // Step C: Owner's branch impersonation — show all branches they own
            if (owners && owners.length > 0) {
                const ownerIds = owners.map((o: any) => o.id);
                const { data: ownedBranches } = await supabase
                    .from('merchant_branches')
                    .select('id, branch_name, merchant_id')
                    .in('merchant_id', ownerIds);

                if (ownedBranches && ownedBranches.length > 0) {
                    ownedBranches.forEach((b: any) => {
                        if (!seenIds.has(`manager-${b.id}`)) {
                            availableRoles.push({ type: 'manager', id: b.id, name: b.branch_name, storeId: b.merchant_id, merchantId: b.merchant_id });
                            seenIds.add(`manager-${b.id}`);
                        }
                    });
                }
            }

            if (availableRoles.length === 0) {
                Alert.alert('Access Denied', 'No owner or branch roles found for this account.');
                await supabase.auth.signOut();
                return;
            }

            if (availableRoles.length === 1) {
                await AsyncStorage.setItem('active_role', JSON.stringify(availableRoles[0]));
                if (refreshStore) {
                    await refreshStore();
                }
                // Add the same buffer here to prevent the Auth Guard race condition
                setTimeout(() => {
                    router.replace('/');
                }, 600);
                return;
            } else {
                setMultiRoles(availableRoles);
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

    const handleOtpChange = (text: string, index: number) => {
        const newValues = [...otpValues];
        newValues[index] = text;
        setOtpValues(newValues);
        if (text && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otpValues[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleSelectRole = async (role: any) => {
        console.log('\n=== ROLE SELECTION ===');
        console.log('1. User tapped:', role.name);
        
        await AsyncStorage.setItem('active_role', JSON.stringify(role));
        setShowRoleModal(false);
        
        if (refreshStore) {
            console.log('2. Triggering Context Refresh...');
            await refreshStore();
        }

        // Use a slightly longer buffer and the EXPLICIT group route
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
                                {resendTimer > 0 ? (
                                    <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
                                ) : (
                                    <TouchableOpacity onPress={handleSendOtp}>
                                        <Text style={styles.resendText}>Resend OTP</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.otpContainer}>
                                {otpValues.map((val, i) => (
                                    <TextInput
                                        key={i}
                                        ref={ref => { otpRefs.current[i] = ref; }}
                                        style={[styles.otpInput, val ? styles.otpInputActive : null]}
                                        maxLength={1}
                                        keyboardType="number-pad"
                                        value={val}
                                        onChangeText={(text) => handleOtpChange(text, i)}
                                        onKeyPress={(e) => handleOtpKeyPress(e, i)}
                                    />
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.button, (loading || otpValues.join('').length !== 6) && styles.buttonDisabled]}
                                onPress={handleVerifyOtp}
                                disabled={loading || otpValues.join('').length !== 6}
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

                {/* Role Selection Modal */}
                <Modal visible={showRoleModal} transparent={true} animationType="slide">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
                            <View style={{ width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
                            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 20 }}>Select Account</Text>
                            {multiRoles.map((role, index) => (
                                <TouchableOpacity key={index} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }} onPress={() => handleSelectRole(role)}>
                                    <Text style={{ fontSize: 24, marginRight: 16 }}>{role.type === 'owner' ? '👑' : '🏪'}</Text>
                                    <View>
                                        <Text style={{ fontSize: 16, fontWeight: '600' }}>{role.name}</Text>
                                        <Text style={{ fontSize: 14, color: '#666' }}>{role.type === 'owner' ? 'Store Owner' : 'Branch Manager'}</Text>
                                    </View>
                                </TouchableOpacity>
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
