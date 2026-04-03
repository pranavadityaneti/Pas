import React, { useState, useMemo } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    Dimensions, TextInput, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft, Search, Star, ShoppingBag,
    ChevronRight, MapPin, Store as StoreIcon, Filter,
    MapPinOff, WifiOff, RefreshCcw
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
    { id: 'top_rated', label: 'Top Rated' },
    { id: 'offers', label: 'Offers' },
    { id: 'pure_veg', label: 'Pure Veg' },
    { id: 'under_500', label: 'Under ₹500' },
];

// ── Hero banner image mapping by category ──
const HERO_BANNERS: Record<string, any> = {
    'Grocery & Kirana': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=400&fit=crop',
    'Fresh Fruits': require('../../assets/images/fresh_fruits_banner.jpg'),
    'Restaurants & Cafes': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
    'Bakeries & Desserts': 'https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=800&h=400&fit=crop',
    'Sports and fitness': 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=400&fit=crop',
    'Pharmacy & Wellness': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=400&fit=crop',
    'Electronics & Accessories': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&h=400&fit=crop',
    'Fashion & Apparel': 'https://images.unsplash.com/photo-1445205170230-053b830c6046?w=800&h=400&fit=crop',
    'Home & Lifestyle': 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&h=400&fit=crop',
    'Beauty & Personal Care': 'https://images.unsplash.com/photo-1596462502278-27bfdc4033c8?w=800&h=400&fit=crop',
    'Pet Care & Supplies': 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&h=400&fit=crop',
};

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
    const { nearbyStoreIds, loading: nearbyLoading } = useNearbyStores();

    // Wire dynamically calculated, GPS-verified store IDs into the inventory funnel
    const { items: categoryItems, loading: itemsLoading, error: itemsError, refetch: refetchItems } = useCategoryItems(nearbyStoreIds, currentVerticalId || '');

    // ── State ──
    const [activeTab, setActiveTab] = useState<'stores' | 'items'>('stores');
    const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);

    // ── Data: Filter stores by vertical name matching categoryName ──
    const categoryStores = useMemo(() => {
        // Enforce strict geospatial bounding: must match vertical + be within 15km
        let list = stores.filter(s => s.category === categoryName && nearbyStoreIds.includes(s.id));

        if (searchText) {
            const q = searchText.toLowerCase();
            list = list.filter(s => s.name.toLowerCase().includes(q));
        }

        return list;
    }, [stores, categoryName, searchText]);

    const heroImage = HERO_BANNERS[categoryName] || DEFAULT_HERO;

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

                    {/* Category Title + USP */}
                    <View className="absolute bottom-6 left-5 right-5">
                        <Text className="text-white text-2xl font-extrabold" numberOfLines={1}>
                            {categoryName}
                        </Text>
                        <Text className="text-white/90 text-[13px] font-medium mt-1.5" numberOfLines={1}>
                            {CATEGORY_USPS[categoryName] || 'Discover the best picks near you.'}
                        </Text>
                        <Text className="text-white/60 text-[11px] font-semibold mt-1">
                            {categoryStores.length} {categoryStores.length === 1 ? 'store' : 'stores'} near you
                        </Text>
                    </View>
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

                {/* ═══════ 3. Sticky Stores / Items Toggle ═══════ */}
                <View className="bg-white px-5 pt-3 pb-3 border-b border-gray-100">
                    <View className="flex-row bg-gray-100 rounded-xl p-1">
                        <TouchableOpacity
                            onPress={() => { Haptics.selectionAsync(); setActiveTab('stores'); setSearchText(''); }}
                            className={`flex-1 py-2.5 rounded-lg items-center justify-center ${activeTab === 'stores' ? 'bg-[#B52725] shadow-sm' : ''}`}
                        >
                            <Text className={`font-bold text-[13px] ${activeTab === 'stores' ? 'text-white' : 'text-gray-500'}`}>
                                🏪  Stores
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { Haptics.selectionAsync(); setActiveTab('items'); setSearchText(''); }}
                            className={`flex-1 py-2.5 rounded-lg items-center justify-center ${activeTab === 'items' ? 'bg-[#B52725] shadow-sm' : ''}`}
                        >
                            <Text className={`font-bold text-[13px] ${activeTab === 'items' ? 'text-white' : 'text-gray-500'}`}>
                                🛒  Items
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ═══════ Search Bar ═══════ */}
                <View className="px-5 mt-4">
                    <View className="flex-row items-center px-4 h-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-3 font-semibold text-sm text-gray-800"
                            placeholder={activeTab === 'stores' ? `Search stores in ${categoryName}...` : `Search items in ${categoryName}...`}
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
                        onPress={() => Haptics.selectionAsync()}
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

                {/* ═══════ STORES TAB ═══════ */}
                {activeTab === 'stores' && (
                    <>
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
                    </>
                )}

                {/* ═══════ ITEMS TAB ═══════ */}
                {activeTab === 'items' && (
                    <View className="px-5 mt-5">
                        {itemsLoading ? (
                            <View className="py-20 items-center">
                                <ActivityIndicator size="large" color="#B52725" />
                            </View>
                        ) : categoryItems.length > 0 ? (
                            <View className="flex-row flex-wrap justify-between">
                                {categoryItems.map((item) => (
                                    <View key={item.id} className="w-[48%] mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                        <View className="aspect-square bg-gray-50">
                                            <Image 
                                                source={{ uri: item.product.image || PLACEHOLDER_IMAGE }} 
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                        </View>
                                        <View className="p-3">
                                            <Text className="text-[13px] font-medium text-gray-800 h-9" numberOfLines={2}>
                                                {item.product.name}
                                            </Text>
                                            <View className="flex-row items-center justify-between mt-2">
                                                <Text className="text-[14px] font-bold text-gray-900">
                                                    ₹{item.price}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                        addItem({
                                                            id: item.product_id,
                                                            name: item.product.name,
                                                            price: item.price,
                                                            image: item.product.image || PLACEHOLDER_IMAGE,
                                                            storeId: item.store_id,
                                                            storeName: item.store.name,
                                                            isDining: false // Default to false for regular retail catalog
                                                        });
                                                    }}
                                                    className="border border-[#B52725] px-2.5 py-1 rounded-lg"
                                                >
                                                    <Text className="text-[11px] font-bold text-[#B52725]">Add</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : permissionDenied ? (
                            <View className="py-20 items-center justify-center">
                                <MapPinOff size={48} color="#E5E7EB" strokeWidth={1} />
                                <Text className="text-gray-900 font-bold mt-4">Location Required</Text>
                                <Text className="text-gray-400 text-[13px] font-medium text-center mt-1 px-10">
                                    We need your coordinates to find local items. Please enable GPS in your settings.
                                </Text>
                            </View>
                        ) : itemsError ? (
                            <View className="py-20 items-center justify-center">
                                <WifiOff size={48} color="#E5E7EB" strokeWidth={1} />
                                <Text className="text-gray-900 font-bold mt-4">Connection Lost</Text>
                                <Text className="text-gray-400 text-[13px] font-medium text-center mt-1 px-10 mb-4">
                                    {itemsError}
                                </Text>
                                <TouchableOpacity onPress={refetchItems} className="bg-gray-900 px-6 py-2 rounded-lg flex-row items-center">
                                    <RefreshCcw size={16} color="white" className="mr-2" />
                                    <Text className="text-white font-bold ml-2">Tap to Retry</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View className="py-20 items-center justify-center">
                                <ShoppingBag size={48} color="#E5E7EB" strokeWidth={1} />
                                <Text className="text-gray-900 font-bold mt-4">No Items Found</Text>
                                <Text className="text-gray-400 text-[13px] font-medium text-center mt-1 px-10">
                                    There are currently no items available in this category from stores near you.
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {getTotal() > 0 && <CartSummaryBar itemCount={items.length} totalAmount={getTotal()} />}
        </SafeAreaView>
    );
}
