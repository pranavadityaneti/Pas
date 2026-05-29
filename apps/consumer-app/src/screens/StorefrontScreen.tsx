// @lock — Do NOT overwrite.
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    TextInput, Dimensions, SectionList, NativeSyntheticEvent,
    NativeScrollEvent, Alert, Animated, Easing
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ArrowLeft, Star, Clock, UtensilsCrossed, Search, Heart,
    Minus, Plus, ChevronRight, UserCircle, Filter, Check, MapPin, WifiOff, X
} from 'lucide-react-native';
import { RESTAURANTS, STORES } from '../lib/data';
import { useNavigation } from '@react-navigation/native';
import { useStores } from '../hooks/useStores';
import { useProducts } from '../hooks/useProducts';
import { ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { LinearGradient } from 'expo-linear-gradient';
import { useCart } from '../context/CartContext';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import TransactionalAuthModal from '../components/TransactionalAuthModal';
import ProductCard from '../components/ProductCard';
import { transformStoreData, checkIsOpen, TransformedStore } from '../utils/dataTransformer';
import { useCategories } from '../context/CategoryContext';
import { useFavorites } from '../hooks/useFavorites';
import { parseUtc } from '../utils/dateFormat';
import FilterSortModal, { ProductFilterState, DEFAULT_PRODUCT_FILTERS } from '../components/FilterSortModal';

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
    const { getVerticalName } = useCategories();
    const { stores, loading } = useStores();
    const storeId = route.params.storeId;
    const highlightProductId = route.params?.highlightProductId;
    const orderMode = route.params?.orderMode; // 'pickup' | 'dining' | undefined
    const { products: fetchedProducts, loading: productsLoading } = useProducts(String(storeId));

    // Cached restaurant: persists across useStores refetches so we never flash "not found"
    const [cachedRestaurant, setCachedRestaurant] = useState<TransformedStore | null>(null);

    const restaurant = useMemo(() => {
        const found = stores.find(s => s.id === String(storeId)) || null;
        return found;
    }, [stores, storeId]);

    // Cache the restaurant once found so it survives useStores loading cycles
    useEffect(() => {
        if (restaurant) setCachedRestaurant(restaurant);
    }, [restaurant]);

    // Fallback: if useStores doesn't have it, fetch the branch directly
    useEffect(() => {
        if (!loading && !restaurant && !cachedRestaurant) {
            (async () => {
                const { data } = await supabase
                    .from('merchant_branches')
                    .select('id, branch_name, address, merchant_id, is_active, operating_hours, prep_time_minutes, cuisines, is_veg, restaurant_type, branch_photos, service_table_booking, merchant:merchants(store_photos, cuisines, is_veg, restaurant_type, rating, vertical:Vertical(name))')
                    .eq('id', String(storeId))
                    .single();
                if (data) setCachedRestaurant(transformStoreData(data));
            })();
        }
    }, [loading, restaurant, cachedRestaurant, storeId]);

    // The effective restaurant data (never null after initial load)
    const displayRestaurant = restaurant || cachedRestaurant;

    // ─── Live Status: Real-time subscription for this specific branch ───
    const [liveStatus, setLiveStatus] = useState<{ isActive: boolean; operatingHours: any; prepTime: number } | null>(null);

    useEffect(() => {
        if (!storeId) return;

        // Initial status fetch
        const fetchStatus = async () => {
            const { data } = await supabase
                .from('merchant_branches')
                .select('is_active, operating_hours, prep_time_minutes')
                .eq('id', String(storeId))
                .single();
            if (data) {
                setLiveStatus({
                    isActive: data.is_active ?? true,
                    operatingHours: data.operating_hours,
                    prepTime: data.prep_time_minutes || 15,
                });
            }
        };
        fetchStatus();

        // Real-time subscription scoped to this branch
        const channel = supabase.channel(`storefront-live-${storeId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'merchant_branches',
                filter: `id=eq.${storeId}`,
            }, (payload: any) => {
                const row = payload.new;
                if (row) {
                    setLiveStatus({
                        isActive: row.is_active ?? true,
                        operatingHours: row.operating_hours,
                        prepTime: row.prep_time_minutes || 15,
                    });
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [storeId]);

    // Compute real-time open/closed status
    const isStoreOpen = useMemo(() => {
        if (liveStatus) {
            return checkIsOpen(liveStatus.isActive, liveStatus.operatingHours, liveStatus.prepTime);
        }
        return displayRestaurant?.isOpen ?? true;
    }, [liveStatus, displayRestaurant]);

    // Animated pulse for offline banner
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!isStoreOpen) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.6, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isStoreOpen]);

    const insets = useSafeAreaInsets();
    const [searchText, setSearchText] = useState('');
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);
    const [isHeaderSticky, setIsHeaderSticky] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(400);

    const sectionListRef = useRef<SectionList>(null);

    // Stable Viewability Configs to prevent SectionList Thrashing on Android
    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
    
    // Filter States
    const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
    const [bestSellerOnly, setBestSellerOnly] = useState(false);
    const [ratingHighOnly, setRatingHighOnly] = useState(false);
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [under300Only, setUnder300Only] = useState(false);
    const [offersOnly, setOffersOnly] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [modalFilters, setModalFilters] = useState<ProductFilterState>(DEFAULT_PRODUCT_FILTERS);

    // Smart-hide: pre-compute filter counts from unfiltered product list
    const filterCounts = useMemo(() => {
        const allProducts = fetchedProducts.length > 0 ? fetchedProducts : (displayRestaurant?.products || []);
        return {
            veg: allProducts.filter((p: any) => p.isVeg).length,
            nonVeg: allProducts.filter((p: any) => p.isVeg === false).length,
            bestseller: allProducts.filter((p: any) => p.isBestseller).length,
            offers: allProducts.filter((p: any) => p.discount > 0).length,
            under300: allProducts.filter((p: any) => p.price <= 300).length,
            total: allProducts.length,
        };
    }, [fetchedProducts, displayRestaurant]);

    const hasActiveFilters = vegFilter !== 'all' || bestSellerOnly || offersOnly || under300Only || modalFilters.sortBy !== 'relevance' || modalFilters.priceMin > 0 || modalFilters.priceMax < 1000;
    const clearAllFilters = () => {
        setVegFilter('all');
        setBestSellerOnly(false);
        setOffersOnly(false);
        setUnder300Only(false);
        setModalFilters({ ...DEFAULT_PRODUCT_FILTERS });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleModalApply = (newFilters: ProductFilterState) => {
        setModalFilters(newFilters);
        // Sync modal dietary/offers with inline filter state
        setVegFilter(newFilters.vegFilter);
        setBestSellerOnly(newFilters.bestsellerOnly);
        setOffersOnly(newFilters.offersOnly);
        // Map price range to under300Only for inline pill sync
        setUnder300Only(newFilters.priceMax <= 300 && newFilters.priceMax < 1000);
    };

    const [heroIndex, setHeroIndex] = useState(0);
    const heroScrollRef = useRef<ScrollView>(null);

    const { favorites, toggleFavorite } = useFavorites(() => setAuthModalVisible(true));
    const isFavorited = useMemo(() => favorites.includes(String(storeId)), [favorites, storeId]);

    // Highlight product scroll-to support
    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    const heroImages = useMemo(() => {
        if (!displayRestaurant) return [];
        const storeImgs = (displayRestaurant as any).storePhotos?.length > 0
            ? (displayRestaurant as any).storePhotos
            : [displayRestaurant.image];
        const images = [...storeImgs];
        const seen = new Set(images);
        const productsList = fetchedProducts.length > 0 ? fetchedProducts : (displayRestaurant.products || []);
        for (const p of productsList) {
            if (!seen.has((p as any).image)) {
                images.push((p as any).image);
                seen.add((p as any).image);
            }
            if (images.length >= 6) break;
        }
        return images;
    }, [displayRestaurant, fetchedProducts]);

    const groupedProducts = useMemo(() => {
        if (!displayRestaurant) return [];
        let productsList = fetchedProducts.length > 0 ? fetchedProducts : [...displayRestaurant.products];

        // Search Filter
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            productsList = productsList.filter((p: any) => p.name.toLowerCase().includes(q));
        }

        // Detailed Filters
        if (vegFilter === 'veg') productsList = productsList.filter((p: any) => p.isVeg);
        if (vegFilter === 'non-veg') productsList = productsList.filter((p: any) => p.isVeg === false);
        if (bestSellerOnly) productsList = productsList.filter((p: any) => p.isBestseller);
        if (ratingHighOnly) productsList = productsList.filter((p: any) => parseFloat(p.rating) >= 4.0);
        if (under300Only) productsList = productsList.filter((p: any) => p.price <= 300);
        if (offersOnly) productsList = productsList.filter((p: any) => p.discount > 0);

        // Price range filter (from modal — numeric min/max)
        if (modalFilters.priceMin > 0 || modalFilters.priceMax < 1000) {
            productsList = productsList.filter((p: any) =>
                (p.price || 0) >= modalFilters.priceMin && (p.price || 0) <= modalFilters.priceMax
            );
        }

        // Sort (from modal)
        if (modalFilters.sortBy === 'price_low') {
            productsList.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
        } else if (modalFilters.sortBy === 'price_high') {
            productsList.sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
        } else if (modalFilters.sortBy === 'popularity') {
            productsList.sort((a: any, b: any) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0));
        }

        // Group by subCategory using a Map for strict uniqueness to prevent duplicate header key crashes
        const groupMap = new Map<string, { title: string, rawData: any[] }>();
        
        productsList.forEach(p => {
            const categoryName = (p as any).product?.subcategory || p.subCategory || (p as any).category || 'Other';
            
            if (!groupMap.has(categoryName)) {
                groupMap.set(categoryName, { title: categoryName, rawData: [] });
            }
            groupMap.get(categoryName)!.rawData.push(p);
        });
        
        // Transform to SectionList format with chunked pairs for 2-column grid rendering
        return Array.from(groupMap.values()).map(section => {
            const chunks = [];
            for (let i = 0; i < section.rawData.length; i += 2) {
                chunks.push(section.rawData.slice(i, i + 2));
            }
            return { title: section.title, data: chunks };
        });
    }, [displayRestaurant, searchText, vegFilter, bestSellerOnly, ratingHighOnly, under300Only, offersOnly, fetchedProducts, modalFilters]);

    // Use groupedProducts as the source of truth for categories to ensure perfect alignment
    const storeCategories = useMemo(() => {
        return groupedProducts.map(s => s.title);
    }, [groupedProducts]);

    // Match count for FilterSortModal's Apply button preview
    const modalMatchCount = useMemo(() => {
        let list: any[] = fetchedProducts.length > 0 ? fetchedProducts : (displayRestaurant?.products || []);
        if (modalFilters.vegFilter === 'veg') list = list.filter((p: any) => p.isVeg);
        if (modalFilters.vegFilter === 'non-veg') list = list.filter((p: any) => p.isVeg === false);
        if (modalFilters.bestsellerOnly) list = list.filter((p: any) => p.isBestseller);
        if (modalFilters.offersOnly) list = list.filter((p: any) => p.discount > 0);
        if (modalFilters.priceMin > 0 || modalFilters.priceMax < 1000) {
            list = list.filter((p: any) =>
                (p.price || 0) >= modalFilters.priceMin && (p.price || 0) <= modalFilters.priceMax
            );
        }
        return list.length;
    }, [fetchedProducts, displayRestaurant, modalFilters]);

    // Scroll to highlighted product when arriving from search results
    useEffect(() => {
        if (!highlightProductId || groupedProducts.length === 0) return;

        // Find which section and item pair the product is in
        for (let sIdx = 0; sIdx < groupedProducts.length; sIdx++) {
            const section = groupedProducts[sIdx];
            for (let iIdx = 0; iIdx < section.data.length; iIdx++) {
                const pair = section.data[iIdx];
                if (pair.some((p: any) => String(p.id) === String(highlightProductId))) {
                    // Brief delay to let the SectionList mount
                    setTimeout(() => {
                        sectionListRef.current?.scrollToLocation({
                            sectionIndex: sIdx,
                            itemIndex: iIdx,
                            viewOffset: 100,
                            animated: true,
                        });
                        setHighlightedId(String(highlightProductId));
                        // Clear highlight after 2 seconds
                        setTimeout(() => setHighlightedId(null), 2000);
                    }, 600);
                    return;
                }
            }
        }
    }, [highlightProductId, groupedProducts]);

    // --- Loading & Not Found Guards (below all hooks) ---
    if (loading && !displayRestaurant) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#B52725" />
            </SafeAreaView>
        );
    }

    if (!displayRestaurant) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <Text className="text-lg text-gray-500 font-bold">Restaurant not found</Text>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="mt-4 px-6 py-2 bg-gray-100 rounded-xl"
                >
                    <Text className="text-gray-900 font-bold">Go Back</Text>
                </TouchableOpacity>
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
        if (!isStoreOpen) {
            Alert.alert('Store Offline', 'This store is currently not accepting orders.');
            return;
        }
        if ((product.stock !== undefined && product.stock !== null) && product.stock <= 0) {
            Alert.alert('Out of Stock', 'This item is currently unavailable.');
            return;
        }
        addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            storeId: String(displayRestaurant.id),
            storeName: displayRestaurant.name,
            isDining: orderMode === 'dining' ? true : orderMode === 'pickup' ? false : displayRestaurant.isDining,
            isVeg: product.isVeg ?? true,
            uom: product.uom || '1 Pc',
            stock: product.stock,
        });
    };

    const handleIncrement = (id: string, newQty: number) => {
        if (!isStoreOpen) {
            Alert.alert('Store Offline', 'This store is currently not accepting orders.');
            return;
        }
        updateQuantity(String(id), newQty);
    };

    const handleDecrement = (id: string, newQty: number) => {
        updateQuantity(String(id), newQty);
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
                                placeholder={`Search in ${displayRestaurant.name}`}
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholderTextColor="#9CA3AF"
                                style={{ textAlignVertical: 'center', paddingVertical: 0, includeFontPadding: false }}
                            />
                            {searchText.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <X size={18} color="#6B7280" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            delayPressIn={0}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilterModalVisible(true); }}
                            className="p-2 relative"
                        >
                            <Filter size={22} color="#4B5563" />
                            {hasActiveFilters && (
                                <View style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#B52725' }} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Quick Filters in Sticky Header — smart-hide: only show pills with ≥1 match */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 pb-3" contentContainerStyle={{ alignItems: 'center' }} style={{ flexGrow: 0, flexShrink: 0 }}>
                        {displayRestaurant.isDining && filterCounts.veg > 0 && filterCounts.nonVeg > 0 && <VegToggle value={vegFilter} onChange={setVegFilter} />}
                        {filterCounts.bestseller > 0 && <FilterPill label="Bestsellers" active={bestSellerOnly} onPress={() => setBestSellerOnly(!bestSellerOnly)} icon={Check} colorClass="red" />}
                        {filterCounts.offers > 0 && <FilterPill label="Offers" active={offersOnly} onPress={() => setOffersOnly(!offersOnly)} icon={Filter} colorClass="red" />}
                        {filterCounts.under300 > 0 && filterCounts.under300 < filterCounts.total && <FilterPill label="Under ₹300" active={under300Only} onPress={() => setUnder300Only(!under300Only)} colorClass="blue" />}
                        {hasActiveFilters && (
                            <TouchableOpacity onPress={clearAllFilters} style={{ marginLeft: 4, paddingHorizontal: 8, paddingVertical: 6 }}>
                                <Text style={{ color: '#B52725', fontSize: 12, fontWeight: '600' }}>Clear all</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* ===== CATEGORY UNDERLINE TABS (Sticky — only when scrolled past header) ===== */}
            {isHeaderSticky && (
                <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }} style={{ flexGrow: 0, flexShrink: 0 }}>
                        {groupedProducts.map((section, idx) => (
                            <TouchableOpacity
                                delayPressIn={0}
                                key={`sticky-cat-${section.title}`}
                                onPress={() => scrollToSection(idx)}
                                style={{
                                    paddingHorizontal: 16,
                                    paddingTop: 14,
                                    paddingBottom: 12,
                                    borderBottomWidth: activeSectionIndex === idx ? 2.5 : 0,
                                    borderBottomColor: '#B52725',
                                }}
                            >
                                <Text style={{
                                    fontSize: 14,
                                    fontWeight: activeSectionIndex === idx ? '700' : '500',
                                    color: activeSectionIndex === idx ? '#1F2937' : '#9CA3AF',
                                }}>
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
                        <View className="flex-row px-4 mb-4" style={{ gap: 16, opacity: isStoreOpen ? 1 : 0.4 }}>
                            {item.map((product: any) => (
                                <View
                                    key={`product-${product.id}`}
                                    className="flex-1"
                                    style={highlightedId && String(product.id) === highlightedId ? {
                                        borderWidth: 2,
                                        borderColor: '#B52725',
                                        borderRadius: 22,
                                        shadowColor: '#B52725',
                                        shadowOpacity: 0.3,
                                        shadowRadius: 8,
                                        shadowOffset: { width: 0, height: 0 },
                                        elevation: 6,
                                    } : undefined}
                                >
                                    <ProductCard
                                        item={product}
                                        quantity={getItemQuantity(product.id)}
                                        onAdd={handleAddToCart}
                                        onIncrement={handleIncrement}
                                        onDecrement={handleDecrement}
                                        onAuthRequired={() => setAuthModalVisible(true)}
                                    />
                                </View>
                            ))}
                            {item.length === 1 && <View className="flex-1" />}
                        </View>
                    );
                }}
                renderSectionHeader={({ section: { title } }) => (
                    <View className="bg-white px-5 py-4 mb-2 mt-4 flex-row items-center border-b border-gray-100" style={{ opacity: isStoreOpen ? 1 : 0.4 }}>
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

                                {/* Pagination dots — positioned above the profile photo */}
                                <View className="absolute flex-row items-center justify-center" style={{ bottom: 100, left: 0, right: 0 }}>
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
                                    <Image source={{ uri: displayRestaurant.image }} className="w-full h-full rounded-full" />
                                </View>
                            </View>

                            {/* Favorite button (Safe area inside 324px bound) */}
                            <TouchableOpacity
                                delayPressIn={0}
                                onPress={() => toggleFavorite(String(displayRestaurant.id))}
                                className="absolute bg-gray-900/80 rounded-full items-center justify-center shadow-md"
                                style={{ bottom: 22, right: 24, width: 44, height: 44, zIndex: 20, elevation: 20 }}
                            >
                                <Heart size={20} color="#FFFFFF" fill={isFavorited ? '#B52725' : 'transparent'} />
                            </TouchableOpacity>
                        </View>

                        {/* ===== RESTAURANT INFO ===== */}
                        <View className="items-center px-6" style={{ marginTop: 2 }}>
                            <Text className="text-[22px] font-bold text-gray-900 text-center">{displayRestaurant.name}</Text>
                            <Text className="text-[13px] text-gray-500 font-medium text-center" style={{ marginTop: 6 }}>{displayRestaurant.address}</Text>

                            <View className="flex-row items-center justify-center" style={{ marginTop: 16 }}>
                                <View className="flex-row items-center px-3 py-2">
                                    {displayRestaurant.rating ? (
                                        <>
                                            <Star size={16} color="#1F2937" fill="#1F2937" />
                                            <Text className="text-[14px] font-bold text-gray-900 ml-1.5">{displayRestaurant.rating}</Text>
                                        </>
                                    ) : (((displayRestaurant as any).created_at || (displayRestaurant as any).createdAt) && (new Date().getTime() - parseUtc((displayRestaurant as any).created_at || (displayRestaurant as any).createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000) ? (
                                        <View className="bg-gray-100 px-2 py-0.5 rounded-md">
                                            <Text className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">NEW</Text>
                                        </View>
                                    ) : null}
                                </View>
                                {(displayRestaurant as any).distance ? (
                                    <>
                                        <View className="w-[1px] h-5 bg-gray-200 mx-2" />
                                        <View className="flex-row items-center px-3 py-2">
                                            <MapPin size={16} color="#6B7280" />
                                            <Text className="text-[14px] font-medium text-gray-600 ml-1.5">{(displayRestaurant as any).distance}</Text>
                                        </View>
                                    </>
                                ) : null}
                                <View className="w-[1px] h-5 bg-gray-200 mx-2" />
                                <View className="flex-row items-center px-3 py-2">
                                    {isStoreOpen ? (
                                        <Text className="text-[14px] font-bold text-green-600">Open Now</Text>
                                    ) : (
                                        <Text className="text-[14px] font-bold text-red-600">Closed</Text>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* ===== ANIMATED OFFLINE BANNER ===== */}
                        {!isStoreOpen && (
                            <Animated.View style={{ opacity: pulseAnim, marginHorizontal: 20, marginTop: 20 }}>
                                <View style={{
                                    backgroundColor: '#1F2937',
                                    borderRadius: 20,
                                    padding: 24,
                                    alignItems: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 12,
                                    elevation: 8,
                                }}>
                                    <View style={{
                                        width: 56, height: 56, borderRadius: 28,
                                        backgroundColor: 'rgba(239,68,68,0.15)',
                                        alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 14,
                                    }}>
                                        <WifiOff size={28} color="#EF4444" />
                                    </View>
                                    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 }}>
                                        Store is Currently Offline
                                    </Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 }}>
                                        This store is not accepting orders right now.{'\n'}Browse the menu and come back later!
                                    </Text>
                                </View>
                            </Animated.View>
                        )}

                        {/* ===== SEARCH & FILTERS ===== */}
                        <View className="px-5" style={{ marginTop: 28 }}>
                            {/* Search Bar + Filter Icon */}
                            <View className="flex-row items-center">
                                <View className="flex-1 h-14 bg-gray-50 rounded-2xl border border-gray-100 flex-row items-center px-4 shadow-sm">
                                    <Search size={20} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 font-medium text-[15px] text-gray-800"
                                        placeholder={`Search menu in ${displayRestaurant.name}`}
                                        placeholderTextColor="#9CA3AF"
                                        value={searchText}
                                        onChangeText={setSearchText}
                                        style={{ textAlignVertical: 'center', paddingVertical: 0, includeFontPadding: false }}
                                    />
                                    {searchText.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <X size={20} color="#6B7280" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <TouchableOpacity
                                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilterModalVisible(true); }}
                                    className="ml-3 w-14 h-14 bg-gray-50 rounded-2xl border border-gray-100 items-center justify-center shadow-sm relative"
                                >
                                    <Filter size={22} color="#4B5563" />
                                    {hasActiveFilters && (
                                        <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#B52725' }} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Smart-hide Filter Pills — only show pills with ≥1 matching product */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                className="mt-5"
                                style={{ marginHorizontal: -20, paddingHorizontal: 20, flexGrow: 0, flexShrink: 0 }}
                                contentContainerStyle={{ paddingBottom: 14, alignItems: 'center' }}
                            >
                                {displayRestaurant.isDining && filterCounts.veg > 0 && filterCounts.nonVeg > 0 && <VegToggle value={vegFilter} onChange={setVegFilter} />}
                                {filterCounts.bestseller > 0 && <FilterPill label="Bestsellers" active={bestSellerOnly} onPress={() => setBestSellerOnly(!bestSellerOnly)} icon={Check} colorClass="red" />}
                                {filterCounts.offers > 0 && <FilterPill label="Offers" active={offersOnly} onPress={() => setOffersOnly(!offersOnly)} icon={Filter} colorClass="red" />}
                                {filterCounts.under300 > 0 && filterCounts.under300 < filterCounts.total && <FilterPill label="Under ₹300" active={under300Only} onPress={() => setUnder300Only(!under300Only)} colorClass="blue" />}
                                {hasActiveFilters && (
                                    <TouchableOpacity onPress={clearAllFilters} style={{ marginLeft: 4, paddingHorizontal: 8, paddingVertical: 6 }}>
                                        <Text style={{ color: '#B52725', fontSize: 12, fontWeight: '600' }}>Clear all</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </View>

                        {/* ===== CATEGORY UNDERLINE TABS (inline — scrolls with content) ===== */}
                        <View style={{ backgroundColor: 'white', marginTop: 4, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }} style={{ flexGrow: 0, flexShrink: 0 }}>
                                {groupedProducts.map((section, idx) => (
                                    <TouchableOpacity
                                        delayPressIn={0}
                                        key={`inline-cat-${section.title}`}
                                        onPress={() => scrollToSection(idx)}
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingTop: 14,
                                            paddingBottom: 12,
                                            borderBottomWidth: activeSectionIndex === idx ? 2.5 : 0,
                                            borderBottomColor: '#B52725',
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: activeSectionIndex === idx ? '700' : '500',
                                            color: activeSectionIndex === idx ? '#1F2937' : '#9CA3AF',
                                        }}>
                                            {section.title}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Search Results Summary */}
                        {searchText.trim() !== '' && (
                            <Text className="px-5 text-[14px] font-bold text-gray-500 mb-6 mt-4">
                                {groupedProducts.reduce((sum, s) => sum + s.data.reduce((a, chunk) => a + chunk.length, 0), 0)} items found for &quot;{searchText}&quot;
                            </Text>
                        )}

                        {/* Product Loading State for Grid Area */}
                        {productsLoading && (
                            <View className="py-10 items-center justify-center">
                                <ActivityIndicator size="large" color="#B52725" />
                                <Text className="text-gray-400 mt-2 font-medium">Fetching fresh menu...</Text>
                            </View>
                        )}
                    </View>
                }
            />



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

            <FilterSortModal
                visible={filterModalVisible}
                filters={modalFilters}
                onApply={handleModalApply}
                onClose={() => setFilterModalVisible(false)}
                matchCount={modalMatchCount}
            />
        </View>
    );
}
