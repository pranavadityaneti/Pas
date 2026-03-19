// Pickup Discovery Screen (UX Overhauled): Hyper-local venue discovery, distance badges, curated sections.
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, User, ChevronRight, Star, Clock, ArrowRight } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { STORES, RESTAURANTS, STORE_CATEGORIES } from '../lib/data';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useLocation } from '../context/LocationContext';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import { useCart } from '../context/CartContext';
import CartSummaryBar from '../components/CartSummaryBar';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

type FilterType = 'nearest' | 'top_rated' | 'food' | 'grocery' | 'bakery';

export default function HomeFeedScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { activeLocation, isLoadingLocation } = useLocation();
    const [profile, setProfile] = useState<any>(null);
    const [searchText, setSearchText] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('nearest');

    const { items, getTotal } = useCart();

    const getTimeBadgeColor = (distanceStr: string) => {
        const dist = parseFloat(distanceStr) || 0;
        if (dist < 3) return '#16A34A'; // Green
        if (dist <= 5) return '#D97706'; // Yellow
        return '#DC2626'; // Red
    };

    useEffect(() => {
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                setProfile(null);
            } else {
                fetchProfile(session.user.id);
            }
        });

        const profileSubscription = supabase
            .channel('profile-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                supabase.auth.getSession().then(({ data }) => {
                    if (data.session) fetchProfile(data.session.user.id);
                });
            })
            .subscribe();

        return () => {
            authSubscription.unsubscribe();
            supabase.removeChannel(profileSubscription);
        };
    }, []);

    const fetchProfile = async (userId: string) => {
        try {
            let profileTimerId: any;
            const profileTimeout = new Promise((_, reject) => {
                profileTimerId = setTimeout(() => reject(new Error('timeout')), 5000);
            });

            const { data, error } = await Promise.race([
                supabase.from('profiles').select('avatar_url').eq('id', userId).single(),
                profileTimeout
            ]).finally(() => clearTimeout(profileTimerId)) as any;

            if (data?.avatar_url) {
                // Append a timestamp to the URL to bypass React Native's aggressive Image cache
                data.avatar_url = `${data.avatar_url}?v=${Date.now()}`;
            }
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile avatar:', error);
            setProfile(null);
        }
    };

    // --- Venues Data Logic ---
    const allVenues = useMemo(() => {
        let list = [
            ...RESTAURANTS.map(r => ({ ...r, isRestaurant: true, rawDist: parseFloat(r.distance) })),
            ...STORES.map(s => ({ ...s, isRestaurant: false, rawDist: parseFloat(s.distance) }))
        ];

        // Apply filters
        if (activeFilter === 'nearest') {
            list.sort((a, b) => a.rawDist - b.rawDist);
        } else if (activeFilter === 'top_rated') {
            list.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
        } else if (activeFilter === 'grocery') {
            list = list.filter(v => (v as any).category === 'grocery');
        } else if (activeFilter === 'food') {
            list = list.filter(v => v.isRestaurant);
        } else if (activeFilter === 'bakery') {
            list = list.filter(v => (v as any).category === 'bakery');
        }

        // Apply search mapping
        if (searchText) {
            const query = searchText.toLowerCase();
            list = list.filter(v =>
                v.name.toLowerCase().includes(query) ||
                ((v as any).cuisine && (v as any).cuisine.toLowerCase().includes(query)) ||
                ((v as any).category && (v as any).category.toLowerCase().includes(query))
            );
        }

        // Fallback sort by distance if not explicitly sorting by something else
        if (activeFilter !== 'nearest' && activeFilter !== 'top_rated') {
            list.sort((a, b) => a.rawDist - b.rawDist);
        }

        return list;
    }, [activeFilter, searchText]);

    // (Quick Grab & Go removed — replaced by store-level curated sections)

    // Curated store sections
    const trendingStores = useMemo(() => {
        return allVenues.filter(v => parseFloat(v.rating) >= 4.0 && v.rawDist <= 5).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 6);
    }, [allVenues]);

    const readyIn10 = useMemo(() => {
        return allVenues.filter(v => {
            const prepMinutes = parseInt((v as any).prepTime || '30');
            return prepMinutes <= 10;
        }).sort((a, b) => a.rawDist - b.rawDist).slice(0, 6);
    }, [allVenues]);

    const dealsStores = useMemo(() => {
        return allVenues.filter(v => {
            const products = (v as any).products || [];
            return products.some((p: any) => p.discount > 0);
        }).slice(0, 6);
    }, [allVenues]);

    const filters: { id: FilterType, label: string, ionicon: string }[] = [
        { id: 'nearest', label: 'Nearest', ionicon: 'location' },
        { id: 'top_rated', label: 'Top Rated', ionicon: 'star' },
        { id: 'food', label: 'Restaurants', ionicon: 'storefront' },
        { id: 'grocery', label: 'Groceries', ionicon: 'cart' },
        { id: 'bakery', label: 'Coffee & Bites', ionicon: 'cafe' },
    ];

    const StandardVenueCard = ({ venue, tagType }: { venue: any, tagType?: 'trending' | 'fast' | 'deal' }) => (
        <TouchableOpacity
            delayPressIn={0}
            key={venue.id}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate('Storefront', { storeId: venue.id as any });
            }}
            style={{ width: width * 0.75 }}
            className="mr-4 rounded-[28px] bg-white border border-gray-100 overflow-hidden shadow-sm"
        >
            <View className="h-[140px] relative">
                <Image source={{ uri: venue.image }} className="w-full h-full object-cover" />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />

                {/* Distance Badge (Top Right) */}
                <View className="absolute top-3 right-3 bg-white/95 px-2.5 py-1.5 rounded-xl flex-row items-center shadow-sm">
                    <Ionicons name="location" size={12} color="#B52725" />
                    <Text className="text-[11px] font-bold text-gray-900 ml-1">{venue.distance}</Text>
                </View>

                {/* Optional Custom Tags (Top/Bottom Left) */}
                {tagType === 'deal' && (
                    <View className="absolute top-3 left-3 bg-red-500 px-2 py-0.5 rounded-md">
                        <Text className="text-[10px] font-extrabold text-white">OFFER</Text>
                    </View>
                )}
            </View>
            <View className="p-4">
                <View className="flex-row justify-between items-start mb-2">
                    <Text className="text-[16px] font-bold text-gray-900 flex-1 pr-2" numberOfLines={1}>{venue.name}</Text>
                    <View className="flex-row items-center bg-gray-50 px-1.5 py-0.5 rounded-lg border border-gray-100">
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text className="text-[11px] font-bold text-gray-800 ml-1">{venue.rating}</Text>
                    </View>
                </View>
                <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-medium text-gray-500 capitalize" numberOfLines={1}>
                        {venue.isRestaurant ? (venue as any).cuisine : (venue as any).category}
                    </Text>
                    <View className="flex-row items-center px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${getTimeBadgeColor((venue as any).distance)}18` }}>
                        <Clock size={11} color={getTimeBadgeColor((venue as any).distance)} />
                        <Text className="text-[11px] font-bold ml-1" style={{ color: getTimeBadgeColor((venue as any).distance) }}>
                            {(venue as any).prepTime || '10-15 mins'}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            {/* Sticky Header */}
            <View className="px-6 pt-2 pb-3 bg-white z-20 overflow-visible">
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
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            (navigation as any).navigate('Profile');
                        }}
                        className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center border border-gray-200 overflow-hidden"
                    >
                        {profile?.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                        ) : (
                            <User size={22} color="#9CA3AF" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View className="flex-row items-center mb-4">
                    <View className="flex-1 flex-row items-center px-4 h-12 bg-gray-50 rounded-2xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-3 font-semibold text-[14px] text-gray-800"
                            style={{ paddingVertical: 0, height: 20, lineHeight: 20 }}
                            placeholder="Find places to pick up near you..."
                            placeholderTextColor="#9CA3AF"
                            value={searchText}
                            onChangeText={setSearchText}
                        />
                    </View>
                </View>

                {/* Quick Action Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible">
                    {filters.map(filter => {
                        const isActive = activeFilter === filter.id;
                        return (
                            <TouchableOpacity
                                delayPressIn={0}
                                key={filter.id}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setActiveFilter(filter.id);
                                }}
                                className={`flex-row items-center px-4 h-9 rounded-full mr-2 border ${isActive
                                    ? 'bg-[#B52725] border-[#B52725]'
                                    : 'bg-white border-gray-200 shadow-sm'
                                    }`}
                            >
                                <Ionicons name={isActive ? filter.ionicon as any : `${filter.ionicon}-outline` as any} size={14} color={isActive ? '#FFFFFF' : '#4B5563'} />
                                <Text className={`ml-1.5 font-bold text-[12px] ${isActive ? 'text-white' : 'text-gray-700'}`}>
                                    {filter.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <ScrollView className="flex-1 bg-[#F8F9FA]" contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }} showsVerticalScrollIndicator={false}>

                {/* Categories Section */}
                <View className="mb-8 mt-2">
                    <View className="px-6 mb-4">
                        <Text className="text-[18px] font-extrabold text-gray-900 tracking-tight">Shop by Category</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 24 }}
                    >
                        {STORE_CATEGORIES.map((category) => {
                            const colorClass = category.color.split(' ')[0];

                            return (
                                <TouchableOpacity
                                    delayPressIn={0}
                                    key={category.id}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        navigation.navigate('CategoryDetail', {
                                            categoryId: category.id,
                                            categoryName: category.name
                                        });
                                    }}
                                    className="items-center mr-5"
                                >
                                    <View className={`w-[72px] h-[72px] rounded-full ${colorClass} items-center justify-center mb-2 shadow-sm border border-black/5`}>
                                        <Ionicons name={category.ionicon as any} size={30} color={category.iconColor} />
                                    </View>
                                    <Text className="text-[12px] font-bold text-gray-800 text-center">{category.name}</Text>
                                    <Text className="text-[10px] font-medium text-gray-400 text-center mt-0.5">{category.sub}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Nearest Feature: Horizontal Cards */}
                {activeFilter === 'nearest' && !searchText && (
                    <View className="mb-8">
                        <View className="px-6 mb-4 flex-row justify-between items-end">
                            <Text className="text-[20px] font-extrabold text-gray-900 tracking-tight">Closest to You</Text>
                            <ArrowRight size={20} color="#B52725" />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6" snapToInterval={width * 0.75 + 16} snapToAlignment="start" decelerationRate="fast">
                            {allVenues.slice(0, 5).map((venue) => (
                                <StandardVenueCard key={venue.id} venue={venue} />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* ===== CURATED SECTIONS ===== */}
                {(!searchText && activeFilter === 'nearest') && trendingStores.length > 0 && (
                    <View className="mb-8">
                        <View className="px-6 mb-4 flex-row justify-between items-end">
                            <View>
                                <Text className="text-[18px] font-extrabold text-gray-900 tracking-tight">🔥 Trending Near You</Text>
                                <Text className="text-gray-500 text-[12px] font-medium mt-0.5">Highest rated within 5 km</Text>
                            </View>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6" snapToInterval={width * 0.75 + 16} snapToAlignment="start" decelerationRate="fast">
                            {trendingStores.map((venue) => (
                                <StandardVenueCard key={`trending-${venue.id}`} venue={venue} tagType="trending" />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {(!searchText && activeFilter === 'nearest') && readyIn10.length > 0 && (
                    <View className="mb-8">
                        <View className="px-6 mb-4">
                            <Text className="text-[18px] font-extrabold text-gray-900 tracking-tight">⚡ Ready in 10 Minutes</Text>
                            <Text className="text-gray-500 text-[12px] font-medium mt-0.5">Grab & go — almost instant</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6" snapToInterval={width * 0.75 + 16} snapToAlignment="start" decelerationRate="fast">
                            {readyIn10.map((venue) => (
                                <StandardVenueCard key={`fast-${venue.id}`} venue={venue} tagType="fast" />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {(!searchText && activeFilter === 'nearest') && dealsStores.length > 0 && (
                    <View className="mb-8">
                        <View className="px-6 mb-4">
                            <Text className="text-[18px] font-extrabold text-gray-900 tracking-tight">🏷️ Deals of the Day</Text>
                            <Text className="text-gray-500 text-[12px] font-medium mt-0.5">Stores with active discounts</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6" snapToInterval={width * 0.75 + 16} snapToAlignment="start" decelerationRate="fast">
                            {dealsStores.map((venue) => (
                                <StandardVenueCard key={`deal-${venue.id}`} venue={venue} tagType="deal" />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* All Venues Feed */}
                <View className="px-5">
                    <Text className="text-[20px] font-extrabold text-gray-900 tracking-tight mb-5 px-1">
                        {searchText ? 'Search Results' : 'All Nearby Places'}
                    </Text>

                    {allVenues.length > 0 ? (
                        allVenues.map((venue, index) => (
                            <TouchableOpacity
                                delayPressIn={0}
                                key={venue.id}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    navigation.navigate('Storefront', { storeId: venue.id as any });
                                }}
                                className="mb-5 bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden"
                            >
                                <View className="h-[160px] w-full relative">
                                    <Image source={{ uri: venue.image }} className="w-full h-full" />
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                    />

                                    {/* Top Right Badges */}
                                    <View className="absolute top-3 right-3 flex-row gap-2">
                                        <View className="bg-white/95 px-2.5 py-1.5 rounded-xl flex-row items-center shadow-sm">
                                            <Ionicons name="location" size={12} color="#B52725" />
                                            <Text className="text-[11px] font-bold text-gray-900 ml-1">{venue.distance}</Text>
                                        </View>
                                    </View>

                                    {/* Bottom Info inside image */}
                                    <View className="absolute bottom-4 left-4 right-4 flex-row justify-between items-end">
                                        <View className="flex-1 pr-4">
                                            <Text className="text-white font-extrabold text-[20px] shadow-sm mb-1" numberOfLines={1}>{venue.name}</Text>
                                            <Text className="text-white/90 font-medium text-[13px] capitalize" numberOfLines={1}>
                                                {venue.isRestaurant ? (venue as any).cuisine : (venue as any).category} • {venue.address?.split(',')[1]?.trim() || 'Nearby'}
                                            </Text>
                                        </View>
                                        <View className="px-3 py-1.5 rounded-xl flex-row items-center shadow-sm" style={{ backgroundColor: getTimeBadgeColor((venue as any).distance) }}>
                                            <Clock size={12} color="#FFFFFF" />
                                            <Text className="text-[12px] font-bold text-white ml-1.5">{(venue as any).prepTime || '15 mins'}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Order Again / Highlights Bar */}
                                <View className="px-4 py-3 flex-row justify-between items-center bg-gray-50/50">
                                    <View className="flex-row items-center">
                                        <Star size={14} color="#F59E0B" fill="#F59E0B" />
                                        <Text className="text-[12px] font-bold text-gray-700 ml-1.5">{venue.rating}</Text>
                                        <Text className="text-[12px] text-gray-400 mx-2">•</Text>
                                        <Text className="text-[12px] font-semibold text-gray-500">Pick up here</Text>
                                    </View>
                                    <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                                        <ArrowRight size={16} color="#B52725" />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View className="py-12 items-center justify-center">
                            <Ionicons name="storefront-outline" size={48} color="#E5E7EB" />
                            <Text className="text-gray-900 text-[16px] font-bold mt-4">No places found</Text>
                            <Text className="text-gray-400 text-[13px] font-medium mt-1 text-center px-10">Try adjusting your filters or location to discover more venues.</Text>
                        </View>
                    )}
                </View>

            </ScrollView>

            <CartSummaryBar itemCount={items.length} totalAmount={getTotal()} />
        </SafeAreaView>
    );
}
