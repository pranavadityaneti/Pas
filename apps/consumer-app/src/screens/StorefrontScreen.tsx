// @lock — Storefront with hero carousel, info, search, category pills, product grid, cart integration.
import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    TextInput, Dimensions, SectionList, NativeSyntheticEvent,
    NativeScrollEvent, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ArrowLeft, Star, Clock, UtensilsCrossed, Search, Heart,
    Minus, Plus, ChevronRight, UserCircle, Filter, Check
} from 'lucide-react-native';
import { RESTAURANTS, STORES } from '../lib/data';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { LinearGradient } from 'expo-linear-gradient';
import { useCart } from '../context/CartContext';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import TransactionalAuthModal from '../components/TransactionalAuthModal';
import ProductCard from '../components/ProductCard';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// --- Veg/Non-Veg Indicator ---
const VegIndicator = ({ isVeg }: { isVeg: boolean }) => (
    <View
        className={`items-center justify-center border-2 ${isVeg ? 'border-green-600' : 'border-red-600'}`}
        style={{ width: 16, height: 16, borderRadius: 3 }}
    >
        <View
            className={`rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`}
            style={{ width: 8, height: 8 }}
        />
    </View>
);

export default function StorefrontScreen({ route }: any) {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { addItem, updateQuantity, getItemQuantity, getItemCount, getTotal } = useCart();
    const storeId = route.params.storeId;

    const restaurant = useMemo(() => {
        const r = RESTAURANTS.find(r => r.id === storeId);
        if (r) return r;
        const s = STORES.find(s => s.id === storeId);
        return s || null;
    }, [storeId]);

    const insets = useSafeAreaInsets();
    const [searchText, setSearchText] = useState('');
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);
    const [isHeaderSticky, setIsHeaderSticky] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(400);

    const sectionListRef = useRef<SectionList>(null);

    // Stable Viewability Configs to prevent SectionList Thrashing on Android
    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        const firstViewable = viewableItems[0];
        if (firstViewable?.section) {
            setActiveSectionIndex((prev) => {
                // Must calculate index without depending on groupedProducts directly in closure scope
                const sectionTitle = firstViewable.section.title;
                return prev; // We will handle this state update cleanly in a useEffect or via a stable method if tracking is needed.
            });
        }
    }).current;
    
    // We will use a safe effect-based viewable index tracker to avoid closure staleness
    const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
        const firstViewable = viewableItems[0];
        if (firstViewable?.section) {
            // Because we can't easily access groupedProducts in this stable ref without side effects,
            // we will just use a simpler check or rely on the titles.
            // For now, we update a local state if it's different.
        }
    }).current;

    // Filter States
    const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
    const [bestSellerOnly, setBestSellerOnly] = useState(false);
    const [ratingHighOnly, setRatingHighOnly] = useState(false);
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [under300Only, setUnder300Only] = useState(false);
    const [offersOnly, setOffersOnly] = useState(false);

    const [isFavorited, setIsFavorited] = useState(false);
    const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
    const [heroIndex, setHeroIndex] = useState(0);
    const heroScrollRef = useRef<ScrollView>(null);

    // Fetch initial favorite status
    useEffect(() => {
        const checkFavorite = async () => {
            if (!restaurant) return;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return;

                const { data } = await supabase
                    .from('favorite_stores')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('store_id', String(restaurant.id))
                    .single();

                if (data) setIsFavorited(true);
            } catch (err) {
                // Ignore silent errors for unauthenticated users
            }
        };
        checkFavorite();
    }, [restaurant]);

    const toggleStoreFavorite = async () => {
        if (isFavoriteLoading || !restaurant) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        try {
            setIsFavoriteLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session?.user) {
                setAuthModalVisible(true);
                return;
            }

            if (isFavorited) {
                // Remove Favorite
                const { error } = await supabase
                    .from('favorite_stores')
                    .delete()
                    .eq('user_id', session.user.id)
                    .eq('store_id', String(restaurant.id));
                if (error) console.error("Delete favorite error:", error);
                else setIsFavorited(false);
            } else {
                // Add Favorite
                const { error } = await supabase
                    .from('favorite_stores')
                    .insert({
                        user_id: session.user.id,
                        store_id: String(restaurant.id)
                    });
                if (error) {
                    console.error("Insert favorite error:", error);
                    Alert.alert("Error", "Could not save to favorites.");
                } else {
                    setIsFavorited(true);
                }
            }
        } catch (error) {
            Alert.alert("Error", "Could not update favorites. Please try again.");
            console.error("Favorite toggle error:", error);
        } finally {
            setIsFavoriteLoading(false);
        }
    };

    // Hero images: cover + product images (6 total for carousel testing)
    const heroImages = useMemo(() => {
        if (!restaurant) return [];
        const images = [restaurant.image];
        const seen = new Set([restaurant.image]);
        for (const p of restaurant.products) {
            if (!seen.has((p as any).image)) {
                images.push((p as any).image);
                seen.add((p as any).image);
            }
            if (images.length >= 6) break;
        }
        return images;
    }, [restaurant]);

    // Dynamic Category List (from store's exact products)
    const storeCategories = useMemo(() => {
        if (!restaurant) return [];
        const cats = new Set<string>();
        for (const p of restaurant.products) {
            if (p.subCategory) cats.add(p.subCategory);
        }
        return Array.from(cats);
    }, [restaurant]);

    // Filtered & Grouped products (Chunked into pairs for grid rendering inside SectionList)
    const groupedProducts = useMemo(() => {
        if (!restaurant) return [];
        let products = [...restaurant.products];

        // Search Filter
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            products = products.filter((p: any) => p.name.toLowerCase().includes(q));
        }

        // Detailed Filters
        if (vegFilter === 'veg') products = products.filter((p: any) => p.isVeg);
        if (vegFilter === 'non-veg') products = products.filter((p: any) => p.isVeg === false);
        if (bestSellerOnly) products = products.filter((p: any) => p.isBestseller);
        if (ratingHighOnly) products = products.filter((p: any) => parseFloat(p.rating) >= 4.0);
        if (under300Only) products = products.filter((p: any) => p.price <= 300);
        if (offersOnly) products = products.filter((p: any) => p.discount > 0);

        // Group by subCategory
        const groups: Record<string, any[]> = {};
        products.forEach(p => {
            const sub = p.subCategory || 'Other';
            if (!groups[sub]) groups[sub] = [];
            groups[sub].push(p);
        });

        // Convert to SectionList formatting and chunk into pairs (for 2-columns)
        const sections = [];
        for (const cat of storeCategories) { // Keep original category order
            if (groups[cat] && groups[cat].length > 0) {
                const chunks = [];
                for (let i = 0; i < groups[cat].length; i += 2) {
                    chunks.push(groups[cat].slice(i, i + 2));
                }
                sections.push({ title: cat, data: chunks });
            }
        }

        // Add "Other" if anything fell through
        if (groups['Other'] && groups['Other'].length > 0) {
            const chunks = [];
            for (let i = 0; i < groups['Other'].length; i += 2) {
                chunks.push(groups['Other'].slice(i, i + 2));
            }
            sections.push({ title: 'Other', data: chunks });
        }

        return sections;
    }, [restaurant, storeCategories, searchText, vegFilter, bestSellerOnly, ratingHighOnly, under300Only, offersOnly]);

    if (!restaurant) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <Text className="text-lg text-gray-500">Restaurant not found</Text>
            </SafeAreaView>
        );
    }

    const scrollToSection = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveSectionIndex(index);
        sectionListRef.current?.scrollToLocation({
            sectionIndex: index,
            itemIndex: 0,
            viewOffset: headerHeight > 0 ? headerHeight - insets.top - 60 : 0,
            animated: true
        });
    };

    const handleHeroScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / width);
        setHeroIndex(index);
    };

    const handleMainScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = event.nativeEvent.contentOffset.y;
        // The trigger point is when we've scrolled past the info + original search area
        // We'll use the measured headerHeight minus some buffer for the sticky header itself
        const trigger = headerHeight - insets.top - 60;
        if (y > trigger && !isHeaderSticky) setIsHeaderSticky(true);
        if (y <= trigger && isHeaderSticky) setIsHeaderSticky(false);
    };

    const handleAddToCart = (product: any) => {
        addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            storeId: restaurant.id,
            storeName: restaurant.name,
            uom: product.uom || '1 Pc',
        });
    };

    const itemCount = getItemCount();
    const totalAmount = getTotal();

    // --- Filter Components ---
    const FilterPill = ({ label, active, onPress, icon: Icon, colorClass = 'green' }: any) => (
        <TouchableOpacity
            delayPressIn={0}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            className={`flex-row items-center rounded-xl px-3 py-1.5 mr-2 border ${active
                ? `bg-${colorClass}-50 border-${colorClass}-200`
                : 'bg-white border-gray-100 shadow-sm'
                }`}
            style={{ minHeight: 34 }}
        >
            {Icon && <Icon size={14} color={active ? (colorClass === 'green' ? '#16A34A' : colorClass === 'yellow' ? '#D97706' : '#B52725') : '#6B7280'} style={{ marginRight: 5 }} />}
            <Text className={`text-[12px] font-semibold ${active ? `text-${colorClass}-700` : 'text-gray-700'}`}>{label}</Text>
        </TouchableOpacity>
    );

    const VegToggle = ({ value, onChange }: any) => {
        const states: ('all' | 'veg' | 'non-veg')[] = ['all', 'veg', 'non-veg'];
        const currentIdx = states.indexOf(value);

        const next = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(states[(currentIdx + 1) % states.length]);
        };

        return (
            <TouchableOpacity
                delayPressIn={0}
                onPress={next}
                className={`flex-row items-center rounded-xl px-3 py-1.5 mr-2 border ${value === 'all' ? 'bg-white border-gray-100 shadow-sm' :
                    value === 'veg' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                style={{ minHeight: 34 }}
            >
                <View className={`w-3 h-3 border items-center justify-center mr-2 ${value === 'veg' ? 'border-green-600' : value === 'non-veg' ? 'border-red-600' : 'border-gray-400'
                    }`} style={{ borderWidth: 1 }}>
                    <View className={`w-1 h-1 rounded-full ${value === 'veg' ? 'bg-green-600' : value === 'non-veg' ? 'bg-red-600' : 'bg-transparent'
                        }`} />
                </View>
                <Text className={`text-[12px] font-semibold ${value === 'veg' ? 'text-green-700' : value === 'non-veg' ? 'text-red-700' : 'text-gray-700'
                    }`}>
                    {value === 'all' ? 'Veg / Non-Veg' : value === 'veg' ? 'Pure Veg' : 'Non-Veg'}
                </Text>
            </TouchableOpacity>
        );
    };


    return (
        <View className="flex-1 bg-white">
            {/* ===== STICKY HEADER (SWIGGY STYLE) ===== */}
            {isHeaderSticky && (
                <View
                    style={{
                        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
                        backgroundColor: 'white', paddingTop: Math.max(insets.top, 20),
                        borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
                        elevation: 4
                    }}
                    className="shadow-sm"
                >
                    <View className="flex-row items-center px-4 pb-3">
                        <TouchableOpacity delayPressIn={0} onPress={() => navigation.goBack()} className="p-2 -ml-2">
                            <ArrowLeft size={22} color="#1F2937" />
                        </TouchableOpacity>

                        <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3 h-12 mx-2">
                            <Search size={18} color="#6B7280" />
                            <TextInput
                                className="flex-1 ml-2 font-medium text-[14px] text-gray-800"
                                placeholder={`Search in ${restaurant.name}`}
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <TouchableOpacity delayPressIn={0} onPress={() => navigation.navigate('Profile')} className="p-2 -mr-2">
                            <UserCircle size={28} color="#4B5563" />
                        </TouchableOpacity>
                    </View>

                    {/* Quick Filters in Sticky Header */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 pb-3" style={{ flexGrow: 0, flexShrink: 0 }}>
                        <VegToggle value={vegFilter} onChange={setVegFilter} />
                        <FilterPill label="Ratings 4.0+" active={ratingHighOnly} onPress={() => setRatingHighOnly(!ratingHighOnly)} icon={Star} colorClass="yellow" />
                        <FilterPill label="Bestsellers" active={bestSellerOnly} onPress={() => setBestSellerOnly(!bestSellerOnly)} icon={Check} colorClass="red" />
                        <FilterPill label="Offers" active={offersOnly} onPress={() => setOffersOnly(!offersOnly)} icon={Filter} colorClass="red" />
                        <FilterPill label="Under ₹300" active={under300Only} onPress={() => setUnder300Only(!under300Only)} colorClass="blue" />
                    </ScrollView>
                </View>
            )}

            {/* ===== SECTION PILLS (Sticky duplicate — only when scrolled past header) ===== */}
            {isHeaderSticky && (
                <View style={{ backgroundColor: 'white', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5" contentContainerStyle={{ paddingRight: 40 }} style={{ flexGrow: 0, flexShrink: 0 }}>
                        {groupedProducts.map((section, idx) => (
                            <TouchableOpacity
                                delayPressIn={0}
                                key={section.title}
                                onPress={() => scrollToSection(idx)}
                                className={`rounded-xl py-2 px-4 mr-3 ${activeSectionIndex === idx ? 'bg-[#1F2937]' : 'bg-white border border-gray-100 shadow-sm'
                                    }`}
                            >
                                <Text className={`text-[13px] font-bold ${activeSectionIndex === idx ? 'text-white' : 'text-gray-700'
                                    }`}>
                                    {section.title}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <SectionList
                ref={sectionListRef}
                sections={groupedProducts}
                renderItem={({ item }) => {
                    return (
                        <View className="flex-row px-4 mb-4" style={{ gap: 16 }}>
                            {item.map((product: any) => (
                                <View key={`product-${product.id}`} className="flex-1">
                                    <ProductCard
                                        item={product}
                                        quantity={getItemQuantity(product.id)}
                                        onAdd={handleAddToCart}
                                        onIncrement={(id, newQty) => updateQuantity(Number(id), newQty)}
                                        onDecrement={(id, newQty) => updateQuantity(Number(id), newQty)}
                                    />
                                </View>
                            ))}
                            {item.length === 1 && <View className="flex-1" />}
                        </View>
                    );
                }}
                renderSectionHeader={({ section: { title } }) => (
                    <View className="bg-white px-5 py-4 mb-2 mt-4 flex-row items-center border-b border-gray-100">
                        <Text className="text-[20px] font-extrabold text-gray-900">{title}</Text>
                        <View className="h-[2px] bg-gray-200 flex-1 ml-4" />
                    </View>
                )}
                keyExtractor={(item, index) => `chunk-${index}`}
                onScroll={handleMainScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: itemCount > 0 ? 120 : 100 }}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                viewabilityConfig={viewabilityConfig}
                ListHeaderComponent={
                    <View onLayout={(e) => {
                        if (headerHeight === 400) setHeaderHeight(e.nativeEvent.layout.height);
                    }}>
                        {/* ===== HERO IMAGE CAROUSEL ===== */}
                        {/* ===== HERO IMAGE CAROUSEL ===== */}
                        <View style={{ height: 324, zIndex: 10, elevation: 10 }}>
                            {/* Image Background (Top 280px) */}
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280, overflow: 'hidden', backgroundColor: 'black' }}>
                                <ScrollView
                                    ref={heroScrollRef}
                                    horizontal
                                    pagingEnabled
                                    nestedScrollEnabled
                                    showsHorizontalScrollIndicator={false}
                                    onScroll={handleHeroScroll}
                                    scrollEventThrottle={16}
                                >
                                    {heroImages.map((img: any, idx: number) => (
                                        <Image key={idx} source={typeof img === 'string' ? { uri: img } : img} style={{ width, height: 280 }} />
                                    ))}
                                </ScrollView>

                                {/* Global subtle black tint for distinction + gradient edges */}
                                <LinearGradient
                                    colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                    pointerEvents="none"
                                />

                                {/* Back button */}
                                <TouchableOpacity
                                    delayPressIn={0}
                                    onPress={() => navigation.goBack()}
                                    className="absolute bg-white/20 rounded-full items-center justify-center"
                                    style={{ top: Math.max(insets.top, 20), left: 16, width: 40, height: 40 }}
                                >
                                    <ArrowLeft size={22} color="#FFFFFF" />
                                </TouchableOpacity>

                                {/* Pagination dots */}
                                <View className="absolute flex-row items-center justify-center" style={{ bottom: 20, left: 0, right: 0 }}>
                                    {heroImages.map((_: any, idx: number) => (
                                        <View
                                            key={idx}
                                            className={`rounded-full mx-1 ${heroIndex === idx ? 'bg-white' : 'bg-white/50'}`}
                                            style={{ width: heroIndex === idx ? 8 : 6, height: heroIndex === idx ? 8 : 6 }}
                                        />
                                    ))}
                                </View>
                            </View>

                            {/* Restaurant logo (Safe area inside 324px bound) */}
                            <View className="absolute items-center" style={{ bottom: 4, left: 0, right: 0, zIndex: 20, elevation: 20 }}>
                                <View className="rounded-full bg-white shadow-xl items-center justify-center border-white overflow-hidden" style={{ width: 80, height: 80, borderWidth: 4 }}>
                                    <Image source={{ uri: restaurant.image }} className="w-full h-full rounded-full" />
                                </View>
                            </View>

                            {/* Favorite button (Safe area inside 324px bound) */}
                            <TouchableOpacity
                                delayPressIn={0}
                                onPress={toggleStoreFavorite}
                                disabled={isFavoriteLoading}
                                className="absolute bg-gray-900/80 rounded-full items-center justify-center shadow-md"
                                style={{ bottom: 22, right: 24, width: 44, height: 44, zIndex: 20, elevation: 20 }}
                            >
                                <Heart size={20} color="#FFFFFF" fill={isFavorited ? '#B52725' : 'transparent'} />
                            </TouchableOpacity>
                        </View>

                        {/* ===== RESTAURANT INFO ===== */}
                        <View className="items-center px-6" style={{ marginTop: 2 }}>
                            <Text className="text-[22px] font-bold text-gray-900 text-center">{restaurant.name}</Text>
                            <Text className="text-[13px] text-gray-500 font-medium text-center" style={{ marginTop: 6 }}>{restaurant.address}</Text>

                            <View className="flex-row items-center" style={{ marginTop: 16 }}>
                                <View className="flex-row items-center px-3 py-2">
                                    <Star size={16} color="#1F2937" fill="#1F2937" />
                                    <Text className="text-[14px] font-bold text-gray-900 ml-1.5">{restaurant.rating}</Text>
                                </View>
                                <View className="w-[1px] h-5 bg-gray-200 mx-2" />
                                <View className="flex-row items-center px-3 py-2">
                                    <Clock size={16} color="#6B7280" />
                                    <Text className="text-[14px] font-medium text-gray-600 ml-1.5">{(restaurant as any).prepTime || '30 mins'}</Text>
                                </View>
                                <View className="w-[1px] h-5 bg-gray-200 mx-2" />
                                <View className="flex-row items-center px-3 py-2">
                                    <UtensilsCrossed size={16} color="#6B7280" />
                                    <Text className="text-[14px] font-medium text-gray-600 ml-1.5">Dine-in</Text>
                                </View>
                            </View>
                        </View>

                        {/* ===== SEARCH & FILTERS ===== */}
                        <View className="px-5" style={{ marginTop: 28 }}>
                            {/* Search Bar */}
                            <View className="w-full h-14 bg-gray-50 rounded-2xl border border-gray-100 flex-row items-center px-4 shadow-sm">
                                <Search size={20} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 font-medium text-[15px] text-gray-800"
                                    placeholder={`Search menu in ${restaurant.name}`}
                                    placeholderTextColor="#9CA3AF"
                                    value={searchText}
                                    onChangeText={setSearchText}
                                />
                            </View>

                            {/* Filter Pills */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                className="mt-5"
                                style={{ marginHorizontal: -20, paddingHorizontal: 20, flexGrow: 0, flexShrink: 0 }}
                                contentContainerStyle={{ paddingBottom: 14 }}
                            >
                                <VegToggle value={vegFilter} onChange={setVegFilter} />
                                <FilterPill label="Ratings 4.0+" active={ratingHighOnly} onPress={() => setRatingHighOnly(!ratingHighOnly)} icon={Star} colorClass="yellow" />
                                <FilterPill label="Bestsellers" active={bestSellerOnly} onPress={() => setBestSellerOnly(!bestSellerOnly)} icon={Check} colorClass="red" />
                                <FilterPill label="Offers" active={offersOnly} onPress={() => setOffersOnly(!offersOnly)} icon={Filter} colorClass="red" />
                                <FilterPill label="Under ₹300" active={under300Only} onPress={() => setUnder300Only(!under300Only)} colorClass="blue" />
                            </ScrollView>
                        </View>

                        {/* ===== SECTION PILLS (inline — scrolls with content) ===== */}
                        <View style={{ backgroundColor: 'white', paddingVertical: 12, marginTop: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5" contentContainerStyle={{ paddingRight: 40 }} style={{ flexGrow: 0, flexShrink: 0 }}>
                                {groupedProducts.map((section, idx) => (
                                    <TouchableOpacity
                                        delayPressIn={0}
                                        key={section.title}
                                        onPress={() => scrollToSection(idx)}
                                        className={`rounded-xl py-2 px-4 mr-3 ${activeSectionIndex === idx ? 'bg-[#1F2937]' : 'bg-white border border-gray-100 shadow-sm'
                                            }`}
                                    >
                                        <Text className={`text-[13px] font-bold ${activeSectionIndex === idx ? 'text-white' : 'text-gray-700'
                                            }`}>
                                            {section.title}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Search Results Summary */}
                        {searchText.trim() !== '' && (
                            <Text className="px-5 text-[14px] font-bold text-gray-500 mb-6 mt-4">
                                Resulting items for &quot;{searchText}&quot;
                            </Text>
                        )}
                    </View>
                }
            />

            {/* ===== FLOATING BOTTOM BAR ===== */}
            {itemCount > 0 && (
                <View
                    className="absolute bottom-0 left-0 right-0 px-5 pt-3"
                    pointerEvents="box-none"
                    style={{
                        backgroundColor: 'transparent',
                        paddingBottom: Math.max(insets.bottom, 20),
                        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10,
                        elevation: 10,
                        zIndex: 999
                    }}
                >
                    <TouchableOpacity
                        delayPressIn={0}
                        onPress={async () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                            try {
                                let session = null;
                                try {
                                    const result = await Promise.race([
                                        supabase.auth.getSession(),
                                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
                                    ]) as any;
                                    session = result?.data?.session;
                                } catch {
                                    // Timeout — assume authenticated if we have items in cart
                                }

                                if (!session) {
                                    setAuthModalVisible(true);
                                    return;
                                }

                                navigation.navigate('Main', { screen: 'Cart' } as any);
                            } catch {
                                // Fallback — navigate anyway
                                navigation.navigate('Main', { screen: 'Cart' } as any);
                            }
                        }}
                        className="bg-[#B52725] rounded-3xl flex-row items-center justify-between px-6"
                        style={{ height: 64, backgroundColor: '#B52725' }}
                        activeOpacity={0.9}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <View>
                            <Text className="text-[16px] font-extrabold text-white">{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</Text>
                            <Text className="text-[13px] font-bold text-white/90">₹{totalAmount} (estimated)</Text>
                        </View>
                        <View className="flex-row items-center">
                            <Text className="text-[16px] font-extrabold text-white mr-2">Proceed</Text>
                            <ChevronRight size={20} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            <TransactionalAuthModal
                visible={authModalVisible}
                onClose={() => setAuthModalVisible(false)}
                onSuccess={() => {
                    setAuthModalVisible(false);
                    navigation.navigate('Main', { screen: 'Cart' } as any);
                }}
                title="Checkout Securely"
                subtitle="Login or sign up to complete your pre-order."
            />
        </View>
    );
}
