// @lock — Do NOT overwrite.
// Pickup Discovery Screen (UX Overhauled): Hyper-local venue discovery, distance badges, curated sections.
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, User, ChevronRight, Star, Clock, ArrowRight, MapPinOff, WifiOff } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { STORE_CATEGORIES, PICKUP_SPOTLIGHTS } from '../lib/data';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useLocation } from '../context/LocationContext';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import { useCart } from '../context/CartContext';
import CartSummaryBar from '../components/CartSummaryBar';
import { LinearGradient } from 'expo-linear-gradient';
import GlobalHeader from '../components/GlobalHeader';
import { useCategories } from '../context/CategoryContext';
import { useStores } from '../hooks/useStores';
import { useNearbyStores } from '../hooks/useNearbyStores';
import { ActivityIndicator } from 'react-native';

const { width } = Dimensions.get('window');

const CATEGORIES = [
    { name: "Grocery & Kirana", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&h=200&fit=crop" },
    { name: "Fresh items", image: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=200&h=200&fit=crop" },
    { name: "Restaurants & Cafes", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop" },
    { name: "Bakeries & Desserts", image: "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=200&h=200&fit=crop" },
    { name: "Sports and fitness", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200&h=200&fit=crop" },
    { name: "Pharmacy & Wellness", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&h=200&fit=crop" },
    { name: "Electronics & Accessories", image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200&h=200&fit=crop" },
    { name: "Fashion & Apparel", image: "https://images.unsplash.com/photo-1445205170230-053b830c6046?w=200&h=200&fit=crop" },
    { name: "Home & Lifestyle", image: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=200&h=200&fit=crop" },
    { name: "Beauty & Personal Care", image: "https://images.unsplash.com/photo-1596462502278-27bfdc4033c8?w=200&h=200&fit=crop" },
    { name: "Pet Care & Supplies", image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=200&h=200&fit=crop" },
    { name: "Stationery, Gifting & Toys", image: "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=200&h=200&fit=crop" },
    { name: "Electricals, Paints & Automotive", image: "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=200&h=200&fit=crop" },
    { name: "Hardware and plumbing", image: "https://images.unsplash.com/photo-1581141849291-1110b9c1d30a?w=200&h=200&fit=crop" },
    { name: "Pooja and festive needs", image: "https://images.unsplash.com/photo-1513410191585-79cee3e047fb?w=200&h=200&fit=crop" },
];

type FilterType = 'nearest' | 'food' | 'grocery' | 'bakery';

export default function HomeFeedScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const tabNavigation = useNavigation<any>();
    const { activeLocation, isLoadingLocation, permissionDenied, refreshLocation } = useLocation();
    const [searchText, setSearchText] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType | null>('nearest');
    const { stores, loading, refresh: refreshStores } = useStores();
    const { nearbyStoreIds, distanceMap } = useNearbyStores();
    const { items, getTotal } = useCart();
    const { verticals } = useCategories();


    const getCategoryUI = (name: string) => {
        const mapping: Record<string, { ionicon: string, iconColor: string, colorClass: string, sub: string }> = {
            'Grocery & Kirana': { ionicon: 'basket', iconColor: '#16A34A', colorClass: 'bg-green-100', sub: 'Daily Essentials' },
            'Fruits & Vegetables': { ionicon: 'leaf', iconColor: '#EA580C', colorClass: 'bg-orange-100', sub: 'Fresh & Organic' },
            'Restaurants & Cafes': { ionicon: 'restaurant', iconColor: '#B52725', colorClass: 'bg-red-100', sub: 'Order Hot Food' },
            'Bakeries & Desserts': { ionicon: 'ice-cream', iconColor: '#DB2777', colorClass: 'bg-pink-100', sub: 'Cakes & Treats' },
            'Meat & Seafood': { ionicon: 'fish', iconColor: '#2563EB', colorClass: 'bg-blue-100', sub: 'Fresh & Frozen' },
            'Pharmacy & Wellness': { ionicon: 'medical', iconColor: '#0D9488', colorClass: 'bg-teal-100', sub: 'Meds & Hygiene' },
            'Electronics & Accessories': { ionicon: 'watch', iconColor: '#4F46E5', colorClass: 'bg-indigo-100', sub: 'Tech & Gadgets' },
            'Fashion & Apparel': { ionicon: 'shirt', iconColor: '#9333EA', colorClass: 'bg-purple-100', sub: 'Trendy Styles' },
            'Home & Lifestyle': { ionicon: 'home', iconColor: '#CA8A04', colorClass: 'bg-yellow-100', sub: 'Decor & Living' },
            'Beauty & Personal Care': { ionicon: 'color-palette', iconColor: '#E11D48', colorClass: 'bg-rose-100', sub: 'Skin & Beauty' },
            'Pet Care & Supplies': { ionicon: 'paw', iconColor: '#44403C', colorClass: 'bg-stone-100', sub: 'Furry Friend Needs' },
            'Stationery, Gifting & Toys': { ionicon: 'gift', iconColor: '#0891B2', colorClass: 'bg-cyan-100', sub: 'Gifts & Toys' },
            'Electricals, Paints & Automotive': { ionicon: 'flash', iconColor: '#475569', colorClass: 'bg-slate-100', sub: 'Hardware' },
            'Hardware & Plumbing': { ionicon: 'construct', iconColor: '#92400E', colorClass: 'bg-orange-200', sub: 'Plumbing' },
            'Pooja & Festive Needs': { ionicon: 'sparkles', iconColor: '#854D0E', colorClass: 'bg-yellow-200', sub: 'Festive' },
            'Sports & Fitness': { ionicon: 'football', iconColor: '#15803D', colorClass: 'bg-emerald-100', sub: 'Fitness' },
        };
        return mapping[name] || { ionicon: 'grid', iconColor: '#6B7280', colorClass: 'bg-gray-100', sub: 'Explore More' };
    };

    const getTimeBadgeColor = (distanceStr: string) => {
        const dist = parseFloat(distanceStr) || 0;
        if (dist < 3) return '#16A34A'; // Green
        if (dist <= 5) return '#D97706'; // Yellow
        return '#DC2626'; // Red
    };


    // --- Venues Data Logic ---
    const allVenues = useMemo(() => {
        let list = stores.map(s => ({ 
            ...s, 
            isRestaurant: s.isDining, 
            rawDist: distanceMap[s.id] || 999999 
        }));

        // Apply filters
        if (activeFilter === 'nearest') {
            list.sort((a, b) => a.rawDist - b.rawDist);
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
        if (activeFilter !== 'nearest') {
            list.sort((a, b) => a.rawDist - b.rawDist);
        }

        return list;
    }, [activeFilter, searchText]);

    // (Quick Grab & Go removed — replaced by store-level curated sections)

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
        { id: 'food', label: 'Restaurants', ionicon: 'storefront' },
        { id: 'grocery', label: 'Groceries', ionicon: 'cart' },
        { id: 'bakery', label: 'Coffee & Bites', ionicon: 'cafe' },
    ];

    const formatDistance = (meters: number) => {
        if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
        return `${meters} m`;
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#B52725" />
            </SafeAreaView>
        );
    }

    const calculateETA = (distanceInMeters: number) => {
        if (!distanceInMeters || distanceInMeters > 50000) return 'Long Distance';
        const eta = Math.ceil((distanceInMeters / 1000) * 4) + 10;
        return `${eta} mins`;
    };

    const StandardVenueCard = ({ venue, tagType, isFullWidth }: { venue: any, tagType?: 'trending' | 'fast' | 'deal', isFullWidth?: boolean }) => (
        <TouchableOpacity
            delayPressIn={0}
            key={venue.id}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate('Storefront', { storeId: venue.id as any });
            }}
            style={isFullWidth ? {} : { width: width * 0.75 }}
            className={`rounded-[28px] bg-white border border-gray-100 overflow-hidden shadow-sm ${isFullWidth ? 'mb-5 w-full' : 'mr-4'}`}
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
                    <Text className="text-[11px] font-bold text-gray-900 ml-1">{formatDistance(venue.rawDist)}</Text>
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
                        {venue.rating ? (
                            <>
                                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                                <Text className="text-[11px] font-bold text-gray-800 ml-1">{venue.rating}</Text>
                            </>
                        ) : (
                            <Text className="text-[10px] font-extrabold text-blue-600 uppercase">NEW</Text>
                        )}
                        <Text className="text-[10px] text-gray-300 mx-1.5">•</Text>
                        <Text className="text-[10px] font-extrabold text-gray-600">{formatDistance(venue.rawDist)}</Text>
                        <Text className="text-[10px] text-gray-300 mx-1.5">•</Text>
                        <Text className="text-[10px] font-extrabold text-gray-600 max-w-[80px]" numberOfLines={1}>
                            {venue.address?.split(',')[1]?.trim() || venue.address?.split(',')[0]?.trim() || 'Nearby'}
                        </Text>
                    </View>
                </View>
                <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-medium text-gray-500 capitalize" numberOfLines={1}>
                        {venue.isRestaurant ? (venue as any).cuisine : (venue as any).category}
                    </Text>
                    <View className="flex-row items-center px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${getTimeBadgeColor((venue as any).distance)}18` }}>
                        <Clock size={11} color={getTimeBadgeColor((venue as any).distance)} />
                        <Text className="text-[11px] font-bold ml-1" style={{ color: getTimeBadgeColor((venue as any).distance) }}>
                            {calculateETA(venue.rawDist)}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            <GlobalHeader 
                searchText={searchText} 
                onSearchChange={setSearchText} 
                searchPlaceholder="Find places to pick up near you..."
                bottomContent={
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible">
                        {filters.map(filter => {
                            const isActive = activeFilter === filter.id;
                            return (
                                <TouchableOpacity
                                    delayPressIn={0}
                                    key={filter.id}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setActiveFilter(isActive ? null : filter.id);
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
                }
            />

            {permissionDenied ? (
                <View className="flex-1 items-center justify-center p-6 bg-[#F8F9FA]">
                    <MapPinOff size={64} color="#E5E7EB" strokeWidth={1} />
                    <Text className="text-gray-900 text-[18px] font-bold mt-4 text-center">Location Required</Text>
                    <Text className="text-gray-400 text-[13px] font-medium text-center mt-2 px-4">
                        Please enable GPS in your device settings to discover stores and pick up spots near you.
                    </Text>
                </View>
            ) : (
                <ScrollView className="flex-1 bg-[#F8F9FA]" contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }} showsVerticalScrollIndicator={false}>

                {/* Banner Carousel */}
                <View className="mb-6 mt-2">
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        pagingEnabled
                        snapToInterval={width * 0.85 + 16}
                        decelerationRate="fast"
                        contentContainerStyle={{ paddingHorizontal: 24 }}
                    >
                        {PICKUP_SPOTLIGHTS.map((spot) => (
                            <TouchableOpacity
                                key={spot.id}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    // navigation.navigate('SpotlightDetail', { spotlightId: spot.id });
                                }}
                                className="mr-4 rounded-[24px] overflow-hidden bg-white shadow-sm border border-black/5"
                                style={{ width: width * 0.85, height: 180 }}
                                activeOpacity={0.9}
                            >
                                <Image source={{ uri: spot.image }} className="absolute w-full h-full" />
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, padding: 20, justifyContent: 'flex-end' }}
                                >
                                    {/* Badge */}
                                    <View 
                                        className="rounded-lg px-2.5 py-1 self-start absolute top-4 left-4"
                                        style={{ backgroundColor: spot.badgeColor }}
                                    >
                                        <Text className="text-[10px] font-bold text-white uppercase tracking-wider">{spot.badge}</Text>
                                    </View>
                                    
                                    {/* Title & Subtitle */}
                                    <View>
                                        <Text className="text-xl font-extrabold text-white leading-tight">{spot.title}</Text>
                                        <Text className="text-[13px] font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.9)' }}>{spot.subtitle}</Text>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Shop by Category: 5-Column Grid */}
                <View className="px-5 mb-8 mt-4">
                    <View className="mb-5">
                        <Text className="text-xl font-bold text-gray-900">Shop by Category</Text>
                    </View>

                    <View className="flex-row flex-wrap justify-between">
                        {CATEGORIES.map((category, idx) => (
                            <TouchableOpacity
                                key={`cat-${idx}`}
                                activeOpacity={0.7}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    navigation.navigate('CategoryDetail', { categoryId: category.name, categoryName: category.name });
                                }}
                                style={{ width: (width - 40) / 5 }}
                                className="items-center mb-6"
                            >
                                <View className="w-14 h-14 rounded-full bg-gray-100 shadow-sm border border-gray-100 overflow-hidden mb-2">
                                    <Image
                                        source={{ uri: category.image }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                </View>
                                <Text
                                    className="text-[10px] font-medium text-gray-800 text-center leading-tight px-0.5"
                                    numberOfLines={2}
                                >
                                    {category.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Flowing Feed */}
                <View className="px-5 pb-8">
                    {searchText ? (
                        <Text className="text-[20px] font-extrabold text-gray-900 tracking-tight mb-5 px-1 mt-4">
                            Search Results
                        </Text>
                    ) : null}

                    {allVenues.length > 0 ? (
                        allVenues.map((venue) => (
                            <StandardVenueCard key={venue.id} venue={venue} isFullWidth />
                        ))
                    ) : isLoadingLocation ? (
                        <View className="py-20 items-center justify-center">
                            <ActivityIndicator size="large" color="#B52725" />
                            <Text className="text-gray-400 text-[13px] font-bold mt-4 uppercase tracking-widest">
                                Locating nearby stores...
                            </Text>
                        </View>
                    ) : (
                        <View className="py-12 items-center justify-center">
                            <WifiOff size={48} color="#D1D5DB" strokeWidth={1.5} />
                            <Text className="text-gray-900 text-[16px] font-bold mt-4">Could not reach the server</Text>
                            <Text className="text-gray-400 text-[13px] font-medium mt-1 text-center px-10">Check your connection and try again.</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    refreshLocation();
                                    refreshStores();
                                }}
                                className="mt-5 px-6 py-3 bg-[#B52725] rounded-xl"
                            >
                                <Text className="text-white font-bold text-[13px]">Retry</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                </ScrollView>
            )}

            <CartSummaryBar itemCount={items.length} totalAmount={getTotal()} />
        </SafeAreaView>
    );
}
