// @lock — Do NOT overwrite. Approved redesign as of Feb 27, 2026.
// Dining Screen: Spotlights, 4 category carousels, All Restaurants vertical list.
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronRight, Star, Clock, Sparkles, BadgeCheck, Mic, User, Calendar, UtensilsCrossed, X, Check, WifiOff } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import GlobalHeader from '../components/GlobalHeader';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import CartSummaryBar from '../components/CartSummaryBar';
import BookingModal from '../components/BookingModal';
import { useStores } from '../hooks/useStores';
import { useGlobalSearch, SearchResultStore } from '../hooks/useGlobalSearch';
import { ActivityIndicator } from 'react-native';
import { getStoreImageUrl } from '../utils/storageUrl';
import { checkIsOpen } from '../utils/dataTransformer';
import SearchResults from '../components/SearchResults';
import StoreFilterModal, { StoreModalFilters, DEFAULT_MODAL_FILTERS } from '../components/StoreFilterModal';
import { Filter } from 'lucide-react-native';

const { width } = Dimensions.get('window');

// --- Spotlight Cards Data ---
export const DINING_SPOTLIGHTS = [
    {
        id: 1,
        image: require('../../assets/images/banners/dining1.png'),
    },
    {
        id: 2,
        image: require('../../assets/images/banners/dining2.png'),
    },
    {
        id: 3,
        image: require('../../assets/images/banners/dining3.jpg'),
    },
    {
        id: 4,
        image: require('../../assets/images/banners/dining4.jpg'),
    },
    {
        id: 5,
        image: require('../../assets/images/banners/dining5.jpg'),
    },
];

// --- Cuisine Filters ---
const CUISINE_FILTERS = ['All', 'North Indian', 'South Indian', 'Chinese', 'Street Food', 'Mughlai', 'Continental', 'Italian', 'Multi-Cuisine'];

