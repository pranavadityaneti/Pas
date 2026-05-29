import React, { useState, useMemo } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    Dimensions, TextInput, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft, Search, Star, ShoppingBag,
    ChevronRight, MapPin, Store as StoreIcon, Filter,
    MapPinOff, WifiOff, RefreshCcw, X
} from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCart } from '../context/CartContext';
import { useCategories } from '../context/CategoryContext';
import * as Haptics from 'expo-haptics';
import CartSummaryBar from '../components/CartSummaryBar';
import ProductCard from '../components/ProductCard';
import { LinearGradient } from 'expo-linear-gradient';
import { useStores } from '../hooks/useStores';
import { useSubCategories } from '../hooks/useSubCategories';
import { useCategoryItems } from '../hooks/useCategoryItems';
import { useNearbyStores } from '../hooks/useNearbyStores';
import { useLocation } from '../context/LocationContext';
import StoreFilterModal, { StoreModalFilters, DEFAULT_MODAL_FILTERS } from '../components/StoreFilterModal';
import { getFilterConfig } from '../utils/filterConfig';

const { width } = Dimensions.get('window');

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200&h=200&fit=crop';

// ── USP taglines by category ──
const CATEGORY_USPS: Record<string, string> = {
    'Grocery & Kirana': 'Fresh, high-quality essentials delivered fast.',
    'Fresh Fruits': 'Farm-fresh produce, handpicked daily.',
    'Restaurants & Cafes': 'Your favorite meals, ready for pickup.',
    'Bakeries & Desserts': 'Freshly baked, straight from the oven.',
    'Sports and fitness': 'Gear up for your best performance.',
    'Pharmacy & Wellness': 'Health essentials at your fingertips.',
    'Electronics & Accessories': 'Latest tech, best prices nearby.',
    'Fashion & Apparel': 'Trending styles from local boutiques.',
    'Home & Lifestyle': 'Upgrade your living, one find at a time.',
    'Beauty & Personal Care': 'Glow up with curated beauty picks.',
    'Pet Care & Supplies': 'Everything your furry friend needs.',
};

const QUICK_FILTERS = [
    { id: 'open_now', label: 'Open Now' },
    { id: 'nearest', label: 'Nearest' },
    { id: 'open_late', label: 'Open Late' },
];

// Static hero banners removed; now using database values via CategoryContext

const DEFAULT_HERO = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=400&fit=crop';

