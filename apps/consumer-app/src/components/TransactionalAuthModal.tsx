import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Modal, Pressable,
    Platform, KeyboardAvoidingView, ScrollView
} from 'react-native';
import { Phone, ArrowLeft, MessageCircle, X } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { setSessionFromTokens } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

interface TransactionalAuthModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
    subtitle?: string;
}

// Backend API URL — using environment variables with local fallback
const getApiUrl = () => {
    if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
    return __DEV__
        ? 'http://192.168.29.184:3000' 
        : 'http://pas-api-prod.eba-njbp437w.ap-south-1.elasticbeanstalk.com';
};

// Helper to prevent infinite fetch hangs on physical devices
const fetchWithTimeout = async (resource: RequestInfo | string, options: RequestInit & { timeout?: number } = {}) => {
    const { timeout = 15000, ...fetchOptions } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...fetchOptions,
            signal: controller.signal as any
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') throw new Error('Network request timed out. Please check your connection.');
        throw error;
    }
};

export default function TransactionalAuthModal({
    visible,
    onClose,
    onSuccess,
    title = 'Secure Checkout',
    subtitle = 'Login or sign up to complete your purchase.'
}: TransactionalAuthModalProps) {
    const [mode, setMode] = useState<'phone-input' | 'phone-otp'>('phone-input');
    const [isLoading, setIsLoading] = useState(false);

    // Phone OTP state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef<(TextInput | null)[]>([]);

    // Resend timer countdown
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
        Haptics.impactAsync(style);
    };

    const handleSendOtp = async () => {
        const cleaned = phoneNumber.replace(/\s/g, '');
        if (cleaned.length !== 10) {
            triggerHaptic();
            Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
            return;
        }

        setIsLoading(true);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: `91${cleaned}` })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to send OTP');

            setMode('phone-otp');
            setResendTimer(60);
            setOtpValues(['', '', '', '', '', '']);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to send OTP. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otp = otpValues.join('');
        if (otp.length !== 6) {
            triggerHaptic();
            Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
            return;
        }

        const cleaned = phoneNumber.replace(/\s/g, '');
        setIsLoading(true);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: `91${cleaned}`, otp })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'OTP verification failed');

            // 1. Handle New User Setup
            if (data.isNewUser) {
                await SecureStore.setItemAsync('pending_profile_setup', 'true');
            }

            // 2. Set Supabase Session
            await setSessionFromTokens(data.session.access_token, data.session.refresh_token);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSuccess();
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Verification Failed', error.message || 'Incorrect OTP. Please try again.');
        } finally {
            setIsLoading(false);
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
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <Pressable className="flex-1 bg-black/50" onPress={onClose} />
                <View className="bg-white rounded-t-[32px] px-8 pt-8 pb-10 shadow-xl">
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-6">
                        <View>
                            <Text className="text-[22px] font-bold text-gray-900">{title}</Text>
                            <Text className="text-gray-500 mt-1 font-medium">{subtitle}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                        {mode === 'phone-input' ? (
                            <View>
                                <Text className="text-xl font-bold text-[#B52725] mb-1">Enter Phone Number</Text>
                                <Text className="text-gray-400 text-sm font-medium mb-6">
                                    We'll send a verification code via WhatsApp
                                </Text>

                                <View className="flex-row items-center border border-gray-200 rounded-2xl px-4 h-14 bg-gray-50">
                                    <Text className="text-base font-bold text-gray-500 mr-2">+91</Text>
                                    <View className="w-px h-6 bg-gray-200 mr-3" />
                                    <TextInput
                                        className="flex-1 font-bold text-black text-base"
                                        placeholder="Phone Number"
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="phone-pad"
                                        maxLength={10}
                                        value={phoneNumber}
                                        onChangeText={setPhoneNumber}
                                        autoFocus
                                        style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                    />
                                </View>

                                <View className="flex-row items-center mt-3 ml-1 mb-6">
                                    <MessageCircle size={14} color="#25D366" />
                                    <Text className="text-xs text-gray-400 font-medium ml-1.5">OTP will be sent via WhatsApp</Text>
                                </View>

                                <TouchableOpacity
                                    onPress={handleSendOtp}
                                    disabled={isLoading || phoneNumber.replace(/\s/g, '').length !== 10}
                                    className={`h-14 rounded-2xl items-center justify-center shadow-md ${
                                        isLoading || phoneNumber.replace(/\s/g, '').length !== 10 ? 'bg-gray-300' : 'bg-[#B52725]'
                                    }`}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white font-bold text-lg">Send OTP</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <TouchableOpacity onPress={() => setMode('phone-input')} className="mb-4 flex-row items-center">
                                    <ArrowLeft size={18} color="#B52725" />
                                    <Text className="ml-2 font-bold text-gray-600 text-sm">Back</Text>
                                </TouchableOpacity>

                                <Text className="text-xl font-bold text-[#B52725] mb-1">Verify OTP</Text>
                                <Text className="text-gray-400 text-sm font-medium mb-6">
                                    Enter code sent to <Text className="text-[#B52725] font-bold">+91 {phoneNumber}</Text>
                                </Text>

                                <View className="flex-row justify-between mb-6">
                                    {otpValues.map((val, i) => (
                                        <TextInput
                                            key={i}
                                            ref={ref => { otpRefs.current[i] = ref; }}
                                            className={`w-12 h-14 rounded-xl text-center text-xl font-bold border-2 ${
                                                val ? 'border-[#B52725] bg-gray-50' : 'border-gray-200 bg-gray-50'
                                            }`}
                                            maxLength={1}
                                            keyboardType="number-pad"
                                            value={val}
                                            onChangeText={(text) => handleOtpChange(text, i)}
                                            onKeyPress={(e) => handleOtpKeyPress(e, i)}
                                            autoFocus={i === 0}
                                            style={{ color: '#B52725' }}
                                        />
                                    ))}
                                </View>

                                <View className="items-center mb-6">
                                    {resendTimer > 0 ? (
                                        <Text className="text-gray-400 font-medium text-sm">
                                            Resend in <Text className="font-bold text-[#B52725]">{resendTimer}s</Text>
                                        </Text>
                                    ) : (
                                        <TouchableOpacity onPress={handleSendOtp}>
                                            <Text className="text-[#B52725] font-bold text-sm underline">Resend OTP</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <TouchableOpacity
                                    onPress={handleVerifyOtp}
                                    disabled={isLoading || otpValues.join('').length !== 6}
                                    className={`h-14 rounded-2xl items-center justify-center shadow-md ${
                                        isLoading || otpValues.join('').length !== 6 ? 'bg-gray-300' : 'bg-[#111827]'
                                    }`}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white font-bold text-lg">Verify & Continue</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        <View className="items-center mt-6">
                            <Text className="text-gray-400 text-sm">Authentication is handled securely via OTP.</Text>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