export default function DiningScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { getItemCount, getTotal } = useCart();
    const [searchText, setSearchText] = useState('');
    const [selectedCuisine, setSelectedCuisine] = useState('All');
    const { diningStores, loading, error: storesError } = useStores();
    const { activeLocation, isLoadingLocation, refreshLocation } = useLocation();
    const [bookingVisible, setBookingVisible] = useState(false);
    const [bookingRestaurant, setBookingRestaurant] = useState<any>(null);
    const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
    const [vegModalVisible, setVegModalVisible] = useState(false);
    const [storeFilterVisible, setStoreFilterVisible] = useState(false);
    const [storeFilters, setStoreFilters] = useState<StoreModalFilters>({ ...DEFAULT_MODAL_FILTERS });

    // --- Global Search (Postgres RPC) ---
    const { results: searchResults, allMatchedProducts, isLoading: isSearchLoading } = useGlobalSearch(
        searchText,
        activeLocation?.latitude,
        activeLocation?.longitude,
        'dining'
    );

    const openBooking = (restaurant: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setBookingRestaurant(restaurant);
        setBookingVisible(true);
    };



    // --- Filtered & Categorized Restaurants ---
    const filteredRestaurants = useMemo(() => {
        // If search is active, use Postgres RPC results instead of local filtering
        if (searchText.trim()) {
            return searchResults.map(s => ({
                id: s.branch_id,
                name: s.branch_name,
                address: s.address || 'Address not available',
                image: getStoreImageUrl(s.store_photos?.[0]),
                rating: null,
                distance: s.distance_meters >= 1000
                    ? `${(s.distance_meters / 1000).toFixed(1)} km`
                    : `${Math.round(s.distance_meters)} m`,
                category: s.vertical_name || 'Restaurants & Cafes',
                isDining: true,
                isRestaurant: true,
                isOpen: checkIsOpen(s.is_active ?? true, s.operating_hours, s.prep_time_minutes || 15),
                cuisine: s.vertical_name || 'Multi-Cuisine',
                type: 'Casual Dining',
                products: s.matched_products || [],
                prepTime: s.prep_time_minutes ? `${s.prep_time_minutes} mins` : '30 mins',
                merchantId: s.merchant_id,
                operating_hours: s.operating_hours,
                isVeg: false,
                serviceTableBooking: s.service_table_booking ?? false,
            }));
        }

        let list = [...diningStores];
        if (selectedCuisine !== 'All') {
            list = list.filter(r => (r as any).cuisines?.includes(selectedCuisine));
        }
        if (vegFilter === 'veg') {
            list = list.filter(r => r.isVeg);
        } else if (vegFilter === 'nonveg') {
            list = list.filter(r => !r.isVeg);
        }

        // Apply StoreFilterModal filters
        if (storeFilters.openNow) list = list.filter(r => r.isOpen);
        if (storeFilters.pureVeg) list = list.filter(r => r.isVeg);
        if (storeFilters.maxDistance) list = list.filter(r => (r as any).rawDist != null && (r as any).rawDist <= storeFilters.maxDistance! * 1000);
        if (storeFilters.sortBy === 'distance') list.sort((a, b) => ((a as any).rawDist || 99999) - ((b as any).rawDist || 99999));
        else if (storeFilters.sortBy === 'prep_time') list.sort((a, b) => (parseInt(a.prepTime || '99') || 99) - (parseInt(b.prepTime || '99') || 99));

        return list;
    }, [selectedCuisine, vegFilter, searchText, diningStores, searchResults, storeFilters]);

    const topRated = useMemo(() => {
        const withRating = filteredRestaurants.filter(r => r.rating && parseFloat(r.rating) > 0);
        return withRating.sort((a, b) => parseFloat(b.rating!) - parseFloat(a.rating!)).slice(0, 8);
    }, [filteredRestaurants]);

    const fineDining = useMemo(() =>
        filteredRestaurants.filter(r => r.type === 'Fine Dining').slice(0, 8),
        [filteredRestaurants]
    );

    const quickService = useMemo(() =>
        filteredRestaurants.filter(r => r.type === 'Cafe' || r.type === 'Dhaba' || r.type === 'Quick Service').slice(0, 8),
        [filteredRestaurants]
    );

    const newRestaurants = useMemo(() =>
        filteredRestaurants.slice(-8).reverse(),
        [filteredRestaurants]
    );

    if (loading && diningStores.length === 0) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#B52725" />
            </SafeAreaView>
        );
    }

    // --- Compact Restaurant Card (for carousels) ---
    const CompactCard = ({ restaurant, isNew = false }: { restaurant: any; isNew?: boolean }) => (
        <TouchableOpacity
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Storefront', { storeId: restaurant.id, orderMode: 'dining' });
            }}
            className={`mr-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${!restaurant.isOpen ? 'opacity-70' : ''}`}
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
                {/* Offline Overlay */}
                {!restaurant.isOpen && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                        <View className="bg-black/80 px-3 py-1.5 rounded-full border border-white/20">
                            <Text className="text-white text-[11px] font-bold tracking-wider uppercase">Currently Offline</Text>
                        </View>
                    </View>
                )}
                {/* Rating badge */}
                <View className="absolute top-3 right-3 bg-gray-800/90 px-2.5 py-1 rounded-full flex-row items-center">
                    {restaurant.rating ? (
                        <>
                            <Star size={10} color="#FBBF24" fill="#FBBF24" />
                            <Text className="text-[11px] font-bold text-white ml-1">{restaurant.rating}</Text>
                        </>
                    ) : (
                        <Text className="text-[9px] font-extrabold text-blue-400 uppercase">NEW</Text>
                    )}
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
                    {restaurant.serviceTableBooking && (
                        <TouchableOpacity
                            className="flex-1 h-10 rounded-xl border border-gray-200 flex-row items-center justify-center"
                            onPress={() => openBooking(restaurant)}
                        >
                            <Calendar size={14} color="#374151" />
                            <Text className="text-[12px] font-bold text-gray-700 ml-1.5">Book</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        className="flex-1 h-10 rounded-xl bg-[#B52725] flex-row items-center justify-center"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Storefront', { storeId: restaurant.id, orderMode: 'dining' });
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
                navigation.navigate('Storefront', { storeId: restaurant.id, orderMode: 'dining' });
            }}
            className={`bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden mb-5 ${!restaurant.isOpen ? 'opacity-70' : ''}`}
            activeOpacity={0.9}
        >
            {/* Image */}
            <View className="relative" style={{ height: 200 }}>
                <Image source={{ uri: restaurant.image }} className="w-full h-full" />
                {/* Offline Overlay */}
                {!restaurant.isOpen && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                        <View className="bg-black/80 px-3 py-1.5 rounded-full border border-white/20">
                            <Text className="text-white text-[12px] font-bold tracking-wider uppercase">Currently Offline</Text>
                        </View>
                    </View>
                )}
                {/* Rating badge */}
                <View className="absolute top-4 right-4 bg-gray-800/90 px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                    {restaurant.rating ? (
                        <>
                            <Star size={12} color="#FBBF24" fill="#FBBF24" />
                            <Text className="text-[12px] font-bold text-white ml-1">{restaurant.rating}</Text>
                        </>
                    ) : (
                        <Text className="text-[10px] font-extrabold text-blue-400 uppercase">NEW</Text>
                    )}
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
                    {restaurant.serviceTableBooking && (
                        <TouchableOpacity
                            className="flex-1 h-12 rounded-xl border border-gray-200 flex-row items-center justify-center"
                            onPress={() => openBooking(restaurant)}
                        >
                            <Calendar size={15} color="#374151" />
                            <Text className="text-[13px] font-bold text-gray-700 ml-2">Book Table</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        className="flex-1 h-12 rounded-xl bg-[#B52725] flex-row items-center justify-center"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Storefront', { storeId: restaurant.id, orderMode: 'dining' });
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
            <GlobalHeader 
                searchText={searchText} 
                onSearchChange={setSearchText} 
                searchPlaceholder="Search for 'Biryani' or 'Bistro'..."
                rightContent={
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStoreFilterVisible(true); }}
                            className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center border border-gray-200 relative"
                        >
                            <Filter size={18} color="#4B5563" />
                            {(storeFilters.sortBy !== 'relevance' || storeFilters.maxDistance !== null || storeFilters.openNow || storeFilters.pureVeg || storeFilters.priceMin > 0 || storeFilters.priceMax < 1000) && (
                                <View style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#B52725' }} />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                // Cycle: all → veg → nonveg → all
                                const next = vegFilter === 'all' ? 'veg' : vegFilter === 'veg' ? 'nonveg' : 'all';
                                setVegFilter(next);
                            }}
                            activeOpacity={0.8}
                            style={{
                                width: 52,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: vegFilter === 'veg' ? '#DEF7EC' : vegFilter === 'nonveg' ? '#FEE2E2' : '#F3F4F6',
                                borderWidth: 1,
                                borderColor: vegFilter === 'veg' ? '#6EE7B7' : vegFilter === 'nonveg' ? '#FCA5A5' : '#D1D5DB',
                                justifyContent: 'center',
                                paddingHorizontal: 2,
                            }}
                        >
                            <View
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    backgroundColor: vegFilter === 'veg' ? '#16A34A' : vegFilter === 'nonveg' ? '#DC2626' : '#9CA3AF',
                                    alignSelf: vegFilter === 'veg' ? 'flex-start' : vegFilter === 'nonveg' ? 'flex-end' : 'center',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    shadowColor: '#000',
                                    shadowOpacity: 0.15,
                                    shadowRadius: 2,
                                    shadowOffset: { width: 0, height: 1 },
                                    elevation: 2,
                                }}
                            >
                                <View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 1.5,
                                        borderWidth: 1.5,
                                        borderColor: '#FFFFFF',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FFFFFF' }} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                }
            />

            <ScrollView className="flex-1 bg-[#F8F9FA]" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

                {!searchText.trim() && (
                <>
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
                                className="mr-4 rounded-[20px] overflow-hidden border border-black/5"
                                style={{ width: width * 0.44, height: 240 }}
                                activeOpacity={1}
                            >
                                <Image source={spot.image} className="w-full h-full" resizeMode="cover" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                </>
                )}



                {!searchText.trim() && (
                <>
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
                </>
                )}

                {/* ===== ALL RESTAURANTS / SEARCH RESULTS ===== */}
                <View className="mb-8">
                    {searchText.trim() ? (
                        <SearchResults
                            searchText={searchText}
                            results={searchResults}
                            allMatchedProducts={allMatchedProducts}
                            isLoading={isSearchLoading}
                            storeCardRenderer={(store: SearchResultStore) => (
                                <FullCard restaurant={{
                                    id: store.branch_id,
                                    name: store.branch_name,
                                    address: store.address || 'Address not available',
                                    image: getStoreImageUrl(store.store_photos?.[0]),
                                    rating: null,
                                    distance: store.distance_meters >= 1000
                                        ? `${(store.distance_meters / 1000).toFixed(1)} km`
                                        : `${Math.round(store.distance_meters)} m`,
                                    category: store.vertical_name || 'Restaurants & Cafes',
                                    isDining: true,
                                    isRestaurant: true,
                                    isOpen: checkIsOpen(store.is_active ?? true, store.operating_hours, store.prep_time_minutes || 15),
                                    cuisine: store.vertical_name || 'Multi-Cuisine',
                                    type: 'Casual Dining',
                                    isVeg: false,
                                }} />
                            )}
                            emptyIcon={<UtensilsCrossed size={48} color="#D1D5DB" strokeWidth={1.5} />}
                        />
                    ) : (
                        <>
                            <SectionHeader icon={UtensilsCrossed} title="All Restaurants" />
                            <View className="px-5">
                                {filteredRestaurants.length > 0 ? (
                                    <>
                                        <Text className="text-[12px] font-medium text-gray-400 mt-[-10px] mb-5">{filteredRestaurants.length} places found</Text>
                                        {filteredRestaurants.map((r) => <FullCard key={`all-${r.id}`} restaurant={r} />)}
                                    </>
                                ) : (isLoadingLocation || isSearchLoading) ? (
                                    <View className="items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-100">
                                        <ActivityIndicator size="large" color="#B52725" />
                                        <Text className="text-gray-400 text-sm mt-4 font-bold uppercase tracking-widest">
                                            Searching for restaurants...
                                        </Text>
                                    </View>
                                ) : storesError ? (
                                    <View className="items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                        <WifiOff size={48} color="#D1D5DB" strokeWidth={1.5} />
                                        <Text className="text-gray-900 font-bold text-lg mt-4">Could not reach the server</Text>
                                        <Text className="text-gray-400 text-sm mt-1">Check your connection and try again.</Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                refreshLocation();
                                            }}
                                            className="mt-5 px-6 py-3 bg-[#B52725] rounded-xl"
                                        >
                                            <Text className="text-white font-bold text-[13px]">Retry</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View className="items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                        <UtensilsCrossed size={48} color="#D1D5DB" strokeWidth={1.5} />
                                        <Text className="text-gray-900 font-bold text-lg mt-4">No dining restaurants near you yet</Text>
                                        <Text className="text-gray-400 text-sm mt-1 text-center px-6">We're onboarding restaurants in your area. Check back soon!</Text>
                                    </View>
                                )}
                            </View>
                        </>
                    )}
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
                                className={`flex-row items-center p-3.5 rounded-2xl mb-3 border-2 ${vegFilter === 'veg' ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white'
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

                            {/* Option 3: Non-Veg */}
                            <TouchableOpacity
                                onPress={() => {
                                    setVegFilter('nonveg');
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={`flex-row items-center p-3.5 rounded-2xl border-2 ${vegFilter === 'nonveg' ? 'border-red-500 bg-red-50' : 'border-gray-100 bg-white'
                                    }`}
                                activeOpacity={0.8}
                            >
                                <View className={`w-9 h-9 rounded-xl items-center justify-center ${vegFilter === 'nonveg' ? 'bg-red-500' : 'bg-gray-50'}`}>
                                    <View className="w-3.5 h-3.5 border border-white items-center justify-center" style={{ borderWidth: 1, borderColor: vegFilter === 'nonveg' ? 'white' : '#9CA3AF' }}>
                                        <View className={`w-1.5 h-1.5 rounded-full ${vegFilter === 'nonveg' ? 'bg-white' : 'bg-gray-400'}`} />
                                    </View>
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className={`text-[14px] font-bold ${vegFilter === 'nonveg' ? 'text-gray-900' : 'text-gray-600'}`}>Non-Veg</Text>
                                    <Text className="text-[10px] text-gray-400 font-medium">Restaurants serving non-vegetarian</Text>
                                </View>
                                {vegFilter === 'nonveg' && <Check size={18} color="#EF4444" />}
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

            <StoreFilterModal
                visible={storeFilterVisible}
                filters={storeFilters}
                onApply={(f) => setStoreFilters(f)}
                onClose={() => setStoreFilterVisible(false)}
                showBrands={false}
                showRatings={false}
                showDietary={true}
                showPriceRange={true}
                showSortOptions={['relevance', 'distance', 'prep_time']}
            />
        </SafeAreaView>
    );
}