export default function CategoryDetailScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'CategoryDetail'>>();
    const { categoryId, categoryName } = route.params;
    const { items, getTotal, addItem } = useCart();
    const { stores, loading } = useStores();
    const { verticals } = useCategories();
    const { permissionDenied } = useLocation();

    // ── Derive verticalId from categoryName ──
    const currentVertical = useMemo(
        () => verticals.find(v => v.name === categoryName),
        [verticals, categoryName]
    );
    const currentVerticalId = currentVertical?.id || null;

    // ── Live data hooks ──
    const { subCategories, loading: subCategoriesLoading } = useSubCategories(currentVerticalId);
    
    // ── Geospatial Proximity Hook ──
    const { nearbyStoreIds, distanceMap, loading: nearbyLoading } = useNearbyStores();

    // Wire dynamically calculated, GPS-verified store IDs into the inventory funnel
    const { items: categoryItems, loading: itemsLoading, error: itemsError, refetch: refetchItems } = useCategoryItems(nearbyStoreIds, currentVerticalId || '');

    // ── State ──
    const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);

    // ── Filter Modal State ──
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);
    const [storeFilters, setStoreFilters] = useState<StoreModalFilters>({ ...DEFAULT_MODAL_FILTERS });

    // ── Dynamic filter config based on category ──
    const filterConfig = useMemo(() => getFilterConfig(categoryName), [categoryName]);

    // ── Available brands from category items ──
    const availableBrands = useMemo(() => {
        if (!filterConfig.showBrands) return [];
        const brands = [...new Set(
            categoryItems
                .map(item => (item.product as any)?.brand)
                .filter(Boolean)
        )].sort();
        return brands as string[];
    }, [categoryItems, filterConfig.showBrands]);

    // ── Data: Filter stores by vertical name matching categoryName ──
    const categoryStores = useMemo(() => {
        // Enforce strict geospatial bounding: must match vertical + be within 15km
        // Inject rawDist from distanceMap for numeric sorting
        let list = stores
            .filter(s => s.category === categoryName && nearbyStoreIds.includes(s.id))
            .map(s => ({ ...s, rawDist: distanceMap[s.id] ?? 999999 }));

        // Subcategory filter: only show stores that carry items in the selected subcategory
        if (activeSubCategory) {
            const storeIdsWithSubcat = new Set(
                categoryItems
                    .filter(item => item.product?.category_id === activeSubCategory)
                    .map(item => item.store_id)
            );
            list = list.filter(s => storeIdsWithSubcat.has(s.id));
        }

        if (searchText) {
            const q = searchText.toLowerCase();
            list = list.filter(s => s.name.toLowerCase().includes(q));
        }

        // ── StoreFilterModal filters (applied before quick filters) ──
        if (storeFilters.maxDistance) list = list.filter(s => s.rawDist <= storeFilters.maxDistance! * 1000);
        if (storeFilters.openNow) list = list.filter(s => s.isOpen);
        if (storeFilters.pureVeg) list = list.filter(s => (s as any).isVeg);
        if (storeFilters.priceMin > 0 || storeFilters.priceMax < 1000) {
            const storeIdsInPriceRange = new Set(
                categoryItems
                    .filter(item => item.price >= storeFilters.priceMin && item.price <= storeFilters.priceMax)
                    .map(item => item.store_id)
            );
            list = list.filter(s => storeIdsInPriceRange.has(s.id));
        }
        if (storeFilters.brands.length > 0) {
            const storeIdsWithBrand = new Set(
                categoryItems
                    .filter(item => storeFilters.brands.includes((item.product as any)?.brand))
                    .map(item => item.store_id)
            );
            list = list.filter(s => storeIdsWithBrand.has(s.id));
        }

        // Modal sort
        if (storeFilters.sortBy === 'distance') {
            list.sort((a, b) => a.rawDist - b.rawDist);
        } else if (storeFilters.sortBy === 'prep_time') {
            list.sort((a, b) => (parseInt(a.prepTime || '99') || 99) - (parseInt(b.prepTime || '99') || 99));
        }

        // ── Quick filter pills (applied after modal sort) ──
        if (activeQuickFilter === 'open_now') {
            list = list.filter(s => s.isOpen);
        } else if (activeQuickFilter === 'nearest') {
            list.sort((a, b) => {
                const distA = a.rawDist ?? 999999;
                const distB = b.rawDist ?? 999999;
                return distA - distB;
            });
        } else if (activeQuickFilter === 'open_late') {
            list = list.filter(s => {
                const hours = s.operating_hours;
                if (!hours) return false;
                // Check for 24/7 or late closing (>= 23:00)
                if (hours.is_24_7) return true;
                const closing = hours.closing_time || hours.close;
                if (closing && closing >= '23:00') return true;
                return false;
            });
        }

        return list;
    }, [stores, categoryName, searchText, nearbyStoreIds, distanceMap, activeSubCategory, categoryItems, activeQuickFilter, storeFilters]);

    const heroImage = currentVertical?.banner_url || DEFAULT_HERO;

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            <ScrollView
                className="flex-1 bg-[#F8F9FA]"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                stickyHeaderIndices={[2]}
            >
                {/* ═══════ 1. Hero Banner (~320px, full image visible) ═══════ */}
                <View style={{ height: 320, position: 'relative', backgroundColor: '#F3F0EB' }}>
                    <Image
                        source={typeof heroImage === 'string' ? { uri: heroImage } : heroImage}
                        className="w-full h-full"
                        resizeMode="contain"
                    />
                    <LinearGradient
                        colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.7)']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    />

                    {/* Back Button */}
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="absolute top-4 left-5 w-10 h-10 rounded-full bg-black/40 items-center justify-center"
                    >
                        <ArrowLeft size={20} color="#FFFFFF" />
                    </TouchableOpacity>

                </View>

                {/* ═══════ 2. Sub-Category 5-Column Grid (Live Data) ═══════ */}
                {subCategories.length > 0 && (
                    <View className="bg-white py-4 px-5 border-b border-gray-100">
                        <View className="flex-row flex-wrap" style={{ justifyContent: 'flex-start' }}>
                            {subCategories.map((sub) => {
                                const isActive = activeSubCategory === sub.id;
                                return (
                                    <TouchableOpacity
                                        key={sub.id}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setActiveSubCategory(isActive ? null : sub.id);
                                            console.log('[SubCategory Tap]', sub.id, sub.name);
                                        }}
                                        style={{ width: (width - 40) / 5 }}
                                        className="items-center mb-3"
                                    >
                                        <View className={`w-16 h-16 rounded-full overflow-hidden border-2 ${isActive ? 'border-[#B52725]' : 'border-gray-100'}`}>
                                            <Image
                                                source={{ uri: sub.image || PLACEHOLDER_IMAGE }}
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                        </View>
                                        <Text
                                            className={`text-[10px] font-semibold text-center mt-1.5 ${isActive ? 'text-[#B52725]' : 'text-gray-700'}`}
                                            numberOfLines={2}
                                            style={{ width: (width - 40) / 5 - 4 }}
                                        >
                                            {sub.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ═══════ 3. Search Bar ═══════ */}
                <View className="px-5 mt-6">
                    <View className="flex-row items-center px-4 h-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-3 font-semibold text-sm text-gray-800"
                            placeholder={`Search stores in ${categoryName}...`}
                            placeholderTextColor="#9CA3AF"
                            value={searchText}
                            onChangeText={setSearchText}
                            style={{ textAlignVertical: 'center', paddingVertical: 0, includeFontPadding: false }}
                        />
                        {searchText.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <X size={18} color="#6B7280" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* ═══════ Quick Filter Pills ═══════ */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mt-3"
                    contentContainerStyle={{ paddingHorizontal: 20 }}
                >
                    {/* Filter Button */}
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.selectionAsync();
                            setFilterModalVisible(true);
                        }}
                        className="flex-row items-center rounded-full border border-gray-300 px-4 py-1.5 mr-2 bg-white"
                    >
                        <Filter size={13} color="#4B5563" />
                        <Text className="text-[12px] font-bold text-gray-700 ml-1.5">Filter</Text>
                    </TouchableOpacity>

                    {QUICK_FILTERS.map(f => {
                        const isActive = activeQuickFilter === f.id;
                        return (
                            <TouchableOpacity
                                key={f.id}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setActiveQuickFilter(isActive ? null : f.id);
                                }}
                                className={`rounded-full border px-4 py-1.5 mr-2 ${isActive ? 'bg-[#B52725] border-[#B52725]' : 'bg-white border-gray-300'}`}
                            >
                                <Text className={`text-[12px] font-bold ${isActive ? 'text-white' : 'text-gray-700'}`}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* ═══════ STORES LIST ═══════ */}
                {/* Store Count */}
                <View className="px-5 mt-5 mb-3">
                    <Text className="text-[13px] font-semibold text-gray-500">
                        {categoryStores.length} {categoryStores.length === 1 ? 'store' : 'stores'} found
                    </Text>
                </View>

                {loading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator size="large" color="#B52725" />
                    </View>
                ) : categoryStores.length > 0 ? (
                    categoryStores.map(store => (
                        <TouchableOpacity
                            key={store.id}
                            activeOpacity={0.92}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                navigation.navigate('Storefront', { storeId: store.id });
                            }}
                            className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm border border-gray-100 mx-5"
                        >
                            {/* Store Image */}
                            <View style={{ height: 140, overflow: 'hidden' }}>
                                <Image source={{ uri: store.image }} className="w-full h-full" />
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.5)']}
                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                />
                                {/* Distance Badge */}
                                <View className="absolute top-3 right-3 bg-white/95 px-2.5 py-1.5 rounded-xl flex-row items-center">
                                    <MapPin size={11} color="#B52725" />
                                    <Text className="text-[11px] font-bold text-gray-900 ml-1">{store.distance}</Text>
                                </View>
                            </View>

                            {/* Store Info */}
                            <View className="px-4 py-3">
                                <Text className="text-[16px] font-bold text-gray-900" numberOfLines={1}>{store.name}</Text>
                                <View className="flex-row items-center mt-2" style={{ gap: 12 }}>
                                    {store.rating ? (
                                        <View className="flex-row items-center bg-green-50 rounded-lg px-2 py-1">
                                            <Star size={12} color="#16a34a" fill="#16a34a" />
                                            <Text className="text-[12px] font-bold text-green-700 ml-1">{store.rating}</Text>
                                        </View>
                                    ) : (
                                        <View className="bg-blue-50 rounded-lg px-2 py-1">
                                            <Text className="text-[10px] font-extrabold text-blue-600 uppercase">NEW</Text>
                                        </View>
                                    )}
                                    <Text className="text-[12px] font-medium text-gray-400 capitalize">{store.category}</Text>
                                    <View className="flex-1 flex-row justify-end items-center">
                                        <Text className="text-[12px] font-bold text-[#B52725]">View Store</Text>
                                        <ChevronRight size={14} color="#B52725" />
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View className="py-20 items-center justify-center">
                        <StoreIcon size={48} color="#E5E7EB" strokeWidth={1} />
                        <Text className="text-gray-900 font-bold mt-4">No stores found</Text>
                        <Text className="text-gray-400 text-[13px] font-medium text-center mt-1 px-10">
                            We haven't onboarded stores in this category yet. Check back soon!
                        </Text>
                    </View>
                )}
            </ScrollView>

            {getTotal() > 0 && <CartSummaryBar itemCount={items.length} totalAmount={getTotal()} />}

            {/* ═══════ FILTER MODAL (Dynamic per category) ═══════ */}
            <StoreFilterModal
                visible={isFilterModalVisible}
                filters={storeFilters}
                onApply={(f) => setStoreFilters(f)}
                onClose={() => setFilterModalVisible(false)}
                showDietary={filterConfig.showDietary}
                showBrands={filterConfig.showBrands}
                availableBrands={availableBrands}
                showRatings={filterConfig.showRatings}
                showPriceRange={filterConfig.showPriceRange}
                showSortOptions={filterConfig.showSortOptions}
            />

        </SafeAreaView>
    );
}
