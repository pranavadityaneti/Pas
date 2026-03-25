// @lock — Do NOT overwrite. Approved layout as of Mar 12, 2026.
// Auth Screen: Bottom-sheet auth with Phone OTP (Wati) + Email fallback.
// Replaces previous full-page email/password auth.

import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
    Platform, ActivityIndicator, Alert, Image, Dimensions, Animated,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { supabase, setSessionFromTokens } from '../lib/supabase';
import { Phone, ArrowLeft, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Backend API URL — using environment variables with local fallback
const getApiUrl = () => {
    // In development, the API runs locally (can be overridden via EXPO_PUBLIC_API_URL in .env)
    // In production, it should be the deployed server URL
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }
    return __DEV__
        ? 'http://192.168.29.184:3000' // Fallback to current local device IP
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
        if (error.name === 'AbortError') {
            throw new Error('Network request timed out. Please check your connection.');
        }
        throw error;
    }
};

type AuthMode = 'choose' | 'phone-input' | 'phone-otp';

export default function AuthScreen() {
    const navigation = useNavigation<any>();

    // Auth mode state
    const [mode, setMode] = useState<AuthMode>('choose');
    const [isLoading, setIsLoading] = useState(false);

    // Phone OTP state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef<(TextInput | null)[]>([]);


    // Bottom sheet animation
    const slideAnim = useRef(new Animated.Value(0)).current;
    const [sheetVisible, setSheetVisible] = useState(true);

    useEffect(() => {
        if (sheetVisible) {
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 65,
                friction: 11
            }).start();
        }
    }, [sheetVisible]);

    // Resend timer countdown
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    const haptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
        Haptics.impactAsync(style);
    };

    // ==================== PHONE OTP FLOW ====================

    const handleSendOtp = async () => {
        const cleaned = phoneNumber.replace(/\s/g, '');
        if (cleaned.length !== 10) {
            haptic();
            Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
            return;
        }

        setIsLoading(true);
        haptic(Haptics.ImpactFeedbackStyle.Light);

        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: `91${cleaned}` })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send OTP');
            }

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
            haptic();
            Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
            return;
        }

        const cleaned = phoneNumber.replace(/\s/g, '');
        setIsLoading(true);
        haptic(Haptics.ImpactFeedbackStyle.Light);

        try {
            console.log(`Sending verify-otp to: ${getApiUrl()}/auth/verify-otp`);
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: `91${cleaned}`, otp })
            });
            console.log('Received response from API');

            const data = await response.json();
            console.log('Parsed JSON data:', typeof data);

            if (!response.ok) {
                console.log('Response not OK, throwing error');
                throw new Error(data.error || 'OTP verification failed');
            }

            console.log(`Setting async storage for new user: ${data.isNewUser}`);
            // Navigate based on whether user is new
            // MUST be set BEFORE session is created to prevent RootNavigator race condition
            if (data.isNewUser) {
                await SecureStore.setItemAsync('pending_profile_setup', 'true');
            }

            console.log(`Setting Supabase Session using tokens...`);
            // Set Supabase session from server-returned tokens
            await setSessionFromTokens(
                data.session.access_token,
                data.session.refresh_token
            );
            console.log(`Supabase Session Set successfully`);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            console.log(`Finished handleVerifyOtp`);

            // RootNavigator will handle the routing via the session listener
            // If existing user, RootNavigator will auto-route to Main via session change
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

        // Auto-advance to next field
        if (text && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otpValues[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleResendOtp = () => {
        if (resendTimer > 0) return;
        handleSendOtp();
     };

    const goBack = () => {
        haptic(Haptics.ImpactFeedbackStyle.Light);
        if (mode === 'phone-otp') setMode('phone-input');
        else if (mode === 'phone-input') setMode('choose');
    };

    // ==================== RENDER HELPERS ====================

    const renderChooseMode = () => (
        <View>
            <View className="items-center mb-2">
                <View className="w-12 h-12 rounded-2xl bg-black items-center justify-center mb-4">
                    <Text className="text-white text-xl">✦</Text>
                </View>
                <Text className="text-2xl font-bold text-[#B52725] mb-1">Get Started</Text>
                <Text className="text-gray-400 text-center text-sm font-medium leading-relaxed px-4">
                    Order from your favourite local stores,{'\n'}delivered to your doorstep.
                </Text>
            </View>

            {/* Continue with Phone — Primary */}
            <TouchableOpacity
                onPress={() => { haptic(); setMode('phone-input'); }}
                className="bg-[#B52725] h-14 rounded-2xl items-center justify-center flex-row mt-6"
            >
                <Phone size={18} color="#FFF" />
                <Text className="text-white font-bold text-[15px] ml-3">Continue with Phone</Text>
            </TouchableOpacity>


            {/* Guest Access */}
            <TouchableOpacity
                className="items-center mt-6 mb-2"
                onPress={() => { haptic(Haptics.ImpactFeedbackStyle.Light); navigation.replace('Main' as any); }}
            >
                <Text className="text-gray-400 font-bold text-sm">Continue As Guest</Text>
            </TouchableOpacity>
        </View>
    );

    const renderPhoneInput = () => (
        <View>
            <TouchableOpacity onPress={goBack} className="mb-4 flex-row items-center">
                <ArrowLeft size={18} color="#B52725" />
                <Text className="ml-2 font-bold text-gray-600 text-sm">Back</Text>
            </TouchableOpacity>

            <Text className="text-xl font-bold text-[#B52725] mb-1">Enter Phone Number</Text>
            <Text className="text-gray-400 text-sm font-medium mb-6">
                We'll send a verification code via WhatsApp
            </Text>

            {/* Phone Input */}
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

            {/* WhatsApp indicator */}
            <View className="flex-row items-center mt-3 ml-1">
                <MessageCircle size={14} color="#25D366" />
                <Text className="text-xs text-gray-400 font-medium ml-1.5">OTP will be sent via WhatsApp</Text>
            </View>

            <TouchableOpacity
                onPress={handleSendOtp}
                disabled={isLoading || phoneNumber.replace(/\s/g, '').length !== 10}
                className={`mt-6 h-14 rounded-2xl items-center justify-center ${
                    isLoading || phoneNumber.replace(/\s/g, '').length !== 10
                        ? 'bg-gray-300'
                        : 'bg-[#B52725]'
                }`}
            >
                {isLoading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className="text-white font-bold text-[15px]">Send OTP</Text>
                )}
            </TouchableOpacity>
        </View>
    );

    const renderPhoneOtp = () => (
        <View>
            <TouchableOpacity onPress={goBack} className="mb-4 flex-row items-center">
                <ArrowLeft size={18} color="#B52725" />
                <Text className="ml-2 font-bold text-gray-600 text-sm">Back</Text>
            </TouchableOpacity>

            <Text className="text-xl font-bold text-[#B52725] mb-1">Verify OTP</Text>
            <Text className="text-gray-400 text-sm font-medium mb-6">
                Enter the 6-digit code sent to{' '}
                <Text className="text-[#B52725] font-bold">+91 {phoneNumber}</Text>
            </Text>

            {/* OTP Input Boxes */}
            <View className="flex-row justify-between mb-6">
                {otpValues.map((val, i) => (
                    <TextInput
                        key={i}
                        ref={ref => { otpRefs.current[i] = ref; }}
                        className={`w-12 h-14 rounded-2xl text-center text-xl font-bold border-2 ${
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

            {/* Resend Timer */}
            <View className="items-center mb-6">
                {resendTimer > 0 ? (
                    <Text className="text-gray-400 font-medium text-sm">
                        Resend in <Text className="font-bold text-[#B52725]">{resendTimer}s</Text>
                    </Text>
                ) : (
                    <TouchableOpacity onPress={handleResendOtp}>
                        <Text className="text-[#B52725] font-bold text-sm underline">Resend OTP</Text>
                    </TouchableOpacity>
                )}
            </View>

            <TouchableOpacity
                onPress={handleVerifyOtp}
                disabled={isLoading || otpValues.join('').length !== 6}
                className={`h-14 rounded-2xl items-center justify-center ${
                    isLoading || otpValues.join('').length !== 6
                        ? 'bg-gray-300'
                        : 'bg-[#B52725]'
                }`}
            >
                {isLoading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className="text-white font-bold text-[15px]">Verify & Continue</Text>
                )}
            </TouchableOpacity>
        </View>
    );


    const getCurrentContent = () => {
        switch (mode) {
            case 'choose': return renderChooseMode();
            case 'phone-input': return renderPhoneInput();
            case 'phone-otp': return renderPhoneOtp();
            case 'phone-otp': return renderPhoneOtp();
        }
    };

    const sheetTranslateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [400, 0]
    });

    return (
        <View className="flex-1 bg-black">
            {/* Absolute Background Elements */}
            <Image
                source={require('../../assets/images/auth-bg.png')}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                resizeMode="cover"
            />
            {/* Dark Overlay for readability */}
            <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)' }} />

            {/* Primary Interactive Layer */}
            <KeyboardAvoidingView
                behavior="padding"
                className="flex-1"
            >
                {/* Logo Section - Flex-1 pushes the bottom sheet to the very bottom naturally */}
                <View className="flex-1 items-center justify-center">
                    <Image
                        source={require('../../assets/brand/logo_horizontal.png')}
                        style={{ width: 220, height: 100, tintColor: 'white' }}
                        resizeMode="contain"
                    />
                </View>

                {/* Bottom Sheet Modal - Standard Document Flow */}
                <Animated.View
                    style={{
                        transform: [{ translateY: sheetTranslateY }],
                    }}
                >
                    <View
                        className="bg-white rounded-t-[32px] px-8 pt-8 pb-10"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -4 },
                            shadowOpacity: 0.08,
                            shadowRadius: 20,
                            elevation: 20,
                        }}
                    >
                        {/* Drag Handle */}
                        <View className="items-center mb-4">
                            <View className="w-10 h-1 bg-gray-200 rounded-full" />
                        </View>

                        {getCurrentContent()}
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
        </View>
    );
}
