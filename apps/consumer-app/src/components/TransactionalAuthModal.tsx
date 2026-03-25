import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Modal, Pressable,
    Platform, KeyboardAvoidingView, ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';
import { MessageCircle, X } from 'lucide-react-native';
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
    const [isLoading, setIsLoading] = useState(false);

    const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
        Haptics.impactAsync(style);
    };

    const handleAuth = async () => {
        // TODO: Implement Phone OTP flow mirroring AuthScreen.tsx
        Alert.alert('Coming Soon', 'Phone authentication for transactions is being implemented.');
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
                        <View className="items-center justify-center py-8">
                            <MessageCircle size={48} color="#B52725" />
                            <Text className="text-gray-400 mt-4 text-center">
                                Secure phone verification for transactions is coming soon.
                            </Text>
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
                                <Text className="text-white font-bold text-lg">Verify & Continue</Text>
                            )}
                        </TouchableOpacity>

                        <View className="items-center mt-6">
                            <Text className="text-gray-400 text-sm">Use the main login screen for account access.</Text>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
