// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Home Screen: 2-col Pickup/Dining cards + Featured hero card + sticky header.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Mic, MapPin, User, ArrowRight, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { MainTabParamList } from '../navigation/MainTabNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocation } from '../context/LocationContext';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import CartSummaryBar from '../components/CartSummaryBar';
import { HERO_IMAGES } from '../lib/data';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const tabNavigation = useNavigation<any>();
    const { activeLocation } = useLocation();
    const [profile, setProfile] = useState<any>(null);
    const [searchText, setSearchText] = useState("");

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile avatar:', error);
        }
    };

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            {/* Sticky Header */}
            <View className="px-6 pt-2 pb-4 bg-white z-20 border-b border-gray-100">
                <View className="flex-row items-start justify-between mb-4">
                    <TouchableOpacity
                        onPress={() => navigation.navigate('LocationPicker')}
                        className="flex-1 pr-4"
                    >
                        <View className="flex-row items-center">
                            <Text className="text-lg font-bold text-gray-900">
                                {activeLocation?.type || 'Select Location'}
                            </Text>
                            <ChevronRight size={16} color="#B52725" />
                        </View>
                        <Text className="text-[11px] font-medium text-gray-500 mt-0.5" numberOfLines={1}>
                            {activeLocation?.address || 'Set your delivery address'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={async () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session) {
                                navigation.navigate('Profile');
                            } else {
                                navigation.navigate('Auth');
                            }
                        }}
                        className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center shadow-sm overflow-hidden border border-gray-100"
                    >
                        {profile?.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                        ) : (
                            <User size={20} color="#9CA3AF" />
                        )}
                    </TouchableOpacity>
                </View>

                <View className="relative w-full h-12 bg-white rounded-xl border border-gray-200 shadow-sm flex-row items-center px-4">
                    <Search size={18} color="#000" />
                    <TextInput
                        className="flex-1 ml-3 font-semibold text-sm text-gray-800"
                        placeholder="Search for 'Atta' or 'Biryani'"
                        placeholderTextColor="#9CA3AF"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>
            </View>

            <ScrollView
                className="flex-1 bg-[#F8F9FA]"
                contentContainerStyle={{ paddingBottom: 120, paddingTop: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* 2-Column Grid: Pickup & Dining */}
                <View className="px-6 mb-8 flex-row gap-4 h-[300px]">
                    {/* Pickup Card */}
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            tabNavigation.navigate('Pickup');
                        }}
                        className="flex-1 rounded-[30px] overflow-hidden bg-gray-200 shadow-sm relative"
                    >
                        <Image
                            source={{ uri: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80" }}
                            className="absolute w-full h-full"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.7)']}
                            style={{ position: 'absolute', inset: 0, padding: 20, justifyContent: 'flex-end' }}
                        >
                            <Text className="text-3xl font-bold text-white leading-tight">Pickup</Text>
                            <Text className="text-xs font-semibold text-white/90 mt-1">Groceries & Essentials</Text>
                            <View className="mt-4 w-10 h-10 rounded-full bg-white items-center justify-center">
                                <ArrowRight size={20} color="#000" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Dining Card */}
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            tabNavigation.navigate('Dining');
                        }}
                        className="flex-1 rounded-[30px] overflow-hidden bg-gray-200 shadow-sm relative"
                    >
                        <Image
                            source={{ uri: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80" }}
                            className="absolute w-full h-full"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.7)']}
                            style={{ position: 'absolute', inset: 0, padding: 20, justifyContent: 'flex-end' }}
                        >
                            <Text className="text-3xl font-bold text-white leading-tight">Dining</Text>
                            <Text className="text-xs font-semibold text-white/90 mt-1">Book Tables & Pre-order</Text>
                            <View className="mt-4 w-10 h-10 rounded-full bg-white items-center justify-center">
                                <ArrowRight size={20} color="#000" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Featured Card (Hero Slider) */}
                <View className="px-6 mb-8">
                    <View className="relative w-full h-[220px] rounded-[30px] overflow-hidden shadow-sm bg-white border border-gray-100">
                        <Image
                            source={{ uri: HERO_IMAGES[0] }}
                            className="absolute w-full h-full"
                        />
                        <View className="absolute top-6 left-6 px-3 py-1.5 bg-black/30 rounded-xl border border-white/20">
                            <Text className="text-[10px] font-bold text-white uppercase tracking-wider">Featured</Text>
                        </View>
                        <View className="absolute bottom-6 right-6">
                            <TouchableOpacity
                                className="px-5 py-2.5 bg-white rounded-xl shadow-lg flex-row items-center"
                                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                            >
                                <Text className="text-xs font-bold text-black mr-2">Order Now</Text>
                                <ChevronRight size={14} color="#000" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View className="items-center mt-4">
                    <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-[4px]">Powered by Pick At Store</Text>
                </View>

            </ScrollView>

            <CartSummaryBar itemCount={2} totalAmount={459} />
        </SafeAreaView>
    );
}
