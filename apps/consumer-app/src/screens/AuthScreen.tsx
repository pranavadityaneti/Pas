// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Auth Screen: Phone OTP authentication flow.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, SafeAreaView, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';

import * as Haptics from 'expo-haptics';

export default function AuthScreen() {
    const navigation = useNavigation<any>();

    // UI State
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
        Haptics.impactAsync(style);
    };

    const handleAuth = async () => {
        if (!email || !password) {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Required', 'Please fill in all fields');
            return;
        }

        setIsLoading(true);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

        try {
            if (isLogin) {
                // LOGIN FLOW
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                // SIGN UP FLOW
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (error) throw error;

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (data.session) {
                    Alert.alert('Success', 'Account created successfully!');
                } else {
                    Alert.alert('Verification Required', 'Please check your email to verify your account.');
                }
            }
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Authentication Error', error.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            Alert.alert('Email Required', 'Please enter your email address to reset your password.');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            Alert.alert('Reset Email Sent', 'If an account exists for this email, you will receive a password reset link.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 px-8"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* Brand Logo Header */}
                    <View className="items-center mb-10">
                        <Image
                            source={require('../../assets/brand/logo_horizontal.png')}
                            style={{ width: 180, height: 80 }}
                            resizeMode="contain"
                        />
                        <Text className="text-gray-500 mt-2 text-center font-medium">
                            {isLogin ? 'Welcome back! Please enter your details.' : 'Create an account to start ordering.'}
                        </Text>
                    </View>

                    {/* Form Fields */}
                    <View className="space-y-4">
                        <View className="flex-row items-center border border-gray-200 rounded-full px-4 h-14 bg-gray-50">
                            <Mail color="#9CA3AF" size={20} />
                            <TextInput
                                className="flex-1 ml-3 font-medium text-black text-base"
                                placeholder="Email"
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                value={email}
                                onChangeText={setEmail}
                                style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                            />
                        </View>

                        <View className="flex-row items-center border border-gray-200 rounded-full px-4 h-14 bg-gray-50 mt-4">
                            <Lock color="#9CA3AF" size={20} />
                            <TextInput
                                className="flex-1 ml-3 font-medium text-black text-base"
                                placeholder="Password"
                                placeholderTextColor="#9CA3AF"
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                                style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2 -mr-2">
                                {showPassword ? <EyeOff color="#9CA3AF" size={20} /> : <Eye color="#9CA3AF" size={20} />}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Forgot Password Link */}
                    {isLogin && (
                        <TouchableOpacity className="items-center mt-6" onPress={handleForgotPassword}>
                            <Text className="font-bold text-gray-600 underline">Forgot Password?</Text>
                        </TouchableOpacity>
                    )}

                    {/* Action Button */}
                    <TouchableOpacity
                        onPress={handleAuth}
                        disabled={isLoading}
                        className={`mt-8 h-14 rounded-full items-center justify-center shadow-lg ${isLoading ? 'bg-[#982220]' : 'bg-[#B52725]'}`}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg">{isLogin ? 'Login' : 'Sign Up'}</Text>
                        )}
                    </TouchableOpacity>

                    {/* Guest Access */}
                    <TouchableOpacity
                        className="flex-row items-center justify-center bg-gray-50 border border-gray-200 h-14 rounded-full mt-6"
                        onPress={() => navigation.replace('Main' as any)}
                    >
                        <Text className="font-bold text-gray-500">Continue As Guest</Text>
                    </TouchableOpacity>

                    {/* Toggle Mode */}
                    <View className="flex-row justify-center mt-10 mb-8">
                        <Text className="text-gray-500 font-medium">
                            {isLogin ? 'Need an account? ' : 'Already have an account? '}
                        </Text>
                        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                            <Text className="text-black font-bold underline">
                                {isLogin ? 'Sign up' : 'Login'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
