import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image } from 'react-native';
import { Search, ChevronRight, User, X, Bell } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { useNotificationContext } from '../context/NotificationContext';
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
    const { user, profile: globalProfile } = useAuth();
    const { unreadCount } = useNotificationContext();

    // Redundant local profile fetching removed to unify state.
    // Deep state now managed exclusively by AuthContext.

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
                            {isLoadingLocation ? 'Finding Location...' : (activeLocation?.type || 'Select Location')}
                        </Text>
                        <ChevronRight size={18} color="#B52725" />
                    </View>
                    <Text className="text-xs font-medium text-gray-500 mt-0.5" numberOfLines={1}>
                        {isLoadingLocation ? "Pinging target delivery zone..." : (activeLocation?.address || 'Tap to set your current location')}
                    </Text>
                </TouchableOpacity>

                <View className="flex-row items-center">
                    {/* Bell — only for logged-in users (guests have no notifications) */}
                    {user && (
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate('Notifications');
                            }}
                            className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center border border-gray-200 shadow-sm mr-3"
                        >
                            <Bell size={20} color="#374151" />
                            {unreadCount > 0 && (
                                <View
                                    style={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -4,
                                        minWidth: 18,
                                        height: 18,
                                        paddingHorizontal: 4,
                                        borderRadius: 9,
                                        backgroundColor: '#B52725',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={async () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (user) {
                                navigation.navigate('Profile');
                            } else {
                                navigation.navigate('Auth');
                            }
                        }}
                        className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center border border-gray-200 overflow-hidden shadow-sm"
                    >
                        {globalProfile?.avatar_url ? (
                            <Image source={{ uri: globalProfile.avatar_url }} className="w-full h-full" />
                        ) : (
                            <User size={22} color="#9CA3AF" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Middle Row: Search Bar & Right Content */}
            <View className="flex-row items-center">
                <View className="flex-1 flex-row items-center px-4 h-12 bg-gray-50 rounded-2xl border border-gray-100">
                    <Search size={18} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-3 font-semibold text-[14px] text-gray-800"
                        style={{ paddingVertical: 0, height: 20, lineHeight: 20, textAlignVertical: 'center', includeFontPadding: false }}
                        placeholder={searchPlaceholder}
                        placeholderTextColor="#9CA3AF"
                        value={searchText}
                        onChangeText={onSearchChange}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onSearchChange('');
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            className="ml-1 w-6 h-6 rounded-full bg-gray-200 items-center justify-center"
                        >
                            <X size={14} color="#6B7280" />
                        </TouchableOpacity>
                    )}
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
