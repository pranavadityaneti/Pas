// @lock — Do NOT overwrite. Approved layout as of Mar 12, 2026.
// ProfileSetup Screen: Collects profile details for new users after OTP verification.
// Full-page screen (not a modal) for name, DOB, and optional avatar.

import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
    Platform, ActivityIndicator, Alert, Image, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { User, Cake, Camera, Plus, Mail } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

export default function ProfileSetupScreen() {
    const navigation = useNavigation<any>();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [dob, setDob] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const handleDobChange = (text: string) => {
        let cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length > 8) cleaned = cleaned.substring(0, 8);
        let formatted = cleaned;
        if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + '-' + cleaned.slice(2);
        if (cleaned.length > 4) formatted = formatted.slice(0, 5) + '-' + cleaned.slice(4, 8);
        setDob(formatted);
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need access to your gallery to set a profile picture.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            setAvatarBase64(result.assets[0].base64);
            setAvatarUrl(result.assets[0].uri);
        }
    };

    const handleComplete = async () => {
        if (!fullName.trim() || fullName.length < 3) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Invalid Name', 'Please enter your full name (at least 3 characters).');
            return;
        }

        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        if (dob && !/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
            Alert.alert('Invalid Date', 'Please use DD-MM-YYYY format.');
            return;
        }

        if (dob) {
            const [checkD, checkM, checkY] = dob.split('-');
            const parsedDate = new Date(`${checkY}-${checkM}-${checkD}`);
            if (parsedDate.getDate() !== parseInt(checkD, 10) || parsedDate.getMonth() + 1 !== parseInt(checkM, 10)) {
                Alert.alert('Invalid Date', 'Please enter a valid calendar date.');
                return;
            }
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            let uploadedAvatarUrl = null;

            // Upload Avatar if selected
            if (avatarBase64) {
                try {
                    setUploadingAvatar(true);
                    // Use a static filename so retries/updates overwrite the existing image
                    const filePath = `${user.id}/profile.jpg`;
                    const { error: uploadError } = await supabase.storage
                        .from('avatars')
                        .upload(filePath, decode(avatarBase64), {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('avatars')
                            .getPublicUrl(filePath);
                        uploadedAvatarUrl = publicUrl;
                    }
                } catch (e: any) {
                    console.warn('Avatar upload failed:', e);
                } finally {
                    setUploadingAvatar(false);
                }
            }

            // Format DOB for DB
            let dbDob = null;
            if (dob && dob.length === 10) {
                const [d, m, y] = dob.split('-');
                dbDob = `${y}-${m}-${d}`;
            }

            // Upsert Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: fullName,
                    email: email.trim() || null,
                    date_of_birth: dbDob,
                    avatar_url: uploadedAvatarUrl,
                    profile_completed: true,
                    updated_at: new Date().toISOString()
                });

            if (profileError) {
                throw new Error(profileError.message || 'Failed to save profile details.');
            }

            // NOTE (PM Fixed): Removed aggressive background Location Permission prompt here.
            // Asking for OS permissions while the screen is unmounting/transitioning to Main
            // causes UI freezes and jarring UX. Location fetching is properly deferred to Main/LocationPicker.

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Clear the pending flag but DO NOT await it. If this hangs, we don't care, 
            // the user's profile is already saved in DB and we must get them to the Main screen.
            SecureStore.deleteItemAsync('pending_profile_setup').catch(e => console.warn('SecureStore delete failed:', e));
            
            console.log("Profile saved. Forcing navigation to Main.");
            // Force navigate to Main directly.
            navigation.replace('Main');
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to save profile');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 32, paddingTop: 40 }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* Header */}
                    <Text className="text-3xl font-bold text-[#B52725] mb-2">Complete Profile</Text>
                    <Text className="text-gray-400 font-medium text-sm mb-10 leading-relaxed">
                        Tell us a bit about yourself to personalize your experience.
                    </Text>

                    {/* Avatar Picker */}
                    <View className="items-center mb-10">
                        <TouchableOpacity
                            onPress={pickImage}
                            disabled={uploadingAvatar}
                            className="relative"
                        >
                            <View className="w-28 h-28 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 items-center justify-center overflow-hidden">
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                                ) : (
                                    <View className="items-center">
                                        <Camera size={28} color="#9CA3AF" />
                                        <Text className="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Add Photo</Text>
                                    </View>
                                )}
                                {uploadingAvatar && (
                                    <View className="absolute inset-0 bg-black/20 items-center justify-center">
                                        <ActivityIndicator color="#FFF" />
                                    </View>
                                )}
                            </View>
                            <View className="absolute bottom-0 right-0 bg-[#B52725] w-8 h-8 rounded-full items-center justify-center border-2 border-white">
                                <Plus size={16} color="#FFF" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Full Name */}
                    <Text className="text-gray-400 font-bold mb-2 ml-1 uppercase text-[10px] tracking-widest">Full Name</Text>
                    <View className="flex-row items-center border border-gray-200 rounded-2xl px-4 h-14 bg-gray-50 mb-6">
                        <User size={18} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-3 font-bold text-black text-base"
                            placeholder="Enter your full name"
                            placeholderTextColor="#9CA3AF"
                            autoCapitalize="words"
                            value={fullName}
                            onChangeText={setFullName}
                            style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                        />
                    </View>

                    {/* Email Address */}
                    <Text className="text-gray-400 font-bold mb-2 ml-1 uppercase text-[10px] tracking-widest">Email Address (Optional)</Text>
                    <View className="flex-row items-center border border-gray-200 rounded-2xl px-4 h-14 bg-gray-50 mb-6">
                        <Mail size={18} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-3 font-bold text-black text-base"
                            placeholder="your.email@example.com"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                            style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                        />
                    </View>

                    {/* Date of Birth */}
                    <Text className="text-gray-400 font-bold mb-2 ml-1 uppercase text-[10px] tracking-widest">Date of Birth (Optional)</Text>
                    <View className="flex-row items-center border border-gray-200 rounded-2xl px-4 h-14 bg-gray-50 mb-10">
                        <Cake size={18} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-3 font-bold text-black text-base"
                            placeholder="DD-MM-YYYY"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            maxLength={10}
                            value={dob}
                            onChangeText={handleDobChange}
                            style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                        />
                    </View>

                    {/* Submit */}
                    <TouchableOpacity
                        onPress={handleComplete}
                        disabled={isLoading}
                        className={`h-14 rounded-2xl items-center justify-center shadow-md ${
                            isLoading ? 'bg-gray-300' : 'bg-[#B52725]'
                        }`}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-[15px]">Complete Setup</Text>
                        )}
                    </TouchableOpacity>

                    {/* Skip for now */}
                    <TouchableOpacity
                        className="items-center mt-5 mb-10"
                        onPress={async () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            await SecureStore.deleteItemAsync('pending_profile_setup');
                            navigation.replace('Main');
                        }}
                    >
                        <Text className="text-gray-400 font-bold text-sm">Skip for now</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
