import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image } from 'react-native';
import { Search, ChevronRight, User } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useLocation } from '../context/LocationContext';
import { supabase } from '../lib/supabase';

interface GlobalHeaderProps {
    searchText: string;
    onSearchChange: (text: string) => void;
    searchPlaceholder: string;
    rightContent?: React.ReactNode;
    bottomContent?: React.ReactNode;
}

export default function GlobalHeader({
    searchText,
    onSearchChange,
    searchPlaceholder,
    rightContent,
    bottomContent
}: GlobalHeaderProps) {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const { activeLocation, isLoadingLocation } = useLocation();
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        fetchProfile();

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                setProfile(null);
            } else {
                fetchProfile();
            }
        });

        // Listen for profile changes (like avatar updates)
        const profileSubscription = supabase
            .channel('profile-changes-header')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchProfile();
            })
            .subscribe();

        return () => {
            authSubscription.unsubscribe();
            supabase.removeChannel(profileSubscription);
        };
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setProfile(null);
                return;
            }

            const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

            const { data, error } = await Promise.race([
                supabase
                    .from('profiles')
                    .select('avatar_url')
                    .eq('id', session.user.id)
                    .single(),
                timeout(5000)
            ]) as any;

            if (error && error.code !== 'PGRST116') throw error; // Ignore single-row-not-found for new users
            
            if (data?.avatar_url) {
                // Append a timestamp to the URL to bypass React Native's aggressive Image cache
                data.avatar_url = `${data.avatar_url}?v=${Date.now()}`;
                setProfile(data);
            } else {
                setProfile(null);
            }
        } catch (error) {
            console.error('[GlobalHeader] Error fetching profile avatar:', error);
            setProfile(null);
        }
    };

    return (
        <View className="px-6 pt-2 pb-3 bg-white z-20 overflow-visible border-b border-gray-50">
            {/* Top Row: Location & Profile */}
            <View className="flex-row items-start justify-between mb-4">
                <TouchableOpacity
                    className="flex-1 pr-4"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate('LocationPicker');
                    }}
                >
                    <View className="flex-row items-center">
                        <Text className="text-xl font-bold text-gray-900 tracking-tight">
                            {activeLocation?.type || 'Select Location'}
                        </Text>
                        <ChevronRight size={18} color="#B52725" />
                    </View>
                    <Text className="text-xs font-medium text-gray-500 mt-0.5" numberOfLines={1}>
                        {isLoadingLocation ? "Finding target delivery zone..." : (activeLocation?.address || 'Tap to set your current location')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                            navigation.navigate('Profile');
                        } else {
                            // If no session, route to auth
                            navigation.navigate('Auth');
                        }
                    }}
                    className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center border border-gray-200 overflow-hidden shadow-sm"
                >
                    {profile?.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                    ) : (
                        <User size={22} color="#9CA3AF" />
                    )}
                </TouchableOpacity>
            </View>

            {/* Middle Row: Search Bar & Right Content */}
            <View className="flex-row items-center">
                <View className="flex-1 flex-row items-center px-4 h-12 bg-gray-50 rounded-2xl border border-gray-100">
                    <Search size={18} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-3 font-semibold text-[14px] text-gray-800"
                        style={{ paddingVertical: 0, height: 20, lineHeight: 20 }}
                        placeholder={searchPlaceholder}
                        placeholderTextColor="#9CA3AF"
                        value={searchText}
                        onChangeText={onSearchChange}
                    />
                </View>
                {rightContent && (
                    <View className="ml-3">
                        {rightContent}
                    </View>
                )}
            </View>

            {/* Bottom Row: Additional Filters */}
            {bottomContent && (
                <View className="mt-4">
                    {bottomContent}
                </View>
            )}
        </View>
    );
}
