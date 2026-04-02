// SpotlightDetailScreen: Immersive collection page for Dining Spotlight cards.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { RESTAURANTS } from '../lib/data';
import { DINING_SPOTLIGHTS } from './DiningScreen';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Star, Clock, UtensilsCrossed, Calendar, MapPin, ChevronRight, Percent, Users, Moon, Sparkles, BadgeCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import BookingModal from '../components/BookingModal';

const { width } = Dimensions.get('window');
const HERO_HEIGHT = 340;

// --- Spotlight Configurations ---
type SpotlightConfig = {
    filterFn: (r: typeof RESTAURANTS[0]) => boolean;
    ctaLabel: string;
    ctaAction: 'book' | 'order';
    accentColor: string;
    icon: any;
    offerBanner?: { text: string; subtext: string };
    description: string;
};

const SPOTLIGHT_CONFIGS: Record<string, SpotlightConfig> = {
    '1': {
        filterFn: () => true,
        ctaLabel: 'Book Now',
        ctaAction: 'book',
        accentColor: '#B52725',
        icon: Percent,
        offerBanner: { text: '20% OFF on all bookings', subtext: 'Valid this weekend only • No minimum order • Auto-applied at checkout' },
        description: 'Enjoy flat 20% off on table bookings at all partner restaurants this weekend. Make your reservations now!',
    },
    '2': {
        filterFn: (r) => r.type === 'Fine Dining',
        ctaLabel: 'Reserve Table',
        ctaAction: 'book',
        accentColor: '#EAB308',
        icon: Sparkles,
        description: 'Handpicked fine dining experiences with premium ambiance, curated menus, and exclusive table reservations.',
    },
    '3': {
        filterFn: () => true,
        ctaLabel: 'Pre-order Now',
        ctaAction: 'order',
        accentColor: '#B52725',
        icon: Clock,
        description: 'Skip the wait! Browse menus, place your order ahead of time, and walk in to a ready meal.',
    },
    '4': {
        filterFn: (r) => r.type === 'Fine Dining',
        ctaLabel: 'Book Now',
        ctaAction: 'book',
        accentColor: '#EAB308',
        icon: UtensilsCrossed,
        description: 'Exclusive multi-course tasting menus crafted by top chefs. An unforgettable culinary journey.',
    },
    '5': {
        filterFn: () => true,
        ctaLabel: 'Book for Group',
        ctaAction: 'book',
        accentColor: '#B52725',
        icon: Users,
        description: 'Perfect for birthdays, anniversaries, and get-togethers. Find restaurants that welcome large groups.',
    },
    '6': {
        filterFn: () => true,
        ctaLabel: 'Order Now',
        ctaAction: 'order',
        accentColor: '#B52725',
        icon: Moon,
        description: 'Craving something past midnight? These restaurants keep their kitchens running late just for you.',
    },
};

