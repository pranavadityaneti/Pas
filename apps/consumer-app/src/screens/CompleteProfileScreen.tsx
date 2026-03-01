// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Complete Profile Screen: Post-signup profile completion (name, DOB, avatar).
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Cake, Camera, ArrowRight } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';

export default function CompleteProfileScreen() {
    const [fullName, setFullName] = useState('');
    const [dob, setDob] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
        Haptics.impactAsync(style);
    };

    const handleDobChange = (text: string) => {
        let cleaned = text.replace(/[^0-9]/g, '');
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
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            uploadImage(result.assets[0].base64);
        }
    };

    const uploadImage = async (base64: string) => {
        try {
            setUploading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const filePath = `${user.id}/${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, decode(base64), {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setAvatarUrl(publicUrl);
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error: any) {
            Alert.alert('Upload Error', error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleComplete = async () => {
        if (!fullName || fullName.length < 3) {
            Alert.alert('Full Name', 'Please enter your full name (at least 3 characters).');
            return;
        }
        if (dob.length !== 10) {
            Alert.alert('Date of Birth', 'Please enter your date of birth in DD-MM-YYYY format.');
            return;
        }

        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [d, m, y] = dob.split('-');
            const dbDob = `${y}-${m}-${d}`;

            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: fullName,
                    date_of_birth: dbDob,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

            // Force a session refresh to trigger RootNavigator's onAuthStateChange
            await supabase.auth.refreshSession();

            // We set saving to false here just in case navigation is delayed
            setSaving(false);

        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 }}>
                    <View className="mb-10">
                        <Text className="text-3xl font-bold text-black-shadow mb-2 text-center">Complete Profile</Text>
                        <Text className="text-gray-500 text-center font-medium">
                            Set up your identity to get the best experience on Pas.
                        </Text>
                    </View>

                    {/* Avatar Picker */}
                    <View className="items-center mb-12">
                        <TouchableOpacity
                            onPress={pickImage}
                            disabled={uploading}
                            className="relative"
                        >
                            <View className="w-32 h-32 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 items-center justify-center overflow-hidden">
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                                ) : (
                                    <View className="items-center">
                                        <Camera size={32} color="#9CA3AF" />
                                        <Text className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Add Photo</Text>
                                    </View>
                                )}
                                {uploading && (
                                    <View className="absolute inset-0 bg-black/20 items-center justify-center">
                                        <ActivityIndicator color="#FFF" />
                                    </View>
                                )}
                            </View>
                            <View className="absolute bottom-1 right-1 bg-[#B52725] w-8 h-8 rounded-full items-center justify-center border-2 border-white">
                                <Plus size={16} color="#FFF" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Form Fields */}
                    <View className="space-y-6">
                        <View>
                            <Text className="text-gray-400 font-bold mb-2 ml-2 uppercase text-[10px] tracking-widest text-center">Your Full Name</Text>
                            <View className="flex-row items-center border border-gray-100 rounded-2xl px-4 h-14 bg-gray-50">
                                <User size={18} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 font-bold text-black text-base ml-3"
                                    placeholder="Enter your full name"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-gray-400 font-bold mb-2 ml-2 uppercase text-[10px] tracking-widest text-center">Date of Birth</Text>
                            <View className="flex-row items-center border border-gray-100 rounded-2xl px-4 h-14 bg-gray-50">
                                <Cake size={18} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 font-bold text-black text-base ml-3"
                                    placeholder="DD-MM-YYYY"
                                    value={dob}
                                    onChangeText={handleDobChange}
                                    keyboardType="numeric"
                                    maxLength={10}
                                    style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                />
                            </View>
                        </View>
                    </View>

                    <View className="flex-1" />

                    <TouchableOpacity
                        onPress={handleComplete}
                        disabled={saving || uploading}
                        className={`w-full h-16 rounded-2xl flex-row items-center justify-center shadow-lg ${saving || uploading ? 'bg-gray-300' : 'bg-[#B52725]'}`}
                    >
                        <Text className="text-white font-bold text-lg mr-2">Continue</Text>
                        {saving ? <ActivityIndicator color="#FFF" /> : <ArrowRight size={20} color="#FFF" />}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const Plus = ({ size, color }: any) => (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color, fontSize: size, fontWeight: 'bold', lineHeight: size }}>+</Text>
    </View>
);
