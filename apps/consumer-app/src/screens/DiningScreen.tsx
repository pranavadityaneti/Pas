// @lock — Do NOT overwrite. Approved redesign as of Feb 27, 2026.
// Dining Screen: Spotlights, 4 category carousels, All Restaurants vertical list.
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronRight, Star, Clock, Sparkles, BadgeCheck, Mic, User, Calendar, UtensilsCrossed, X, Check } from 'lucide-react-native';
import { RESTAURANTS } from '../lib/data';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocation } from '../context/LocationContext';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import CartSummaryBar from '../components/CartSummaryBar';
import BookingModal from '../components/BookingModal';

const { width } = Dimensions.get('window');

// --- Spotlight Cards Data ---
export const DINING_SPOTLIGHTS = [
    {
        id: 1,
        title: 'Weekend Special',
        subtitle: '20% OFF on all bookings',
        badge: 'Limited Offer',
        badgeColor: '#B52725',
        image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    },
    {
        id: 2,
        title: 'Premium Tables',
        subtitle: 'Book your exclusive experience',
        badge: 'VIP',
        badgeColor: '#EAB308',
        image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80',
    },
    {
        id: 3,
        title: 'Pre-Order Meals',
        subtitle: 'Skip the wait, order ahead',
        badge: 'Pre-Order',
        badgeColor: '#B52725',
        image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
    },
    {
        id: 4,
        title: "Chef's Table",
        subtitle: 'Curated 5-course experiences',
        badge: 'Exclusive',
        badgeColor: '#EAB308',
        image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
    },
    {
        id: 5,
        title: 'Group Dining',
        subtitle: 'Perfect for parties & celebrations',
        badge: 'Group',
        badgeColor: '#B52725',
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    },
    {
        id: 6,
        title: 'Late Night Bites',
        subtitle: 'Open past midnight',
        badge: 'Night Owl',
        badgeColor: '#B52725',
        image: 'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?auto=format&fit=crop&w=800&q=80',
    },
];

// --- Cuisine Filters ---
const CUISINE_FILTERS = ['All', 'North Indian', 'South Indian', 'Chinese', 'Street Food', 'Mughlai'];

