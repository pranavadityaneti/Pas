// @lock — Storefront with hero carousel, info, search, category pills, product grid, cart integration.
import React, { useState, useRef, useMemo } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    TextInput, Dimensions, FlatList, NativeSyntheticEvent,
    NativeScrollEvent
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft, Star, Clock, UtensilsCrossed, Search, Heart,
    Minus, Plus, ChevronRight
} from 'lucide-react-native';
import { RESTAURANTS, STORES } from '../lib/data';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { useCart } from '../context/CartContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const MENU_CATEGORIES = ['Recommended', 'Starters', 'Main Course', 'Desserts', 'Beverages'];

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

    const [searchText, setSearchText] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Recommended');
    const [isFavorited, setIsFavorited] = useState(false);
    const [heroIndex, setHeroIndex] = useState(0);
    const heroScrollRef = useRef<ScrollView>(null);

    if (!restaurant) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <Text className="text-lg text-gray-500">Restaurant not found</Text>
            </SafeAreaView>
        );
    }

    // Hero images: cover + product images (6 total for carousel testing)
    const heroImages = useMemo(() => {
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

    // Filtered products
    const filteredProducts = useMemo(() => {
        let products = [...restaurant.products];
        if (selectedCategory === 'Recommended') {
            products = products.filter((p: any) => p.isBestseller || parseFloat(p.rating) >= 4.0);
            if (products.length < 6) products = restaurant.products.slice(0, 12);
        } else {
            products = products.filter((p: any) => p.subCategory === selectedCategory);
        }
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            products = products.filter((p: any) => p.name.toLowerCase().includes(q));
        }
        return products;
    }, [restaurant, selectedCategory, searchText]);

    const handleHeroScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / width);
        setHeroIndex(index);
    };

    const handleAddToCart = (product: any) => {
        addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            storeId: restaurant.id,
            storeName: restaurant.name,
        });
    };

    const itemCount = getItemCount();
    const totalAmount = getTotal();

    // --- Product Card ---
    const ProductCard = ({ item }: { item: any }) => {
        const qty = getItemQuantity(item.id);
        const originalPrice = item.discount > 0 ? Math.round(item.price / (1 - item.discount / 100)) : item.price;

        return (
            <View className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4" style={{ width: CARD_WIDTH }}>
                {/* Image */}
                <View className="relative" style={{ height: CARD_WIDTH * 0.85 }}>
                    <Image source={{ uri: item.image }} className="w-full h-full" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                    {/* Rating badge */}
                    <View className="absolute bottom-2 left-2 bg-white/95 px-2 py-1 rounded-full flex-row items-center shadow-sm">
                        <Star size={10} color="#FBBF24" fill="#FBBF24" />
                        <Text className="text-[11px] font-bold text-gray-800 ml-1">{item.rating}</Text>
                    </View>
                    {/* Few Left badge */}
                    {item.isFewLeft && (
                        <View className="absolute top-2 left-2 bg-red-500 px-2.5 py-1 rounded-lg">
                            <Text className="text-[9px] font-bold text-white">Few Left</Text>
                        </View>
                    )}
                </View>

                {/* Info */}
                <View className="p-3">
                    {/* Name + Veg/Non-veg indicator */}
                    <View className="flex-row items-center">
                        {item.isVeg !== undefined && (
                            <View style={{ marginRight: 6 }}>
                                <VegIndicator isVeg={item.isVeg} />
                            </View>
                        )}
                        <Text className="text-[14px] font-bold text-gray-900 flex-1" numberOfLines={1}>{item.name}</Text>
                    </View>

                    <Text className="text-[11px] text-gray-400 font-medium" style={{ marginTop: 4 }} numberOfLines={2}>{item.brief}</Text>

                    {/* Price row with strikethrough */}
                    <View className="flex-row items-center" style={{ marginTop: 8 }}>
                        <Text className="text-[15px] font-bold text-gray-900">₹{item.price}</Text>
                        {item.discount > 0 && (
                            <>
                                <Text className="text-[11px] text-gray-400 font-medium ml-1.5" style={{ textDecorationLine: 'line-through' }}>₹{originalPrice}</Text>
                                <Text className="text-[11px] font-bold text-red-500 ml-1.5">{item.discount}% OFF</Text>
                            </>
                        )}
                    </View>

                    {/* ADD / Quantity Stepper */}
                    {qty > 0 ? (
                        <View className="flex-row bg-[#B52725] rounded-xl items-center justify-between" style={{ height: 38, marginTop: 10 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    updateQuantity(item.id, qty - 1);
                                }}
                                className="items-center justify-center"
                                style={{ width: 44, height: 38 }}
                            >
                                <Minus size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text className="text-[15px] font-bold text-white">{qty}</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    handleAddToCart(item);
                                }}
                                className="items-center justify-center"
                                style={{ width: 44, height: 38 }}
                            >
                                <Plus size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => handleAddToCart(item)}
                            className="w-full rounded-xl items-center justify-center border border-gray-200"
                            style={{ height: 38, marginTop: 10 }}
                            activeOpacity={0.8}
                        >
                            <Text className="text-[13px] font-bold text-gray-800">ADD</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <FlatList
                data={filteredProducts}
                renderItem={({ item }) => <ProductCard item={item} />}
                keyExtractor={(item) => `product-${item.id}`}
                numColumns={2}
                columnWrapperStyle={{ paddingHorizontal: 16, gap: 16 }}
                contentContainerStyle={{ paddingBottom: itemCount > 0 ? 120 : 100 }}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <View>
                        {/* ===== HERO IMAGE CAROUSEL ===== */}
                        <View className="relative" style={{ height: 280 }}>
                            <ScrollView
                                ref={heroScrollRef}
                                horizontal
                                pagingEnabled
                                nestedScrollEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={handleHeroScroll}
                                scrollEventThrottle={16}
                            >
                                {heroImages.map((img: string, idx: number) => (
                                    <Image key={idx} source={{ uri: img }} style={{ width, height: 280 }} />
                                ))}
                            </ScrollView>

                            <LinearGradient
                                colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.15)']}
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                pointerEvents="none"
                            />

                            {/* Back button */}
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                className="absolute bg-white/20 rounded-full items-center justify-center"
                                style={{ top: 52, left: 16, width: 40, height: 40 }}
                            >
                                <ArrowLeft size={22} color="#FFFFFF" />
                            </TouchableOpacity>

                            {/* Pagination dots */}
                            <View className="absolute flex-row items-center justify-center" style={{ bottom: 50, left: 0, right: 0 }}>
                                {heroImages.map((_: string, idx: number) => (
                                    <View
                                        key={idx}
                                        className={`rounded-full mx-1 ${heroIndex === idx ? 'bg-white' : 'bg-white/50'}`}
                                        style={{ width: heroIndex === idx ? 8 : 6, height: heroIndex === idx ? 8 : 6 }}
                                    />
                                ))}
                            </View>

                            {/* Restaurant logo */}
                            <View className="absolute items-center" style={{ bottom: -40, left: 0, right: 0 }}>
                                <View className="rounded-full bg-white shadow-lg items-center justify-center border-3 border-white overflow-hidden" style={{ width: 80, height: 80 }}>
                                    <Image source={{ uri: restaurant.image }} className="w-full h-full rounded-full" />
                                </View>
                            </View>

                            {/* Favorite button */}
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setIsFavorited(!isFavorited);
                                }}
                                className="absolute bg-gray-800/70 rounded-full items-center justify-center"
                                style={{ bottom: -18, right: 24, width: 44, height: 44 }}
                            >
                                <Heart size={20} color="#FFFFFF" fill={isFavorited ? '#FFFFFF' : 'transparent'} />
                            </TouchableOpacity>
                        </View>

                        {/* ===== RESTAURANT INFO ===== */}
                        <View className="items-center px-6" style={{ marginTop: 52 }}>
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

                        {/* ===== SEARCH BAR ===== */}
                        <View className="px-5" style={{ marginTop: 20 }}>
                            <View className="w-full h-12 bg-gray-50 rounded-xl border border-gray-200 flex-row items-center px-4">
                                <Search size={18} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 font-medium text-sm text-gray-800"
                                    placeholder={`Search menu in ${restaurant.name}`}
                                    placeholderTextColor="#9CA3AF"
                                    value={searchText}
                                    onChangeText={setSearchText}
                                />
                            </View>
                        </View>

                        {/* ===== CATEGORY PILLS ===== */}
                        <View style={{ marginTop: 16, marginBottom: 16 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
                                {MENU_CATEGORIES.map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setSelectedCategory(cat);
                                        }}
                                        className={`rounded-full py-2.5 px-5 mr-3 ${selectedCategory === cat ? 'bg-[#B52725]' : 'bg-white border border-gray-200'
                                            }`}
                                    >
                                        <Text className={`text-[13px] font-bold ${selectedCategory === cat ? 'text-white' : 'text-gray-800'
                                            }`}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                }
            />

            {/* ===== FLOATING BOTTOM BAR ===== */}
            {itemCount > 0 && (
                <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-3" style={{ backgroundColor: 'rgba(255,255,255,0.97)' }}>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('ConfirmPreOrder');
                        }}
                        className="bg-[#B52725] rounded-2xl flex-row items-center justify-between px-5"
                        style={{ height: 56 }}
                        activeOpacity={0.9}
                    >
                        <Text className="text-[15px] font-bold text-white">{itemCount} {itemCount === 1 ? 'Item' : 'Items'} | ₹{totalAmount}</Text>
                        <View className="flex-row items-center">
                            <Text className="text-[15px] font-bold text-white mr-1.5">Proceed to Pre-order</Text>
                            <ChevronRight size={18} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
