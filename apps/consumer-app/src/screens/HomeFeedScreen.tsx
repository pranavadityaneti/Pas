// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Pickup Discovery Screen: Hero slider, category grid, product carousels, cross-promo card.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Search, ChevronDown, User, Mic, ChevronRight, Star, ShoppingBag, ArrowRight, X, Check, UtensilsCrossed } from 'lucide-react-native';
import { STORE_CATEGORIES, HERO_IMAGES, STORES, ALL_PRODUCTS } from '../lib/data';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocation } from '../context/LocationContext';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import CartSummaryBar from '../components/CartSummaryBar';
import { Modal } from 'react-native';
import { useMemo } from 'react';

const { width } = Dimensions.get('window');

export default function HomeFeedScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { activeLocation, isLoadingLocation } = useLocation();
    const [profile, setProfile] = useState<any>(null);
    const [searchText, setSearchText] = useState('');
    const [vegFilter, setVegFilter] = useState<'all' | 'veg'>('all');
    const [vegModalVisible, setVegModalVisible] = useState(false);

    useEffect(() => {
        fetchProfile();

        // Listen for auth state changes to clear profile on logout
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                setProfile(null);
            } else {
                fetchProfile();
            }
        });

        // Listen for profile changes
        const profileSubscription = supabase
            .channel('profile-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles'
            }, () => {
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

    // --- Filtered Products Logic ---
    const filteredProducts = useMemo(() => {
        let list = [...ALL_PRODUCTS];
        if (vegFilter === 'veg') {
            list = list.filter(p => p.isVeg !== false);
        }
        if (searchText) {
            const query = searchText.toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.category.toLowerCase().includes(query)
            );
        }
        return list;
    }, [vegFilter, searchText]);

    const dailyEssentials = useMemo(() =>
        filteredProducts.filter(p => p.category === 'grocery').slice(0, 10),
        [filteredProducts]);

    const snacksMunchies = useMemo(() =>
        filteredProducts.filter(p => p.category === 'bakery').slice(0, 10),
        [filteredProducts]);

    const topRatedProducts = useMemo(() =>
        [...filteredProducts].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 10),
        [filteredProducts]);

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            {/* Sticky Header — Matching Home Screen */}
            <View className="px-6 pt-2 pb-4 bg-white z-20 border-b border-gray-100">
                <View className="flex-row items-start justify-between mb-4">
                    <TouchableOpacity
                        className="flex-1 pr-4"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('LocationPicker');
                        }}
                    >
                        <View className="flex-row items-center">
                            <Text className="text-lg font-bold text-gray-900">
                                {activeLocation?.type || 'Select Location'}
                            </Text>
                            <ChevronRight size={16} color="#B52725" />
                        </View>
                        <Text className="text-[11px] font-medium text-gray-500 mt-0.5" style={{ flexWrap: 'wrap' }} numberOfLines={1}>
                            {isLoadingLocation ? "Finding target delivery zone..." : (activeLocation?.address || 'Click to add an address')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={async () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session) {
                                (navigation as any).navigate('Profile');
                            } else {
                                (navigation as any).navigate('Auth');
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

                {/* Search Bar & Veg Filter */}
                <View className="flex-row items-center">
                    <View className="flex-1 flex-row items-center px-4 h-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <Search size={18} color="#000" />
                        <TextInput
                            className="flex-1 ml-3 font-semibold text-sm text-gray-800"
                            style={{ paddingVertical: 0, height: 20, lineHeight: 20, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                            placeholder="Search for 'Atta' or 'Snacks'..."
                            placeholderTextColor="#9CA3AF"
                            value={searchText}
                            onChangeText={setSearchText}
                        />
                    </View>

                    {/* Veg Toggle Button */}
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setVegModalVisible(true);
                        }}
                        className={`ml-3 px-3 h-12 rounded-xl border items-center justify-center flex-row ${vegFilter === 'veg' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                            }`}
                    >
                        <View className="w-3 h-3 border border-green-600 items-center justify-center mr-1.5" style={{ borderWidth: 1 }}>
                            <View className="w-1.5 h-1.5 rounded-full bg-green-600" />
                        </View>
                        <Text className={`text-[10px] font-bold uppercase tracking-tighter ${vegFilter === 'veg' ? 'text-green-700' : 'text-gray-500'}`}>
                            Veg
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1 bg-[#F8F9FA]" contentContainerStyle={{ paddingBottom: 120, paddingTop: 16 }} showsVerticalScrollIndicator={false}>

                {/* Hero Banner Slider */}
                <View className="px-5 mb-8">
                    <FlatList
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        data={HERO_IMAGES}
                        keyExtractor={(_, index) => index.toString()}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
                                style={{ width: width - 48, height: 210 }}
                                className="mr-5 relative rounded-[32px] overflow-hidden shadow-sm bg-white border border-gray-100"
                            >
                                <Image source={{ uri: item }} className="absolute w-full h-full" />
                                <View className="absolute inset-0 bg-black/20 p-5">
                                    <View className="px-3 py-1.5 bg-black/30 rounded-xl border border-white/20 self-start">
                                        <Text className="text-[10px] font-bold text-white tracking-wider uppercase">Featured</Text>
                                    </View>
                                </View>
                                <View className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-lg absolute bottom-5 right-5">
                                    <ChevronRight size={20} color="#000" />
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>

                {/* Categories Grid */}
                <View className="px-5 mb-8">
                    <View className="flex-row flex-wrap justify-between gap-y-6">
                        {STORE_CATEGORIES.map((cat, i) => (
                            <TouchableOpacity
                                key={cat.id}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className="items-center"
                                style={{ width: '18%' }}
                            >
                                <View className="w-14 h-14 rounded-[20px] bg-white border border-gray-100 items-center justify-center shadow-sm">
                                    <cat.icon size={22} color="#B52725" strokeWidth={1.5} />
                                </View>
                                <Text className="text-[10px] font-bold text-gray-800 mt-2 text-center" numberOfLines={1}>
                                    {cat.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Products Section: Daily Essentials */}
                <View className="mb-8">
                    <View className="px-5 mb-4 flex-row justify-between items-end">
                        <Text className="text-xl font-bold text-black-shadow">Daily Essentials</Text>
                        <TouchableOpacity>
                            <Text className="text-xs font-bold text-gray-400">See All</Text>
                        </TouchableOpacity>
                    </View>
                    {dailyEssentials.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                            {dailyEssentials.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    className="mr-4 w-32"
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        navigation.navigate('Storefront', { storeId: (item as any).storeId });
                                    }}
                                >
                                    <View className="aspect-[3/4] rounded-[24px] bg-white border border-gray-100 overflow-hidden relative shadow-sm">
                                        <Image source={{ uri: item.image }} className="w-full h-full object-cover" />
                                        <View className="absolute top-2 left-2 flex-col gap-1">
                                            {item.isVeg !== undefined && (
                                                <View className="bg-white/90 p-1 rounded-md mb-1 self-start">
                                                    <View className={`w-2.5 h-2.5 border items-center justify-center ${item.isVeg ? 'border-green-600' : 'border-red-600'}`} style={{ borderWidth: 1 }}>
                                                        {item.isVeg ? (
                                                            <View className="w-1 h-1 rounded-full bg-green-600" />
                                                        ) : (
                                                            <View style={{ width: 0, height: 0, borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#DC2626' }} />
                                                        )}
                                                    </View>
                                                </View>
                                            )}
                                            {item.isBestseller && (
                                                <View className="px-1.5 py-0.5 bg-orange-100 rounded-md">
                                                    <Text className="text-[8px] font-bold text-orange-800">Bestseller</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <View className="mt-2">
                                        <Text className="text-[11px] font-bold text-black-shadow" numberOfLines={2}>{item.name}</Text>
                                        <View className="flex-row items-center mt-1">
                                            <Text className="text-[10px] font-bold">₹{item.price}</Text>
                                            {item.discount > 0 && (
                                                <Text className="text-[9px] font-bold text-green-600 ml-2">{item.discount}% OFF</Text>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    ) : (
                        <View className="mx-5 py-8 items-center justify-center bg-white rounded-[24px] border border-dashed border-gray-200">
                            <Search size={24} color="#E5E7EB" strokeWidth={1} />
                            <Text className="text-gray-400 text-[11px] font-bold mt-2">No matching items found</Text>
                        </View>
                    )}
                </View>

                {/* Products Section: Snacks & Munchies */}
                <View className="mb-8">
                    <View className="px-5 mb-4 flex-row justify-between items-end">
                        <Text className="text-xl font-bold text-black-shadow">Snacks & Munchies</Text>
                        <TouchableOpacity>
                            <Text className="text-xs font-bold text-gray-400">See All</Text>
                        </TouchableOpacity>
                    </View>
                    {snacksMunchies.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                            {snacksMunchies.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    className="mr-4 w-32"
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        navigation.navigate('Storefront', { storeId: (item as any).storeId });
                                    }}
                                >
                                    <View className="aspect-[3/4] rounded-[24px] bg-white border border-gray-100 overflow-hidden relative shadow-sm">
                                        <Image source={{ uri: item.image }} className="w-full h-full object-cover" />
                                        <View className="absolute top-2 left-2 flex-col gap-1">
                                            {item.isVeg !== undefined && (
                                                <View className="bg-white/90 p-1 rounded-md mb-1 self-start">
                                                    <View className={`w-2.5 h-2.5 border items-center justify-center ${item.isVeg ? 'border-green-600' : 'border-red-600'}`} style={{ borderWidth: 1 }}>
                                                        {item.isVeg ? (
                                                            <View className="w-1 h-1 rounded-full bg-green-600" />
                                                        ) : (
                                                            <View style={{ width: 0, height: 0, borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#DC2626' }} />
                                                        )}
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <View className="mt-2">
                                        <Text className="text-[11px] font-bold text-black-shadow" numberOfLines={2}>{item.name}</Text>
                                        <View className="flex-row items-center mt-1">
                                            <Text className="text-[10px] font-bold">₹{item.price}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    ) : (
                        <View className="mx-5 py-8 items-center justify-center bg-white rounded-[24px] border border-dashed border-gray-200">
                            <Text className="text-gray-400 text-[11px] font-bold">No snacks found</Text>
                        </View>
                    )}
                </View>

                {/* Products Section: Top Rated */}
                <View className="mb-12">
                    <View className="px-5 mb-4 flex-row justify-between items-end">
                        <Text className="text-xl font-bold text-black-shadow">Top Rated Products</Text>
                    </View>
                    {topRatedProducts.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                            {topRatedProducts.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    className="mr-4 w-32"
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        navigation.navigate('Storefront', { storeId: (item as any).storeId });
                                    }}
                                >
                                    <View className="aspect-[3/4] rounded-[24px] bg-white border border-gray-100 overflow-hidden relative shadow-sm">
                                        <Image source={{ uri: item.image }} className="w-full h-full object-cover" />
                                        <View className="absolute top-2 left-2 flex-col gap-1">
                                            <View className="bg-white/90 p-1 rounded-md mb-1 self-start">
                                                <View className="flex-row items-center">
                                                    <Star size={8} color="#FBBF24" fill="#FBBF24" />
                                                    <Text className="text-[8px] font-bold text-gray-800 ml-0.5">{item.rating}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                    <View className="mt-2">
                                        <Text className="text-[11px] font-bold text-black-shadow" numberOfLines={2}>{item.name}</Text>
                                        <View className="flex-row items-center mt-1">
                                            <Text className="text-[10px] font-bold">₹{item.price}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    ) : (
                        <View className="mx-5 py-8 items-center justify-center bg-white rounded-[24px] border border-dashed border-gray-200">
                            <Text className="text-gray-400 text-[11px] font-bold">No top picks found</Text>
                        </View>
                    )}
                </View>

                {/* Cross-Promotion: Reserve a Table */}
                <View className="px-5 mb-10">
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            (navigation as any).navigate('Dining');
                        }}
                        className="w-full h-[180px] rounded-[30px] overflow-hidden relative"
                    >
                        <Image
                            source={{ uri: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80" }}
                            className="absolute w-full h-full"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={{ position: 'absolute', inset: 0, padding: 24, justifyContent: 'flex-end' }}
                        >
                            <Text className="text-2xl font-bold text-white mb-1">Reserve a Table</Text>
                            <Text className="text-sm font-medium text-white/90 mb-4">Skip the wait. Explore premium dining.</Text>
                            <View className="px-4 py-2 bg-white rounded-xl self-start">
                                <Text className="text-xs font-bold text-black">Explore Dining</Text>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            <CartSummaryBar itemCount={2} totalAmount={459} />

            {/* Custom Veg Preference Modal */}
            <Modal
                visible={vegModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setVegModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <View className="bg-white w-full rounded-[32px] overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <View className="bg-white p-5 flex-row justify-between items-center border-b border-gray-50">
                            <View>
                                <Text className="text-gray-900 text-lg font-bold">Food Preference</Text>
                                <Text className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Clean & Pure Choice</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setVegModalVisible(false)}
                                className="bg-gray-100 p-2 rounded-full"
                            >
                                <X size={18} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View className="p-5">
                            <Text className="text-gray-500 text-[12px] font-medium leading-5 mb-4">
                                Choose your dining preference across the platform.
                            </Text>

                            <TouchableOpacity
                                onPress={() => {
                                    setVegFilter('all');
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={`flex-row items-center p-3.5 rounded-2xl mb-3 border-2 ${vegFilter === 'all' ? 'border-amber-400 bg-amber-100' : 'border-gray-100 bg-white'
                                    }`}
                                activeOpacity={0.8}
                            >
                                <View className={`w-9 h-9 rounded-xl items-center justify-center ${vegFilter === 'all' ? 'bg-amber-400' : 'bg-gray-100'}`}>
                                    <UtensilsCrossed size={16} color={vegFilter === 'all' ? 'white' : '#9CA3AF'} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className={`text-[14px] font-bold ${vegFilter === 'all' ? 'text-gray-900' : 'text-gray-600'}`}>Show All</Text>
                                    <Text className="text-[10px] text-gray-400 font-medium">Everything on the menu</Text>
                                </View>
                                {vegFilter === 'all' && <Check size={18} color="#F59E0B" />}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setVegFilter('veg');
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={`flex-row items-center p-3.5 rounded-2xl border-2 ${vegFilter === 'veg' ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white'
                                    }`}
                                activeOpacity={0.8}
                            >
                                <View className={`w-9 h-9 rounded-xl items-center justify-center ${vegFilter === 'veg' ? 'bg-green-500' : 'bg-gray-100'}`}>
                                    <View className="w-3.5 h-3.5 border border-white items-center justify-center" style={{ borderWidth: 1 }}>
                                        <View className="w-1.5 h-1.5 rounded-full bg-white" />
                                    </View>
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className={`text-[14px] font-bold ${vegFilter === 'veg' ? 'text-gray-900' : 'text-gray-600'}`}>Pure Veg Only</Text>
                                    <Text className="text-[10px] text-gray-400 font-medium">Exclusively vegetarian</Text>
                                </View>
                                {vegFilter === 'veg' && <Check size={18} color="#10B981" />}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    setVegModalVisible(false);
                                }}
                                className="bg-[#B52725] py-4 rounded-2xl items-center mt-6 shadow-md"
                            >
                                <Text className="text-white font-bold uppercase tracking-widest text-[13px]">Update Feed</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
