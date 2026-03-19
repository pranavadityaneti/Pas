import React, { useMemo, useState } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    Dimensions, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeftCircle, Search, Star, ShoppingBag,
    ChevronRight, MapPin, Store as StoreIcon, Filter
} from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ALL_PRODUCTS, STORES, RESTAURANTS } from '../lib/data';
import { useCart } from '../context/CartContext';
import * as Haptics from 'expo-haptics';
import CartSummaryBar from '../components/CartSummaryBar';
import ProductCard from '../components/ProductCard';
import StoreFilterModal, { StoreModalFilters, DEFAULT_MODAL_FILTERS } from '../components/StoreFilterModal';

const { width } = Dimensions.get('window');

const BANNERS = [
    { id: 'b1', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=1000&auto=format&fit=crop', title: '50% OFF on Best Burgers' },
    { id: 'b2', image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?q=80&w=1000&auto=format&fit=crop', title: 'Fresh Groceries Delivered' },
    { id: 'b3', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1000&auto=format&fit=crop', title: 'Midnight Pizza Cravings?' }
];

// Helper: Check if a store is open right now (IST)
const isStoreOpenNow = (store: any): boolean => {
    const now = new Date();
    const istOffset = 5.5 * 60; // IST = UTC+5:30 in minutes
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMinutes = utcMinutes + istOffset;
    const currentMinutes = istMinutes % (24 * 60);

    const [openH, openM] = (store.openingTime || '00:00').split(':').map(Number);
    const [closeH, closeM] = (store.closingTime || '23:59').split(':').map(Number);
    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;

    return currentMinutes >= openMin && currentMinutes <= closeMin;
};

const STORE_PILLS: { id: string; label: string; isModalTrigger?: boolean }[] = [
    { id: 'filters', label: '🎛 Filters', isModalTrigger: true },
    { id: 'all', label: 'All Stores' },
    { id: 'top_rated', label: 'Top Rated' },
    { id: 'nearest', label: 'Nearest' },
    { id: 'open_now', label: 'Open Now' },
    { id: 'new_arrivals', label: 'New Arrivals' },
    { id: 'pure_veg', label: 'Pure Veg' },
];

export default function CategoryDetailScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'CategoryDetail'>>();
    const { categoryId, categoryName } = route.params;
    const { addItem, updateQuantity, getItemQuantity, items, getTotal } = useCart();

    // ──── Tab & Filter State ────
    const [activeTab, setActiveTab] = useState<'stores' | 'items'>('stores');
    const [searchText, setSearchText] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'veg' | 'top_rated' | 'nearest' | 'under_150'>('all');

    // Store quick-filter pills
    const [storeQuickFilter, setStoreQuickFilter] = useState<'all' | 'top_rated' | 'nearest' | 'open_now' | 'new_arrivals' | 'pure_veg'>('all');

    // Advanced modal filters
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [modalFilters, setModalFilters] = useState<StoreModalFilters>({ ...DEFAULT_MODAL_FILTERS });

    // Count of active modal filters (for badge)
    const modalActiveCount = [
        modalFilters.sortBy !== 'relevance',
        modalFilters.minRating !== null,
        modalFilters.maxDistance !== null,
        modalFilters.openNow,
        modalFilters.priceRange !== 'any',
        modalFilters.pureVeg,
    ].filter(Boolean).length;

    // ──── Store Data (Merged Quick Filter + Modal Filters) ────
    const categoryStores = useMemo(() => {
        let list = STORES.filter(s => s.category === categoryId);

        // ── Quick filter application ──
        if (storeQuickFilter === 'top_rated') {
            list = list.filter(s => parseFloat(s.rating || '0') >= 4.0);
        } else if (storeQuickFilter === 'nearest') {
            list = [...list].sort((a, b) => parseFloat(a.distance || '0') - parseFloat(b.distance || '0'));
        } else if (storeQuickFilter === 'open_now') {
            list = list.filter(isStoreOpenNow);
        } else if (storeQuickFilter === 'new_arrivals') {
            // Simulate: stores with higher IDs are newer
            if (list.length > 0) {
                const maxId = Math.max(...list.map(s => s.id));
                const threshold = maxId - Math.ceil(list.length * 0.3);
                list = list.filter(s => s.id >= threshold);
            }
        } else if (storeQuickFilter === 'pure_veg') {
            list = list.filter(s => (s as any).isAllVeg === true);
        }

        // ── Modal filter application (layered on top) ──
        if (modalFilters.minRating !== null) {
            list = list.filter(s => parseFloat(s.rating || '0') >= modalFilters.minRating!);
        }
        if (modalFilters.maxDistance !== null) {
            list = list.filter(s => parseFloat(s.distance || '0') < modalFilters.maxDistance!);
        }
        if (modalFilters.openNow) {
            list = list.filter(isStoreOpenNow);
        }
        if (modalFilters.pureVeg) {
            list = list.filter(s => (s as any).isAllVeg === true);
        }
        if (modalFilters.priceRange === 'budget') {
            list = list.filter(s => (s as any).avgPrice < 100);
        } else if (modalFilters.priceRange === 'mid') {
            list = list.filter(s => (s as any).avgPrice >= 100 && (s as any).avgPrice <= 300);
        } else if (modalFilters.priceRange === 'premium') {
            list = list.filter(s => (s as any).avgPrice > 300);
        }

        // ── Modal sort application ──
        if (modalFilters.sortBy === 'rating') {
            list = [...list].sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'));
        } else if (modalFilters.sortBy === 'distance') {
            list = [...list].sort((a, b) => parseFloat(a.distance || '0') - parseFloat(b.distance || '0'));
        } else if (modalFilters.sortBy === 'most_items') {
            list = [...list].sort((a, b) => (b.products?.length || 0) - (a.products?.length || 0));
        }

        // ── Search ──
        if (searchText) {
            list = list.filter(s => s.name.toLowerCase().includes(searchText.toLowerCase()));
        }

        return list;
    }, [categoryId, storeQuickFilter, modalFilters, searchText]);

    // ──── Product Data ────
    const categoryProducts = useMemo(() => {
        let list = ALL_PRODUCTS.filter(p => p.category === categoryId);

        if (activeFilter === 'veg') {
            list = list.filter(p => p.isVeg === true);
        } else if (activeFilter === 'under_150') {
            list = list.filter(p => p.price <= 150);
        } else if (activeFilter === 'top_rated') {
            list = list.filter(p => {
                const rating = parseFloat(p.rating || '0');
                return !isNaN(rating) && rating >= 4.0;
            });
        } else if (activeFilter === 'nearest') {
            list = [...list].sort((a, b) => parseFloat(a.distance || '0') - parseFloat(b.distance || '0'));
        }

        if (searchText) {
            list = list.filter(p => p.name.toLowerCase().includes(searchText.toLowerCase()));
        }

        return list;
    }, [categoryId, activeFilter, searchText]);

    const topPicks = useMemo(() => {
        return ALL_PRODUCTS
            .filter(p => p.category === categoryId)
            .filter(p => {
                const rating = parseFloat(p.rating || '0');
                return !isNaN(rating) && rating >= 4.0;
            })
            .sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'))
            .slice(0, 8);
    }, [categoryId]);

    const handleAddToCart = (product: any) => {
        const store = STORES.find(s => s.id === product.storeId) ||
            RESTAURANTS.find(r => r.id === product.storeId);

        addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            storeId: product.storeId,
            storeName: product.store?.name || store?.name || 'Partner Store',
            uom: product.uom || '1 Pc',
        });
    };

    // ──── Store Card Component ────
    const StoreCard = ({ store }: { store: any }) => (
        <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate('Storefront', { storeId: store.id })}
            className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm border border-gray-100"
            style={{ marginHorizontal: 20 }}
        >
            {/* Store Image */}
            <View style={{ height: 140, overflow: 'hidden' }}>
                <Image source={{ uri: store.image }} className="w-full h-full" />
                <View className="absolute inset-0 bg-black/30" />
            </View>

            {/* Store Info */}
            <View className="px-4 py-3">
                <Text className="text-[16px] font-bold text-gray-900" numberOfLines={1}>{store.name}</Text>
                <Text className="text-[12px] text-gray-500 mt-0.5" numberOfLines={1}>{store.description}</Text>

                <View className="flex-row items-center mt-2.5" style={{ gap: 12 }}>
                    {/* Rating */}
                    <View className="flex-row items-center bg-green-50 rounded-lg px-2 py-1">
                        <Star size={12} color="#16a34a" fill="#16a34a" />
                        <Text className="text-[12px] font-bold text-green-700 ml-1">{store.rating}</Text>
                    </View>
                    {/* Distance */}
                    <View className="flex-row items-center">
                        <MapPin size={12} color="#9CA3AF" />
                        <Text className="text-[12px] font-semibold text-gray-500 ml-1">{store.distance}</Text>
                    </View>
                    {/* Products Count */}
                    <View className="flex-row items-center">
                        <ShoppingBag size={12} color="#9CA3AF" />
                        <Text className="text-[12px] font-semibold text-gray-500 ml-1">{store.products?.length || 0} items</Text>
                    </View>
                    {/* CTA */}
                    <View className="flex-1 flex-row justify-end items-center">
                        <Text className="text-[12px] font-bold text-[#B52725]">View Menu</Text>
                        <ChevronRight size={14} color="#B52725" />
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            {/* Header */}
            <View className="px-6 py-4 flex-row items-center bg-white border-b border-gray-50">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="mr-4"
                >
                    <ArrowLeftCircle size={28} color="#1F2937" fill="white" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-[20px] font-bold text-gray-900">{categoryName}</Text>
                    <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Discovery Feed</Text>
                </View>
            </View>

            {/* ──── Stores / Items Toggle ──── */}
            <View className="px-5 pt-4 pb-2 bg-white">
                <View className="flex-row bg-gray-100 rounded-xl p-1">
                    <TouchableOpacity
                        onPress={() => { Haptics.selectionAsync(); setActiveTab('stores'); setSearchText(''); }}
                        className={`flex-1 py-2.5 rounded-lg items-center justify-center ${activeTab === 'stores' ? 'bg-[#1F2937] shadow-sm' : ''}`}
                    >
                        <Text className={`font-bold text-[13px] ${activeTab === 'stores' ? 'text-white' : 'text-gray-500'}`}>
                            🏪  Stores
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => { Haptics.selectionAsync(); setActiveTab('items'); setSearchText(''); }}
                        className={`flex-1 py-2.5 rounded-lg items-center justify-center ${activeTab === 'items' ? 'bg-[#1F2937] shadow-sm' : ''}`}
                    >
                        <Text className={`font-bold text-[13px] ${activeTab === 'items' ? 'text-white' : 'text-gray-500'}`}>
                            🛒  Items
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Search Bar */}
                <View className="px-5 mt-4 flex-row items-center">
                    <View className="flex-1 flex-row items-center px-4 h-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
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

                {/* ═══════════ STORES TAB ═══════════ */}
                {activeTab === 'stores' && (
                    <>
                        {/* 7 Quick Filter Pills */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-5 mt-4" contentContainerStyle={{ paddingRight: 20 }}>
                            {STORE_PILLS.map(pill => {
                                if (pill.isModalTrigger) {
                                    // Special "Filters" button
                                    return (
                                        <TouchableOpacity
                                            key={pill.id}
                                            onPress={() => { Haptics.selectionAsync(); setShowFilterModal(true); }}
                                            className={`px-3.5 h-9 rounded-full mr-2 border flex-row items-center justify-center ${
                                                modalActiveCount > 0
                                                    ? 'bg-[#B52725] border-[#B52725]'
                                                    : 'bg-white border-gray-300'
                                            }`}
                                        >
                                            <Filter size={14} color={modalActiveCount > 0 ? '#FFFFFF' : '#4B5563'} />
                                            <Text className={`font-bold text-[12px] ml-1.5 ${modalActiveCount > 0 ? 'text-white' : 'text-gray-700'}`}>
                                                Filters{modalActiveCount > 0 ? ` (${modalActiveCount})` : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }

                                const isActive = storeQuickFilter === pill.id;
                                return (
                                    <TouchableOpacity
                                        key={pill.id}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setStoreQuickFilter(pill.id as any);
                                        }}
                                        className={`px-4 h-9 rounded-full mr-2 border justify-center ${isActive
                                            ? 'bg-[#B52725] border-[#B52725]'
                                            : 'bg-white border-gray-200 shadow-sm'
                                            }`}
                                    >
                                        <Text className={`font-bold text-[12px] ${isActive ? 'text-white' : 'text-gray-700'}`}>
                                            {pill.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Store Count */}
                        <View className="px-5 mt-5 mb-3">
                            <Text className="text-[13px] font-semibold text-gray-500">
                                {categoryStores.length} {categoryStores.length === 1 ? 'store' : 'stores'} found
                            </Text>
                        </View>

                        {/* Store Cards */}
                        {categoryStores.map(store => (
                            <StoreCard key={store.id} store={store} />
                        ))}

                        {categoryStores.length === 0 && (
                            <View className="py-20 items-center justify-center">
                                <StoreIcon size={48} color="#E5E7EB" strokeWidth={1} />
                                <Text className="text-gray-400 font-bold mt-4">No stores found matching your filters</Text>
                            </View>
                        )}
                    </>
                )}

                {/* ═══════════ ITEMS TAB ═══════════ */}
                {activeTab === 'items' && (
                    <>
                        {/* Quick Filters */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-5 mt-4" contentContainerStyle={{ paddingRight: 20 }}>
                            {[
                                { id: 'all', label: 'All Items' },
                                { id: 'veg', label: 'Veg Only' },
                                { id: 'top_rated', label: 'Top Rated' },
                                { id: 'under_150', label: 'Under ₹150' },
                            ].map(filter => {
                                const isActive = activeFilter === filter.id;
                                return (
                                    <TouchableOpacity
                                        key={filter.id}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setActiveFilter(filter.id as any);
                                        }}
                                        className={`px-4 h-9 rounded-full mr-2 border justify-center ${isActive
                                            ? 'bg-[#B52725] border-[#B52725]'
                                            : 'bg-white border-gray-200 shadow-sm'
                                            }`}
                                    >
                                        <Text className={`font-bold text-[12px] ${isActive ? 'text-white' : 'text-gray-700'}`}>
                                            {filter.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Promotional Banners */}
                        {!searchText && activeFilter === 'all' && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                className="mt-6"
                                snapToInterval={width - 40}
                                snapToAlignment="start"
                                decelerationRate="fast"
                                contentContainerStyle={{ paddingHorizontal: 20 }}
                            >
                                {BANNERS.map((banner, idx) => (
                                    <TouchableOpacity
                                        key={banner.id}
                                        activeOpacity={0.9}
                                        className={`w-[${width - 40}px] h-[160px] rounded-2xl overflow-hidden mr-4`}
                                        style={{ width: width - 40 }}
                                    >
                                        <Image source={{ uri: banner.image }} className="w-full h-full" />
                                        <View className="absolute inset-0 bg-black/40 p-5 flex-col justify-end">
                                            <View className="bg-red-500 self-start px-2 py-1 rounded mb-2">
                                                <Text className="text-white text-[10px] font-black uppercase tracking-wider">Sponsored</Text>
                                            </View>
                                            <Text className="text-white font-extrabold text-[22px] shadow-sm leading-tight">{banner.title}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        {/* Top Picks Spotlight */}
                        {topPicks.length > 0 && !searchText && (
                            <View className="mt-8">
                                <View className="px-5 mb-4 flex-row justify-between items-end">
                                    <View>
                                        <Text className="text-[18px] font-bold text-gray-900">Top Picks</Text>
                                        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Most Loved Choice</Text>
                                    </View>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                                    {topPicks.map((item) => {
                                        const quantity = getItemQuantity(item.id);
                                        return (
                                            <View key={item.id} className="mr-5 pb-2" style={{ width: (width - 40 - 16) / 2 }}>
                                                <ProductCard
                                                    fullWidth={true}
                                                    item={item}
                                                    quantity={quantity}
                                                    onAdd={handleAddToCart}
                                                    onIncrement={(id, newQty) => updateQuantity(Number(id), newQty)}
                                                    onDecrement={(id, newQty) => updateQuantity(Number(id), newQty)}
                                                    onPress={() => navigation.navigate('Storefront', { storeId: item.storeId as any })}
                                                />
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        {/* All Products Grid */}
                        <View className="px-5 mt-8">
                            <View className="mb-4">
                                <Text className="text-[18px] font-bold text-gray-900">All Items</Text>
                                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Browse {categoryName}</Text>
                            </View>

                            <View className="flex-row flex-wrap justify-between gap-y-6">
                                {categoryProducts.map((item) => {
                                    const quantity = getItemQuantity(item.id);
                                    return (
                                        <ProductCard
                                            key={item.id}
                                            item={item}
                                            quantity={quantity}
                                            onAdd={handleAddToCart}
                                            onIncrement={(id, newQty) => updateQuantity(Number(id), newQty)}
                                            onDecrement={(id, newQty) => updateQuantity(Number(id), newQty)}
                                            onPress={() => navigation.navigate('Storefront', { storeId: item.storeId as any })}
                                        />
                                    );
                                })}
                            </View>

                            {categoryProducts.length === 0 && (
                                <View className="py-20 items-center justify-center">
                                    <ShoppingBag size={48} color="#E5E7EB" strokeWidth={1} />
                                    <Text className="text-gray-400 font-bold mt-4">No products found in this category</Text>
                                </View>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>

            {getTotal() > 0 && <CartSummaryBar itemCount={items.length} totalAmount={getTotal()} />}

            {/* Filter Modal */}
            <StoreFilterModal
                visible={showFilterModal}
                filters={modalFilters}
                onApply={setModalFilters}
                onClose={() => setShowFilterModal(false)}
            />
        </SafeAreaView>
    );
}
