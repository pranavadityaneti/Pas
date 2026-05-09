import React, { useState, useMemo } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    Dimensions, TextInput, ActivityIndicator, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft, Search, Star, ShoppingBag,
    ChevronRight, MapPin, Store as StoreIcon, Filter,
    MapPinOff, WifiOff, RefreshCcw, X, Check, Clock
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
    const [modalSortBy, setModalSortBy] = useState<'distance' | 'prep_time'>('distance');
    const [modalRadius, setModalRadius] = useState(10000);

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

        // ── Modal filters (applied before quick filters) ──
        // Radius filter from Bottom Modal
        list = list.filter(s => s.rawDist <= modalRadius);

        // Modal sort
        if (modalSortBy === 'distance') {
            list.sort((a, b) => a.rawDist - b.rawDist);
        } else if (modalSortBy === 'prep_time') {
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
    }, [stores, categoryName, searchText, nearbyStoreIds, distanceMap, activeSubCategory, categoryItems, activeQuickFilter, modalSortBy, modalRadius]);

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
                        />
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

            {/* ═══════ FILTER BOTTOM SHEET MODAL ═══════ */}
            <Modal
                visible={isFilterModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View className="bg-white rounded-t-[32px] overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-gray-50">
                            <View>
                                <Text className="text-gray-900 text-lg font-bold">Filters</Text>
                                <Text className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Refine your results</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setFilterModalVisible(false)}
                                className="bg-gray-100 p-2 rounded-full"
                            >
                                <X size={18} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View className="px-6 pt-5 pb-3">
                            {/* ── Section 1: Sort By ── */}
                            <Text className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-3">Sort By</Text>

                            <TouchableOpacity
                                onPress={() => {
                                    setModalSortBy('distance');
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={`flex-row items-center p-3.5 rounded-2xl mb-2 border-2 ${modalSortBy === 'distance' ? 'border-[#B52725] bg-red-50' : 'border-gray-100 bg-white'}`}
                                activeOpacity={0.8}
                            >
                                <View className={`w-9 h-9 rounded-xl items-center justify-center ${modalSortBy === 'distance' ? 'bg-[#B52725]' : 'bg-gray-50'}`}>
                                    <MapPin size={16} color={modalSortBy === 'distance' ? 'white' : '#9CA3AF'} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className={`text-[14px] font-bold ${modalSortBy === 'distance' ? 'text-gray-900' : 'text-gray-600'}`}>Distance (Nearest First)</Text>
                                    <Text className="text-[10px] text-gray-400 font-medium">Show closest stores at the top</Text>
                                </View>
                                {modalSortBy === 'distance' && <Check size={18} color="#B52725" />}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setModalSortBy('prep_time');
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={`flex-row items-center p-3.5 rounded-2xl mb-2 border-2 ${modalSortBy === 'prep_time' ? 'border-[#B52725] bg-red-50' : 'border-gray-100 bg-white'}`}
                                activeOpacity={0.8}
                            >
                                <View className={`w-9 h-9 rounded-xl items-center justify-center ${modalSortBy === 'prep_time' ? 'bg-[#B52725]' : 'bg-gray-50'}`}>
                                    <Clock size={16} color={modalSortBy === 'prep_time' ? 'white' : '#9CA3AF'} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className={`text-[14px] font-bold ${modalSortBy === 'prep_time' ? 'text-gray-900' : 'text-gray-600'}`}>Prep Time (Fastest First)</Text>
                                    <Text className="text-[10px] text-gray-400 font-medium">Prioritize quick turnaround stores</Text>
                                </View>
                                {modalSortBy === 'prep_time' && <Check size={18} color="#B52725" />}
                            </TouchableOpacity>

                            {/* ── Section 2: Distance ── */}
                            <Text className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mt-5 mb-3">Distance</Text>
                            <View className="flex-row" style={{ gap: 10 }}>
                                {[
                                    { label: '< 1 km', value: 1000 },
                                    { label: '< 3 km', value: 3000 },
                                    { label: '< 10 km', value: 10000 },
                                ].map(opt => {
                                    const isActive = modalRadius === opt.value;
                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            onPress={() => {
                                                setModalRadius(opt.value);
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }}
                                            className={`flex-1 py-3 rounded-2xl border-2 items-center ${isActive ? 'border-[#B52725] bg-red-50' : 'border-gray-100 bg-white'}`}
                                        >
                                            <Text className={`text-[14px] font-bold ${isActive ? 'text-[#B52725]' : 'text-gray-600'}`}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* ── Apply Button ── */}
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    setFilterModalVisible(false);
                                }}
                                className="bg-[#B52725] py-4 rounded-2xl items-center mt-6 mb-2 shadow-md"
                            >
                                <Text className="text-white font-bold uppercase tracking-widest text-[13px]">Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}