export default function DiningScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { activeLocation } = useLocation();
    const { getItemCount, getTotal } = useCart();
    const [profile, setProfile] = useState<any>(null);
    const [searchText, setSearchText] = useState('');
    const [selectedCuisine, setSelectedCuisine] = useState('All');
    const [bookingVisible, setBookingVisible] = useState(false);
    const [bookingRestaurant, setBookingRestaurant] = useState<any>(null);
    const [vegFilter, setVegFilter] = useState<'all' | 'veg'>('all');
    const [vegModalVisible, setVegModalVisible] = useState(false);

    const openBooking = (restaurant: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setBookingRestaurant(restaurant);
        setBookingVisible(true);
    };

    useEffect(() => {
        fetchProfile();

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                setProfile(null);
            } else {
                fetchProfile();
            }
        });

        return () => {
            authSubscription.unsubscribe();
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

            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile avatar:', error);
            setProfile(null);
        }
    };

    // --- Filtered & Categorized Restaurants ---
    const filteredRestaurants = useMemo(() => {
        let list = [...RESTAURANTS];
        if (selectedCuisine !== 'All') {
            list = list.filter(r => r.cuisine === selectedCuisine);
        }
        if (vegFilter === 'veg') {
            list = list.filter(r => (r as any).isVeg);
        }
        if (searchText) {
            const query = searchText.toLowerCase();
            list = list.filter(r =>
                r.name.toLowerCase().includes(query) ||
                r.cuisine.toLowerCase().includes(query) ||
                r.products.some(p => p.name.toLowerCase().includes(query))
            );
        }
        return list;
    }, [selectedCuisine, vegFilter, searchText]);

    const topRated = useMemo(() =>
        [...filteredRestaurants].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 8),
        [filteredRestaurants]
    );

    const fineDining = useMemo(() =>
        filteredRestaurants.filter(r => r.type === 'Fine Dining').slice(0, 8),
        [filteredRestaurants]
    );

    const quickService = useMemo(() =>
        filteredRestaurants.filter(r => r.type === 'Cafe' || r.type === 'Dhaba').slice(0, 8),
        [filteredRestaurants]
    );

    const newRestaurants = useMemo(() =>
        filteredRestaurants.slice(-8).reverse(),
        [filteredRestaurants]
    );

    // --- Compact Restaurant Card (for carousels) ---
    const CompactCard = ({ restaurant, isNew = false }: { restaurant: any; isNew?: boolean }) => (
        <TouchableOpacity
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Storefront', { storeId: restaurant.id });
            }}
            className="mr-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            style={{ width: 240 }}
            activeOpacity={0.9}
        >
            {/* Image with gradient overlay */}
            <View className="relative" style={{ height: 170 }}>
                <Image source={{ uri: restaurant.image }} className="w-full h-full" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.35)']}
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }}
                />
                {/* Rating badge */}
                <View className="absolute top-3 right-3 bg-gray-800/90 px-2.5 py-1 rounded-full flex-row items-center">
                    <Star size={10} color="#FBBF24" fill="#FBBF24" />
                    <Text className="text-[11px] font-bold text-white ml-1">{restaurant.rating}</Text>
                </View>
                {/* Cuisine tag */}
                <View className="absolute bottom-3 left-3 bg-gray-900/80 px-2.5 py-1 rounded-lg">
                    <Text className="text-[10px] font-bold text-white">{restaurant.cuisine}</Text>
                </View>
                {/* NEW badge */}
                {isNew && (
                    <View className="absolute top-3 left-3 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200">
                        <Text className="text-[9px] font-extrabold text-purple-600 uppercase tracking-wider">NEW</Text>
                    </View>
                )}
                {/* Pure Veg Badge */}
                {restaurant.isVeg && (
                    <View className="absolute top-3 left-3 bg-white px-1.5 py-1 rounded-md shadow-sm border border-green-100 flex-row items-center" style={isNew ? { top: 32 } : {}}>
                        <View className="w-2.5 h-2.5 border border-green-600 items-center justify-center mr-1" style={{ borderWidth: 1 }}>
                            <View className="w-1 h-1 rounded-full bg-green-600" />
                        </View>
                        <Text className="text-[8px] font-bold text-green-700 uppercase">Pure Veg</Text>
                    </View>
                )}
            </View>
            {/* Info */}
            <View className="p-4">
                <Text className="text-[15px] font-bold text-gray-900" numberOfLines={1}>{restaurant.name}</Text>
                <Text className="text-[12px] text-gray-500 font-medium" style={{ marginTop: 6 }}>{restaurant.type} • {restaurant.distance}</Text>
                {/* Action Buttons */}
                <View className="flex-row gap-2" style={{ marginTop: 6 }}>
                    <TouchableOpacity
                        className="flex-1 h-10 rounded-xl border border-gray-200 flex-row items-center justify-center"
                        onPress={() => openBooking(restaurant)}
                    >
                        <Calendar size={14} color="#374151" />
                        <Text className="text-[12px] font-bold text-gray-700 ml-1.5">Book</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-1 h-10 rounded-xl bg-[#B52725] flex-row items-center justify-center"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Storefront', { storeId: restaurant.id });
                        }}
                    >
                        <UtensilsCrossed size={14} color="#FFFFFF" />
                        <Text className="text-[12px] font-bold text-white ml-1.5">Order</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    // --- Full-Width Restaurant Card (for All Restaurants) ---
    const FullCard = ({ restaurant }: { restaurant: any }) => (
        <TouchableOpacity
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Storefront', { storeId: restaurant.id });
            }}
            className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden mb-5"
            activeOpacity={0.9}
        >
            {/* Image */}
            <View className="relative" style={{ height: 200 }}>
                <Image source={{ uri: restaurant.image }} className="w-full h-full" />
                {/* Rating badge */}
                <View className="absolute top-4 right-4 bg-gray-800/90 px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                    <Star size={12} color="#FBBF24" fill="#FBBF24" />
                    <Text className="text-[12px] font-bold text-white ml-1">{restaurant.rating}</Text>
                </View>
                {/* Cuisine tag */}
                <View className="absolute bottom-4 left-4 flex-row items-center gap-2">
                    <View className="bg-gray-900/80 px-3 py-1.5 rounded-lg">
                        <Text className="text-[11px] font-bold text-white">{restaurant.cuisine}</Text>
                    </View>
                    {restaurant.isVeg && (
                        <View className="bg-white px-2 py-1.5 rounded-lg flex-row items-center border border-green-50 shadow-sm">
                            <View className="w-2.5 h-2.5 border border-green-600 items-center justify-center mr-1.5" style={{ borderWidth: 1 }}>
                                <View className="w-1 h-1 rounded-full bg-green-600" />
                            </View>
                            <Text className="text-[10px] font-bold text-green-600 uppercase">Pure Veg</Text>
                        </View>
                    )}
                </View>
            </View>
            {/* Info */}
            <View className="px-5 pt-5 pb-4">
                <View className="flex-row justify-between items-start">
                    <Text className="text-[18px] font-bold text-gray-900 flex-1" numberOfLines={1}>{restaurant.name}</Text>
                    <Text className="text-[13px] font-semibold text-gray-500 ml-3">{restaurant.distance}</Text>
                </View>
                <Text className="text-[12px] font-semibold text-[#B52725]" style={{ marginTop: 8 }}>{restaurant.type}</Text>
                <Text className="text-[12px] text-gray-500 font-medium" style={{ marginTop: 8 }} numberOfLines={1}>{restaurant.address}</Text>
                {/* Action Buttons */}
                <View className="flex-row gap-3" style={{ marginTop: 6 }}>
                    <TouchableOpacity
                        className="flex-1 h-12 rounded-xl border border-gray-200 flex-row items-center justify-center"
                        onPress={() => openBooking(restaurant)}
                    >
                        <Calendar size={15} color="#374151" />
                        <Text className="text-[13px] font-bold text-gray-700 ml-2">Book Table</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-1 h-12 rounded-xl bg-[#B52725] flex-row items-center justify-center"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Storefront', { storeId: restaurant.id });
                        }}
                    >
                        <UtensilsCrossed size={15} color="#FFFFFF" />
                        <Text className="text-[13px] font-bold text-white ml-2">Pre-order</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );


    // --- Section Header Component ---
    const SectionHeader = ({ icon: Icon, title, iconColor = '#1F2937' }: { icon: any; title: string; iconColor?: string }) => (
        <View className="flex-row items-center px-5 mb-4 mt-2">
            <Icon size={22} color={iconColor} strokeWidth={2} />
            <Text className="text-xl font-bold text-gray-900 ml-2">{title}</Text>
        </View>
    );

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            {/* Sticky Header — Matching Home Screen */}
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

                {/* Search Bar & Veg Filter */}
                <View className="flex-row items-center">
                    <View className="flex-1 h-12 bg-white rounded-xl border border-gray-200 shadow-sm flex-row items-center px-4">
                        <Search size={18} color="#000" />
                        <TextInput
                            className="flex-1 ml-3 font-semibold text-sm text-gray-800"
                            placeholder="Search for 'Biryani' or 'Bistro'..."
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

            <ScrollView className="flex-1 bg-[#F8F9FA]" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

                {/* Cuisine Filter Pills */}
                <View className="mt-5 px-5 mb-6">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {CUISINE_FILTERS.map((cuisine) => (
                            <TouchableOpacity
                                key={cuisine}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setSelectedCuisine(cuisine);
                                }}
                                className={`rounded-full py-2.5 px-5 mr-3 ${selectedCuisine === cuisine
                                    ? 'bg-[#B52725]'
                                    : 'bg-white border border-gray-200'
                                    }`}
                            >
                                <Text className={`text-[13px] font-bold ${selectedCuisine === cuisine ? 'text-white' : 'text-gray-800'
                                    }`}>
                                    {cuisine}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ===== DINING SPOTLIGHTS ===== */}
                <View className="mb-8">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                        {DINING_SPOTLIGHTS.map((spot) => (
                            <TouchableOpacity
                                key={spot.id}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    navigation.navigate('SpotlightDetail', { spotlightId: spot.id });
                                }}
                                className="mr-4 rounded-[20px] overflow-hidden"
                                style={{ width: width * 0.44, height: 240 }}
                                activeOpacity={0.9}
                            >
                                <Image source={{ uri: spot.image }} className="absolute w-full h-full" />
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, padding: 14, justifyContent: 'space-between' }}
                                >
                                    {/* Badge */}
                                    <View className="bg-white/90 rounded-full px-3 py-1.5 self-start">
                                        <Text className="text-[10px] font-bold text-gray-800">{spot.badge}</Text>
                                    </View>
                                    {/* Title & Subtitle */}
                                    <View>
                                        <Text className="text-lg font-bold text-white leading-tight">{spot.title}</Text>
                                        <Text className="text-[11px] font-medium mt-1" style={{ color: 'rgba(255,255,255,0.9)' }}>{spot.subtitle}</Text>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>



                {/* ===== TOP RATED ===== */}
                {topRated.length > 0 && (
                    <View className="mb-8">
                        <SectionHeader icon={Star} title="Top Rated" iconColor="#FBBF24" />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                            {topRated.map((r) => <CompactCard key={`top-${r.id}`} restaurant={r} />)}
                        </ScrollView>
                    </View>
                )}

                {/* ===== FINE DINING ===== */}
                {fineDining.length > 0 && (
                    <View className="mb-8">
                        <SectionHeader icon={Sparkles} title="Fine Dining" />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                            {fineDining.map((r) => <CompactCard key={`fine-${r.id}`} restaurant={r} />)}
                        </ScrollView>
                    </View>
                )}

                {/* ===== QUICK SERVICE ===== */}
                {quickService.length > 0 && (
                    <View className="mb-8">
                        <SectionHeader icon={Clock} title="Quick Service" />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                            {quickService.map((r) => <CompactCard key={`quick-${r.id}`} restaurant={r} />)}
                        </ScrollView>
                    </View>
                )}

                {/* ===== NEW RESTAURANTS ===== */}
                {newRestaurants.length > 0 && (
                    <View className="mb-8">
                        <SectionHeader icon={BadgeCheck} title="New Restaurants" iconColor="#7C3AED" />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                            {newRestaurants.map((r) => <CompactCard key={`new-${r.id}`} restaurant={r} isNew />)}
                        </ScrollView>
                    </View>
                )}

                {/* ===== ALL RESTAURANTS ===== */}
                <View className="mb-8">
                    <SectionHeader icon={UtensilsCrossed} title="All Restaurants" />
                    <View className="px-5">
                        {filteredRestaurants.length > 0 ? (
                            <>
                                <Text className="text-[12px] font-medium text-gray-400 mt-[-10px] mb-5">{filteredRestaurants.length} places found</Text>
                                {filteredRestaurants.map((r) => <FullCard key={`all-${r.id}`} restaurant={r} />)}
                            </>
                        ) : (
                            <View className="items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                <Search size={48} color="#E5E7EB" strokeWidth={1} />
                                <Text className="text-gray-900 font-bold text-lg mt-4">No restaurants found</Text>
                                <Text className="text-gray-400 text-sm mt-1">Try searching for something else</Text>
                            </View>
                        )}
                    </View>
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            <CartSummaryBar itemCount={getItemCount()} totalAmount={getTotal()} />

            {bookingRestaurant && (
                <BookingModal
                    visible={bookingVisible}
                    onClose={() => setBookingVisible(false)}
                    restaurant={bookingRestaurant}
                />
            )}

            {/* Custom Veg Preference Modal (Premium UI) */}
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
                                Choose your dining preference to filter out all non-vegetarian options across the platform.
                            </Text>

                            {/* Option 1: All */}
                            <TouchableOpacity
                                onPress={() => {
                                    setVegFilter('all');
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={`flex-row items-center p-3.5 rounded-2xl mb-3 border-2 ${vegFilter === 'all' ? 'border-amber-400 bg-amber-100' : 'border-gray-100 bg-white'
                                    }`}
                                activeOpacity={0.8}
                            >
                                <View className={`w-9 h-9 rounded-xl items-center justify-center ${vegFilter === 'all' ? 'bg-amber-400' : 'bg-gray-50'}`}>
                                    <UtensilsCrossed size={16} color={vegFilter === 'all' ? 'white' : '#9CA3AF'} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className={`text-[14px] font-bold ${vegFilter === 'all' ? 'text-gray-900' : 'text-gray-600'}`}>Show All</Text>
                                    <Text className="text-[10px] text-gray-400 font-medium">Both Veg & Non-Veg options</Text>
                                </View>
                                {vegFilter === 'all' && <Check size={18} color="#F59E0B" />}
                            </TouchableOpacity>

                            {/* Option 2: Pure Veg */}
                            <TouchableOpacity
                                onPress={() => {
                                    setVegFilter('veg');
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={`flex-row items-center p-3.5 rounded-2xl border-2 ${vegFilter === 'veg' ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white'
                                    }`}
                                activeOpacity={0.8}
                            >
                                <View className={`w-9 h-9 rounded-xl items-center justify-center ${vegFilter === 'veg' ? 'bg-green-500' : 'bg-gray-50'}`}>
                                    <View className="w-3.5 h-3.5 border border-white items-center justify-center" style={{ borderWidth: 1 }}>
                                        <View className="w-1.5 h-1.5 rounded-full bg-white" />
                                    </View>
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className={`text-[14px] font-bold ${vegFilter === 'veg' ? 'text-gray-900' : 'text-gray-600'}`}>Pure Veg Only</Text>
                                    <Text className="text-[10px] text-gray-400 font-medium">Exclusively vegetarian restaurants</Text>
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
                                <Text className="text-white font-bold uppercase tracking-widest text-[13px]">Apply Preference</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
