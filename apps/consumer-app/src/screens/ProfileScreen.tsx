// @lock — Do NOT overwrite. Approved upsert & hydration logic as of April 1, 2026.
// Profile Screen: User profile with avatar, details, address management, logout.
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { decode } from 'base64-arraybuffer';
import {
    ChevronRight,
    User,
    Bell,
    Globe,
    Info,
    Moon,
    Calendar,
    HelpCircle,
    LogOut,
    X,
    ChevronLeft,
    CheckCircle,
    LayoutList,
    CircleDashed,
    Camera,
    Mail,
    Cake,
    Smartphone,
    SmartphoneNfc,
    ShieldCheck,
    MessageSquare,
    Layers,
    ShoppingBag,
    MapPin,
    CreditCard,
    Store,
    MessageCircle,
    Pencil,
    Phone,
    Heart
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import * as SecureStore from 'expo-secure-store';
import { apiClient, purgeAuthSession } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, session, profile, isProfileLoading, refreshProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [isSaving, setIsSaving] = useState(false);

    // Edit Profile Modal State
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDob, setNewDob] = useState('');

    // Security & Notification Modal State
    const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);

    // Prefs State
    const [notifPrefs, setNotifPrefs] = useState<any>({
        enable_all: true,
        newsletters: { email: true },
        promos: { email: true, push: true, whatsapp: false },
        social: { email: true, push: true, whatsapp: false },
        orders: { email: true, push: true, whatsapp: false },
        important: { email: true }
    });
    const [secPrefs, setSecPrefs] = useState({
        two_factor: false, biometric: false
    });


    useEffect(() => {
        if (!profile) {
            refreshProfile();
        }
    }, []);

    // Sync modal state when profile loads or modal opens
    useEffect(() => {
        if (profile && isEditModalVisible) {
            setNewName(profile.full_name || '');
            if (profile.date_of_birth) {
                // Convert YYYY-MM-DD to DD-MM-YYYY for display
                const [y, m, d] = profile.date_of_birth.split('-');
                setNewDob(`${d}-${m}-${y}`);
            } else {
                setNewDob('');
            }
        }
    }, [profile, isEditModalVisible]);

    const fetchUserProfile = async () => {
        setRefreshing(true);
        await refreshProfile();
        setRefreshing(false);
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        fetchUserProfile();
    }, []);

    const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
        Haptics.impactAsync(style);
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true
        });

        if (!result.canceled && result.assets[0].base64) {
            uploadAvatar(result.assets[0].base64, result.assets[0].uri.split('.').pop() || 'jpg');
        }
    };

    const uploadAvatar = async (base64: string, extension: string) => {
        setIsSaving(true);
        try {
            if (!user?.id) throw new Error('No user ID found');
            const fileName = `${user.id}-${Math.random()}.${extension}`;
            const { data, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, decode(base64), {
                    contentType: `image/${extension}`,
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user?.id);

            if (updateError) throw updateError;

            await refreshProfile();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            Alert.alert("Upload Error", error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDobChange = (text: string) => {
        // Simple DD-MM-YYYY mask
        let cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length > 8) cleaned = cleaned.substring(0, 8);

        let formatted = cleaned;
        if (cleaned.length > 2) {
            formatted = cleaned.substring(0, 2) + '-' + cleaned.substring(2);
        }
        if (cleaned.length > 4) {
            formatted = cleaned.substring(0, 2) + '-' + cleaned.substring(2, 4) + '-' + cleaned.substring(4);
        }
        setNewDob(formatted);
    };

    const handleUpdateProfile = async () => {
        if (!user?.id) {
            Alert.alert("Session Expired", "Please login again to update your profile.");
            return;
        }

        if (!newName || newName.length < 3) {
            Alert.alert("Invalid Name", "Name must be at least 3 characters long.");
            return;
        }

        if (newDob && !/^\d{2}-\d{2}-\d{4}$/.test(newDob)) {
            Alert.alert('Invalid Date', 'Please use DD-MM-YYYY format.');
            return;
        }


        if (newDob) {
            const [checkD, checkM, checkY] = newDob.split('-');
            const parsedDate = new Date(`${checkY}-${checkM}-${checkD}`);
            if (parsedDate.getDate() !== parseInt(checkD, 10) || parsedDate.getMonth() + 1 !== parseInt(checkM, 10)) {
                Alert.alert('Invalid Date', 'Please enter a valid calendar date.');
                return;
            }
        }

        setIsSaving(true);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Convert DD-MM-YYYY to YYYY-MM-DD for DB
            let formattedDob = null;
            if (newDob && newDob.length === 10) {
                const [d, m, y] = newDob.split('-');
                formattedDob = `${y}-${m}-${d}`;
            }

            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: newName,
                    date_of_birth: formattedDob,
                    updated_at: new Date()
                });

            if (error) throw error;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await refreshProfile();
            setIsEditModalVisible(false);
            Alert.alert("Success", "Profile updated successfully!");
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", error.message);
        } finally {
            setIsSaving(false);
        }
    };


    const updateNotifPrefs = async (category: string, channel: string | null, value: boolean) => {
        let newPrefs: any;
        if (category === 'enable_all') {
            newPrefs = { ...notifPrefs, enable_all: value };
            // Propagate to all nested fields
            Object.keys(newPrefs).forEach((key: string) => {
                if (typeof newPrefs[key] === 'object') {
                    Object.keys(newPrefs[key]).forEach((subKey: string) => {
                        newPrefs[key][subKey] = value;
                    });
                }
            });
        } else if (channel) {
            newPrefs = {
                ...notifPrefs,
                [category]: { ...notifPrefs[category], [channel]: value }
            };
            // If any sub-option is disabled, disable enable_all
            if (!value) newPrefs.enable_all = false;
        } else {
            newPrefs = { ...notifPrefs, [category]: value };
        }

        setNotifPrefs(newPrefs);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ notification_preferences: newPrefs })
                .eq('id', user?.id);
            if (error) throw error;
            triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        } catch (error: any) {
            console.error("Notif update error:", error);
        }
    };

    const updateSecPrefs = async (key: string, value: boolean) => {
        // If enabling biometrics, verify it first
        if (key === 'biometric' && value === true) {
            try {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();

                if (!hasHardware || !isEnrolled) {
                    Alert.alert("Biometrics Unavailable", "Your device does not support biometrics or no biometrics are enrolled.");
                    return;
                }

                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Confirm Biometric Login',
                    fallbackLabel: 'Enter Passcode',
                });

                if (!result.success) return;
            } catch (error) {
                console.error("Biometric verification error:", error);
                Alert.alert("Error", "Failed to verify biometrics.");
                return;
            }
        }

        const newPrefs = { ...secPrefs, [key]: value };
        setSecPrefs(newPrefs);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ security_preferences: newPrefs })
                .eq('id', user?.id);
            if (error) throw error;
            triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        } catch (error: any) {
            console.error("Security update error:", error);
        }
    };

    const handleLogout = async () => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            "Logout",
            "Are you sure you want to log out of your account?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        // Global purge: clears SecureStore, cancels session, and redirects to Auth
                        await purgeAuthSession();
                    }
                }
            ]
        );
    };

    const SectionCard = ({ children }: { children: React.ReactNode }) => (
        <View className="mx-6 mb-6 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
            {children}
        </View>
    );

    const MenuItem = ({ icon: Icon, label, value, onPress, isDestructive = false, isLast = false }: any) => (
        <TouchableOpacity
            onPress={() => {
                triggerHaptic(isDestructive ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
                onPress?.();
            }}
            className={`flex-row items-center justify-between px-5 h-[52px] ${!isLast ? 'border-b border-gray-50' : ''}`}
        >
            <View className="flex-row items-center flex-1">
                <Icon size={20} color={isDestructive ? '#B52725' : '#111827'} />
                <Text className={`ml-4 font-bold text-[15px] ${isDestructive ? 'text-[#B52725]' : 'text-gray-900'}`}>{label}</Text>
            </View>
            <View className="flex-row items-center">
                {value && <Text className="text-gray-400 font-medium mr-2 text-xs">{value}</Text>}
                <ChevronRight size={16} color="#D1D5DB" />
            </View>
        </TouchableOpacity>
    );

    const NotificationCategory = ({ title, description, items, prefs, onToggle, isLast = false }: any) => (
        <View className={`mb-8 ${isLast ? '' : 'border-b border-gray-50 pb-8'}`}>
            <Text className="text-base font-bold text-black mb-1">{title}</Text>
            <Text className="text-xs text-gray-400 mb-6 leading-relaxed">{description}</Text>
            <View className="space-y-6">
                {items.map((item: any) => (
                    <View key={item.id} className="flex-row items-center justify-between mt-4">
                        <View className="flex-row items-center">
                            <item.icon size={20} color={prefs[item.id] ? '#B52725' : '#9CA3AF'} />
                            <Text className={`ml-4 font-bold ${prefs[item.id] ? 'text-gray-900' : 'text-gray-400'}`}>{item.label}</Text>
                        </View>
                        <Switch
                            value={prefs[item.id]}
                            onValueChange={(v) => onToggle(item.id, v)}
                            trackColor={{ false: '#E5E7EB', true: '#B52725' }}
                        />
                    </View>
                ))}
            </View>
        </View>
    );

    if (loading || isProfileLoading) {
        return (
            <View className="flex-1 bg-gray-50 items-center justify-center">
                <ActivityIndicator size="large" color="#B52725" />
            </View>
        );
    }

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-gray-50">
            <View className="flex-row items-center justify-between px-6 py-4">
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2">
                    <ChevronLeft size={20} color="#000" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-[#111827] absolute left-0 right-0 text-center -z-10">Profile</Text>
                <View className="w-10" />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B52725" />
                }
            >
                {/* Centered Identity Section */}
                <View className="items-center pt-4 pb-10">
                    <View className="relative">
                        <View className="w-32 h-32 rounded-full bg-gray-100 items-center justify-center border-4 border-white shadow-sm overflow-hidden">
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                            ) : (
                                <User size={60} color="#D1D5DB" />
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => setIsEditModalVisible(true)}
                            className="absolute bottom-1 right-1 bg-[#B52725] w-10 h-10 rounded-full items-center justify-center border-4 border-white shadow-lg"
                        >
                            <Pencil size={16} color="#FFF" fill="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <View className="mt-4 items-center">
                        {(() => {
                            const rawPhone = user?.phone || '';
                            const formattedPhone = rawPhone ? `(+91) ${rawPhone.replace(/^\+?91/, '').trim()}` : '';
                            const displayName = profile?.full_name || formattedPhone || 'Guest User';
                            const isShowingPhoneAsPrimary = !profile?.full_name && formattedPhone;

                            return (
                                <>
                                    <Text className="text-2xl font-bold text-[#111827]">
                                        {displayName}
                                    </Text>
                                    {user?.phone && !isShowingPhoneAsPrimary && (
                                        <Text className="text-gray-400 font-medium text-sm mt-1">
                                            {formattedPhone}
                                        </Text>
                                    )}
                                </>
                            );
                        })()}
                    </View>
                </View>

                {/* Activity Section */}
                <Text className="mx-8 mb-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Activity</Text>
                <SectionCard>
                    <MenuItem
                        icon={ShoppingBag}
                        label="Your Orders"
                        onPress={() => navigation.navigate('YourOrders')}
                    />
                    <MenuItem
                        icon={MapPin}
                        label="Saved Addresses"
                        onPress={() => navigation.navigate('LocationPicker' as any)}
                    />
                    <MenuItem
                        icon={CreditCard}
                        label="Payment Methods"
                        onPress={() => navigation.navigate('PaymentMethods')}
                    />
                    <MenuItem
                        icon={Heart}
                        label="Favorites"
                        isLast={true}
                        onPress={() => navigation.navigate('Favorites' as any)}
                    />
                </SectionCard>

                {/* Account Settings */}
                <Text className="mx-8 mb-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Account</Text>
                <SectionCard>
                    <MenuItem
                        icon={User}
                        label="Manage Profile"
                        onPress={() => {
                            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                            setIsEditModalVisible(true);
                        }}
                    />
                    <MenuItem
                        icon={Bell}
                        label="Notification Preferences"
                        isLast={true}
                        onPress={() => setIsNotificationsModalVisible(true)}
                    />
                </SectionCard>

                {/* Support & Exit */}
                <Text className="mx-8 mb-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Support</Text>
                <SectionCard>
                    <MenuItem
                        icon={Info}
                        label="About Us"
                        onPress={() => Alert.alert("Pas Consumer", "Version 1.0.45\nRevolutionizing local commerce.")}
                    />
                    <MenuItem
                        icon={HelpCircle}
                        label="Support"
                        onPress={() => navigation.navigate('Support' as any)}
                    />
                    <MenuItem
                        icon={ShieldCheck}
                        label="Privacy Policy"
                        onPress={() => Alert.alert("Privacy", "Our privacy policy is available on our website.")}
                    />
                    <MenuItem
                        icon={LogOut}
                        label="Logout"
                        isDestructive={true}
                        isLast={true}
                        onPress={handleLogout}
                    />
                </SectionCard>

                <View className="mb-12 items-center">
                    <Text className="text-gray-300 text-[10px] font-bold uppercase tracking-[4px]">Powered by Pas</Text>
                </View>
            </ScrollView>

            <Modal
                animationType="slide"
                transparent={true}
                visible={isEditModalVisible}
                onRequestClose={() => setIsEditModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        className="bg-white rounded-t-[40px] p-8 pb-12"
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-lg font-bold text-black">Manage Profile</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                                    setIsEditModalVisible(false);
                                }}
                                className="bg-gray-100 p-2 rounded-full"
                            >
                                <X size={16} color="#000" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} className="max-h-[70vh]">
                            {/* Avatar Section */}
                            <View className="items-center mb-8">
                                <TouchableOpacity
                                    onPress={handlePickImage}
                                    className="relative"
                                >
                                    <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center border-2 border-gray-50 overflow-hidden">
                                        {profile?.avatar_url ? (
                                            <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <User size={40} color="#D1D5DB" />
                                        )}
                                    </View>
                                    <View className="absolute bottom-0 right-0 bg-[#B52725] w-8 h-8 rounded-full items-center justify-center border-2 border-white">
                                        <Camera size={14} color="#FFF" />
                                    </View>
                                </TouchableOpacity>
                                <Text className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-widest">Change Photo</Text>
                            </View>

                            {/* Full Name */}
                            <Text className="text-gray-400 font-bold mb-2 ml-2 uppercase text-[10px] tracking-widest">Full Name</Text>
                            <View className="flex-row items-center border border-gray-100 rounded-3xl px-4 h-14 bg-gray-50 mb-6">
                                <User size={18} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 font-bold text-black text-base ml-3"
                                    placeholder="Enter your full name"
                                    value={newName}
                                    onChangeText={setNewName}
                                    style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                />
                            </View>


                            {/* Phone Number (Read-only) */}
                            {user?.phone && (
                                <>
                                    <Text className="text-gray-400 font-bold mb-2 ml-2 uppercase text-[10px] tracking-widest">Phone Number</Text>
                                    <View className="flex-row items-center border border-gray-100 rounded-3xl px-4 h-14 bg-gray-100 opacity-60 mb-6">
                                        <Phone size={18} color="#9CA3AF" />
                                        <TextInput
                                            className="flex-1 font-bold text-gray-500 text-base ml-3"
                                            value={`+${user.phone.replace(/^\+/, '')}`}
                                            editable={false}
                                            style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                        />
                                    </View>
                                </>
                            )}

                            {/* DOB */}
                            <Text className="text-gray-400 font-bold mb-2 ml-2 uppercase text-[10px] tracking-widest">Date of Birth</Text>
                            <View className="flex-row items-center border border-gray-100 rounded-3xl px-4 h-14 bg-gray-50 mb-10">
                                <Cake size={18} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 font-bold text-black text-base ml-3"
                                    placeholder="DD-MM-YYYY"
                                    value={newDob}
                                    onChangeText={handleDobChange}
                                    keyboardType="numeric"
                                    maxLength={10}
                                    style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleUpdateProfile}
                                disabled={isSaving}
                                className={`h-14 rounded-full items-center justify-center shadow-md mb-4 ${isSaving ? 'bg-gray-400' : 'bg-[#B52725]'}`}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold text-lg">Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Notifications Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isNotificationsModalVisible}
                onRequestClose={() => setIsNotificationsModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[40px] p-8 pb-12">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold text-black">Notification Preferences</Text>
                            <TouchableOpacity
                                onPress={() => setIsNotificationsModalVisible(false)}
                                className="bg-gray-100 p-2 rounded-full"
                            >
                                <X size={16} color="#000" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} className="max-h-[70vh]">
                            {/* Push Master Toggle */}
                            <View className="bg-gray-50 rounded-3xl p-6 mb-4 flex-row items-center justify-between">
                                <View>
                                    <Text className="text-base font-bold text-black">Push Notifications</Text>
                                    <TouchableOpacity onPress={() => Alert.alert("Settings", "Go to system settings to manage app-wide permissions.")}>
                                        <Text className="text-xs text-gray-400">To enable notifications, go to <Text className="text-[#B52725] font-bold">settings</Text></Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="bg-gray-200 px-3 py-1 rounded-lg">
                                    <Text className="text-[10px] font-bold text-gray-500 uppercase">Off</Text>
                                </View>
                            </View>

                            {/* Enable All Master Toggle */}
                            <View className="bg-white border border-gray-100 rounded-3xl p-6 mb-8 flex-row items-center justify-between shadow-sm">
                                <View>
                                    <Text className="text-base font-bold text-black">Enable all</Text>
                                    <Text className="text-xs text-gray-400">Activate all notifications</Text>
                                </View>
                                <Switch
                                    value={notifPrefs.enable_all}
                                    onValueChange={(v) => updateNotifPrefs('enable_all', null, v)}
                                    trackColor={{ false: '#E5E7EB', true: '#B52725' }}
                                />
                            </View>

                            {/* Categories */}
                            <NotificationCategory
                                title="Newsletters"
                                description="Receive newsletter to stay up-to date with whats brewing in food industry"
                                items={[
                                    { id: 'email', label: 'Email', icon: Mail }
                                ]}
                                prefs={notifPrefs.newsletters}
                                onToggle={(id: string, v: boolean) => updateNotifPrefs('newsletters', id, v)}
                            />

                            <NotificationCategory
                                title="Promos and offers"
                                description="Receive updates about coupons, promotions and money-saving offers"
                                items={[
                                    { id: 'email', label: 'Email', icon: Mail },
                                    { id: 'push', label: 'Push', icon: Bell },
                                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }
                                ]}
                                prefs={notifPrefs.promos}
                                onToggle={(id: string, v: boolean) => updateNotifPrefs('promos', id, v)}
                            />

                            <NotificationCategory
                                title="Social notifications"
                                description="Get notified when someone follows your profile, or when you get likes and comments on reviews"
                                items={[
                                    { id: 'email', label: 'Email', icon: Mail },
                                    { id: 'push', label: 'Push', icon: Bell }
                                ]}
                                prefs={notifPrefs.social}
                                onToggle={(id: string, v: boolean) => updateNotifPrefs('social', id, v)}
                            />

                            <NotificationCategory
                                title="Orders and purchases"
                                description="Receive updates related to your order status, memberships, table bookings and more"
                                items={[
                                    { id: 'email', label: 'Email', icon: Mail },
                                    { id: 'push', label: 'Push', icon: Bell },
                                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }
                                ]}
                                prefs={notifPrefs.orders}
                                onToggle={(id: string, v: boolean) => updateNotifPrefs('orders', id, v)}
                            />

                            <NotificationCategory
                                title="Important updates"
                                description="Receive important updates related to your account"
                                items={[
                                    { id: 'email', label: 'Email', icon: Mail }
                                ]}
                                prefs={notifPrefs.important}
                                isLast={true}
                                onToggle={(id: string, v: boolean) => updateNotifPrefs('important', id, v)}
                            />

                            <TouchableOpacity
                                onPress={() => setIsNotificationsModalVisible(false)}
                                className="bg-[#111827] h-14 rounded-2xl items-center justify-center mt-6 shadow-md"
                            >
                                <Text className="text-white font-bold text-lg">Save changes</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
