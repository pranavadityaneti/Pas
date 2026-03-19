import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Platform, ActivityIndicator, Alert, Image
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase, setSessionFromTokens } from '../../src/lib/supabase';
import { Colors } from '../../constants/Colors';

const getApiUrl = () => {
    if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
    return __DEV__
        ? 'http://192.168.29.171:3000'
        : 'http://pas-api-prod.eba-njbp437w.ap-south-1.elasticbeanstalk.com';
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

    // Phone OTP state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef<(TextInput | null)[]>([]);

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

            // Fetch merchant status
            const { data: merchant, error: merchantError } = await supabase
                .from('merchants')
                .select('status, kyc_status')
                .eq('id', data.user.id)
                .maybeSingle();

            if (merchantError || !merchant) {
                Alert.alert('Error', 'No merchant record found for this number.');
                await supabase.auth.signOut();
                return;
            }

            if (merchant.kyc_status === 'rejected') {
                Alert.alert('Account Rejected', 'Your application was rejected. Please contact support.');
                await supabase.auth.signOut();
                return;
            }

            if (merchant.status === 'active') {
                router.replace('/(main)/dashboard');
            } else {
                Alert.alert(
                    'Account Under Review',
                    'Your account is pending approval. You will be able to login once an admin approves your request.'
                );
                await supabase.auth.signOut();
            }
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
        width: 220,
        height: 220,
    },
});
