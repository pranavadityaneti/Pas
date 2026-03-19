import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Modal, Pressable,
    Platform, KeyboardAvoidingView, ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Eye, EyeOff, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface TransactionalAuthModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
    subtitle?: string;
}

export default function TransactionalAuthModal({
    visible,
    onClose,
    onSuccess,
    title = 'Login Required',
    subtitle = 'Please login or sign up to continue.'
}: TransactionalAuthModalProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
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

        const timeout = (ms: number) => new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), ms)
        );

        try {
            if (isLogin) {
                const { error } = await Promise.race([
                    supabase.auth.signInWithPassword({ email, password }),
                    timeout(30000)
                ]) as any;
                if (error) throw error;
            } else {
                const { error, data } = await Promise.race([
                    supabase.auth.signUp({ email, password }),
                    timeout(30000)
                ]) as any;
                if (error) throw error;
                if (!data.session) {
                    Alert.alert('Verification Required', 'Please check your email to verify your account.');
                    return;
                }
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSuccess();
        } catch (error: any) {
            console.error('Transactional Auth Error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Authentication Error', error.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
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
                        {/* Form */}
                        <View className="space-y-4">
                            <View className="flex-row items-center border border-gray-200 rounded-2xl px-4 h-14 bg-gray-50">
                                <Mail color="#9CA3AF" size={20} />
                                <TextInput
                                    className="flex-1 ml-3 font-medium text-black text-base"
                                    placeholder="Email"
                                    placeholderTextColor="#9CA3AF"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View className="flex-row items-center border border-gray-200 rounded-2xl px-4 h-14 bg-gray-50 mt-4">
                                <Lock color="#9CA3AF" size={20} />
                                <TextInput
                                    className="flex-1 ml-3 font-medium text-black text-base"
                                    placeholder="Password"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                                    {showPassword ? <Lock size={20} color="#B52725" /> : <Lock size={20} color="#9CA3AF" />}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Action Button */}
                        <TouchableOpacity
                            onPress={handleAuth}
                            disabled={isLoading}
                            className={`mt-8 h-14 rounded-2xl items-center justify-center shadow-md ${isLoading ? 'bg-gray-400' : 'bg-[#B52725]'}`}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg">{isLogin ? 'Login' : 'Sign Up'}</Text>
                            )}
                        </TouchableOpacity>

                        {/* Toggle Mode */}
                        <View className="flex-row justify-center mt-6">
                            <Text className="text-gray-500 font-medium">
                                {isLogin ? 'Need an account? ' : 'Already have an account? '}
                            </Text>
                            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                                <Text className="text-[#B52725] font-bold underline">
                                    {isLogin ? 'Sign up' : 'Login'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