export default function SpotlightDetailScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'SpotlightDetail'>>();
    const { spotlightId } = route.params;

    const [bookingVisible, setBookingVisible] = useState(false);
    const [bookingRestaurant, setBookingRestaurant] = useState<any>(null);

    const spotlight = DINING_SPOTLIGHTS.find(s => String(s.id) === spotlightId);
    const config = SPOTLIGHT_CONFIGS[spotlightId] || SPOTLIGHT_CONFIGS['1'];
    const AccentIcon = config.icon;

    const restaurants = useMemo(() => {
        return RESTAURANTS.filter(config.filterFn);
    }, [config.filterFn]);

    const cuisineCount = useMemo(() => {
        const set = new Set(restaurants.map(r => r.cuisine));
        return set.size;
    }, [restaurants]);

    const openBooking = (restaurant: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setBookingRestaurant(restaurant);
        setBookingVisible(true);
    };

    if (!spotlight) return null;

    return (
        <View className="flex-1 bg-[#F8F9FA]">
            <StatusBar barStyle="light-content" />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ===== IMMERSIVE HERO ===== */}
                <View style={{ height: HERO_HEIGHT, width: '100%' }}>
                    <Image
                        source={{ uri: spotlight.image }}
                        style={{ width: '100%', height: '100%', position: 'absolute' }}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.85)']}
                        locations={[0, 0.35, 1]}
                        style={{ position: 'absolute', width: '100%', height: '100%' }}
                    />

                    {/* Back Button */}
                    <TouchableOpacity
                        delayPressIn={0}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.goBack();
                        }}
                        className="absolute bg-black/30 rounded-full items-center justify-center"
                        style={{ top: 56, left: 20, width: 40, height: 40 }}
                    >
                        <ArrowLeft size={20} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* Badge */}
                    <View
                        className="absolute rounded-full px-3.5 py-1.5 flex-row items-center"
                        style={{ top: 60, right: 20, backgroundColor: config.accentColor }}
                    >
                        <AccentIcon size={12} color="#FFFFFF" />
                        <Text className="text-[11px] font-bold text-white ml-1.5">{spotlight.badge}</Text>
                    </View>

                    {/* Hero Text */}
                    <View className="absolute bottom-0 left-0 right-0 px-6 pb-6">
                        <Text className="text-white text-3xl font-bold leading-tight">{spotlight.title}</Text>
                        <Text className="text-white/80 text-[14px] font-medium mt-2 leading-5">{spotlight.subtitle}</Text>
                    </View>
                </View>

                {/* ===== OFFER BANNER ===== */}
                {config.offerBanner && (
                    <View className="mx-5 mt-[-20px] rounded-2xl overflow-hidden shadow-lg" style={{ backgroundColor: config.accentColor }}>
                        <LinearGradient
                            colors={[config.accentColor, `${config.accentColor}DD`]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            className="px-5 py-4"
                        >
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center mr-3">
                                    <Percent size={20} color="#FFFFFF" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white font-bold text-[15px]">{config.offerBanner.text}</Text>
                                    <Text className="text-white/70 text-[11px] font-medium mt-1">{config.offerBanner.subtext}</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                )}

                {/* ===== DESCRIPTION ===== */}
                <View className="px-6 mt-5">
                    <Text className="text-gray-500 text-[13px] font-medium leading-5">{config.description}</Text>
                </View>

                {/* ===== STATS BAR ===== */}
                <View className="flex-row items-center px-6 mt-5 mb-2">
                    <View className="flex-row items-center bg-white rounded-xl px-3.5 py-2.5 border border-gray-100 shadow-sm mr-3">
                        <UtensilsCrossed size={14} color={config.accentColor} />
                        <Text className="text-[13px] font-bold text-gray-900 ml-2">{restaurants.length}</Text>
                        <Text className="text-[11px] text-gray-400 font-medium ml-1">Places</Text>
                    </View>
                    <View className="flex-row items-center bg-white rounded-xl px-3.5 py-2.5 border border-gray-100 shadow-sm mr-3">
                        <MapPin size={14} color={config.accentColor} />
                        <Text className="text-[13px] font-bold text-gray-900 ml-2">{cuisineCount}</Text>
                        <Text className="text-[11px] text-gray-400 font-medium ml-1">Cuisines</Text>
                    </View>
                    <View className="flex-row items-center bg-white rounded-xl px-3.5 py-2.5 border border-gray-100 shadow-sm">
                        <Star size={14} color="#FBBF24" fill="#FBBF24" />
                        <Text className="text-[13px] font-bold text-gray-900 ml-2">4.0+</Text>
                        <Text className="text-[11px] text-gray-400 font-medium ml-1">Avg</Text>
                    </View>
                </View>

                {/* ===== RESTAURANT LIST ===== */}
                <View className="px-5 mt-4">
                    <Text className="text-[12px] font-medium text-gray-400 mb-4">{restaurants.length} restaurants curated for you</Text>

                    {restaurants.length > 0 ? (
                        restaurants.map((restaurant) => (
                            <TouchableOpacity
                                delayPressIn={0}
                                key={`spotlight-${restaurant.id}`}
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
                                    <View className="absolute bottom-4 left-4 flex-row items-center">
                                        <View className="bg-gray-900/80 px-3 py-1.5 rounded-lg flex-row items-center">
                                            {restaurant.isVeg && (
                                                <View className="w-2.5 h-2.5 border border-green-400 items-center justify-center mr-2" style={{ borderWidth: 1 }}>
                                                    <View className="w-1 h-1 rounded-full bg-green-400" />
                                                </View>
                                            )}
                                            <Text className="text-[11px] font-bold text-white">{restaurant.cuisine}</Text>
                                        </View>
                                    </View>
                                    {/* Offer badge (for discount spotlights) */}
                                    {config.offerBanner && (
                                        <View
                                            className="absolute top-4 left-4 px-3 py-1.5 rounded-lg flex-row items-center"
                                            style={{ backgroundColor: config.accentColor }}
                                        >
                                            <Percent size={10} color="#FFFFFF" />
                                            <Text className="text-[10px] font-bold text-white ml-1.5 uppercase">20% OFF</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Info */}
                                <View className="px-5 pt-5 pb-4">
                                    <View className="flex-row justify-between items-start">
                                        <Text className="text-[18px] font-bold text-gray-900 flex-1" numberOfLines={1}>{restaurant.name}</Text>
                                        <Text className="text-[13px] font-semibold text-gray-500 ml-3">{restaurant.distance}</Text>
                                    </View>
                                    <Text className="text-[12px] font-semibold" style={{ marginTop: 8, color: config.accentColor }}>{restaurant.type}</Text>
                                    <Text className="text-[12px] text-gray-500 font-medium" style={{ marginTop: 8 }} numberOfLines={1}>{restaurant.address}</Text>

                                    {/* Action Buttons */}
                                    <View className="flex-row" style={{ marginTop: 12, gap: 12 }}>
                                        {config.ctaAction === 'book' ? (
                                            <View className="flex-row flex-1" style={{ gap: 12 }}>
                                                <TouchableOpacity
                                                    delayPressIn={0}
                                                    className="flex-1 h-12 rounded-xl border border-gray-200 flex-row items-center justify-center"
                                                    onPress={() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                        navigation.navigate('Storefront', { storeId: restaurant.id });
                                                    }}
                                                >
                                                    <UtensilsCrossed size={15} color="#374151" />
                                                    <Text className="text-[13px] font-bold text-gray-700 ml-2">View Menu</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    delayPressIn={0}
                                                    className="flex-1 h-12 rounded-xl flex-row items-center justify-center"
                                                    style={{ backgroundColor: config.accentColor }}
                                                    onPress={() => openBooking(restaurant)}
                                                >
                                                    <Calendar size={15} color="#FFFFFF" />
                                                    <Text className="text-[13px] font-bold text-white ml-2">{config.ctaLabel}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View className="flex-row flex-1" style={{ gap: 12 }}>
                                                <TouchableOpacity
                                                    delayPressIn={0}
                                                    className="flex-1 h-12 rounded-xl border border-gray-200 flex-row items-center justify-center"
                                                    onPress={() => openBooking(restaurant)}
                                                >
                                                    <Calendar size={15} color="#374151" />
                                                    <Text className="text-[13px] font-bold text-gray-700 ml-2">Book Table</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    delayPressIn={0}
                                                    className="flex-1 h-12 rounded-xl flex-row items-center justify-center"
                                                    style={{ backgroundColor: config.accentColor }}
                                                    onPress={() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                        navigation.navigate('Storefront', { storeId: restaurant.id });
                                                    }}
                                                >
                                                    <UtensilsCrossed size={15} color="#FFFFFF" />
                                                    <Text className="text-[13px] font-bold text-white ml-2">{config.ctaLabel}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View className="items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                            <UtensilsCrossed size={48} color="#E5E7EB" strokeWidth={1} />
                            <Text className="text-gray-900 font-bold text-lg mt-4">No restaurants found</Text>
                            <Text className="text-gray-400 text-sm mt-1">Check back later for new additions</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Booking Modal */}
            {bookingRestaurant && (
                <BookingModal
                    visible={bookingVisible}
                    onClose={() => setBookingVisible(false)}
                    restaurant={bookingRestaurant}
                />
            )}
        </View>
    );
}
