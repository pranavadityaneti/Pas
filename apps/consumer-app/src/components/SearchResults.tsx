// SearchResults — Shared tabbed search results (Products | Stores)
// Used by HomeScreen, HomeFeedScreen, DiningScreen when search is active.
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import { Search, MapPin, ShoppingBag } from 'lucide-react-native';
import SafeImage from './SafeImage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import * as Haptics from 'expo-haptics';
import { SearchResultStore, MatchedProduct } from '../hooks/useGlobalSearch';

const { width } = Dimensions.get('window');

export interface SearchResultProduct extends MatchedProduct {
    store_branch_id: string;
    store_name: string;
    store_distance: number;
}

interface SearchResultsProps {
    searchText: string;
    results: SearchResultStore[];
    allMatchedProducts: SearchResultProduct[];
    isLoading: boolean;
    storeCardRenderer: (store: SearchResultStore) => React.ReactElement;
    emptyIcon?: React.ReactElement;
}

type TabType = 'products' | 'stores';

export default function SearchResults({
    searchText,
    results,
    allMatchedProducts,
    isLoading,
    storeCardRenderer,
    emptyIcon,
}: SearchResultsProps) {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [activeTab, setActiveTab] = useState<TabType>('products');

    const productCount = allMatchedProducts.length;
    const storeCount = results.length;

    // Auto-select the best tab when results change:
    // - If products exist, show Products tab
    // - If no products but stores exist, show Stores tab
    useEffect(() => {
        if (productCount > 0) {
            setActiveTab('products');
        } else if (storeCount > 0) {
            setActiveTab('stores');
        }
    }, [productCount, storeCount]);

    // Loading state
    if (isLoading) {
        return (
            <View className="py-20 items-center justify-center">
                <ActivityIndicator size="large" color="#B52725" />
                <Text className="text-gray-400 text-[13px] font-bold mt-4 uppercase tracking-widest">
                    Searching nearby...
                </Text>
            </View>
        );
    }

    // No results
    if (!isLoading && results.length === 0 && searchText.trim()) {
        return (
            <View className="py-12 items-center justify-center">
                {emptyIcon || <Search size={48} color="#D1D5DB" strokeWidth={1.5} />}
                <Text className="text-gray-900 text-[16px] font-bold mt-4">No results for "{searchText}"</Text>
                <Text className="text-gray-400 text-[13px] font-medium mt-1 text-center px-10">
                    Try a different search term or check nearby stores.
                </Text>
            </View>
        );
    }

    // Has results — show tabs
    return (
        <View>
            {/* Tab Header */}
            <View className="flex-row mx-5 mb-4 bg-gray-100 rounded-2xl p-1">
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('products');
                    }}
                    className={`flex-1 py-3 rounded-xl items-center justify-center ${activeTab === 'products' ? 'bg-white shadow-sm' : ''}`}
                >
                    <Text className={`text-[13px] font-bold ${activeTab === 'products' ? 'text-gray-900' : 'text-gray-500'}`}>
                        Products{productCount > 0 ? ` (${productCount})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('stores');
                    }}
                    className={`flex-1 py-3 rounded-xl items-center justify-center ${activeTab === 'stores' ? 'bg-white shadow-sm' : ''}`}
                >
                    <Text className={`text-[13px] font-bold ${activeTab === 'stores' ? 'text-gray-900' : 'text-gray-500'}`}>
                        Stores{storeCount > 0 ? ` (${storeCount})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {activeTab === 'products' ? (
                <ProductsTab
                    products={allMatchedProducts}
                    navigation={navigation}
                />
            ) : (
                <StoresTab
                    results={results}
                    storeCardRenderer={storeCardRenderer}
                />
            )}
        </View>
    );
}

// --- Products Tab ---
function ProductsTab({
    products,
    navigation,
}: {
    products: SearchResultProduct[];
    navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
    if (products.length === 0) {
        return (
            <View className="py-12 items-center justify-center">
                <ShoppingBag size={40} color="#D1D5DB" strokeWidth={1.5} />
                <Text className="text-gray-500 text-[14px] font-semibold mt-3">No matching products</Text>
                <Text className="text-gray-400 text-[12px] mt-1">Try the Stores tab instead</Text>
            </View>
        );
    }

    return (
        <View className="px-5">
            {products.map((product, index) => (
                <ProductSearchCard
                    key={`${product.product_id}-${product.store_branch_id}-${index}`}
                    product={product}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        navigation.navigate('Storefront', {
                            storeId: product.store_branch_id,
                            highlightProductId: product.product_id,
                        });
                    }}
                />
            ))}
        </View>
    );
}

// --- Stores Tab ---
function StoresTab({
    results,
    storeCardRenderer,
}: {
    results: SearchResultStore[];
    storeCardRenderer: (store: SearchResultStore) => React.ReactElement;
}) {
    if (results.length === 0) {
        return (
            <View className="py-12 items-center justify-center">
                <MapPin size={40} color="#D1D5DB" strokeWidth={1.5} />
                <Text className="text-gray-500 text-[14px] font-semibold mt-3">No stores found</Text>
            </View>
        );
    }

    return (
        <View className="px-5">
            {results.map(store => (
                <View key={store.branch_id}>
                    {storeCardRenderer(store)}
                </View>
            ))}
        </View>
    );
}

// --- Product Search Card ---
function ProductSearchCard({
    product,
    onPress,
}: {
    product: SearchResultProduct;
    onPress: () => void;
}) {
    const formatDistance = (meters: number) => {
        if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
        return `${Math.round(meters)} m`;
    };

    const hasDiscount = product.mrp && product.price && product.mrp > product.price;
    const discountPct = hasDiscount ? Math.round(((product.mrp! - product.price!) / product.mrp!) * 100) : 0;

    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row bg-white rounded-2xl border border-gray-100 shadow-sm mb-3 overflow-hidden"
            activeOpacity={0.9}
            style={{ height: 100 }}
        >
            {/* Product Image */}
            <View className="w-[100px] h-full bg-gray-50 items-center justify-center p-2">
                {product.image ? (
                    <SafeImage
                        source={{ uri: product.image }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                    />
                ) : (
                    <View className="w-full h-full items-center justify-center bg-gray-100 rounded-lg">
                        <ShoppingBag size={24} color="#D1D5DB" />
                    </View>
                )}
            </View>

            {/* Product Info */}
            <View className="flex-1 p-3 justify-center">
                <Text className="text-[14px] font-bold text-gray-900" numberOfLines={1}>
                    {product.product_name}
                </Text>

                {product.brand && (
                    <Text className="text-[11px] text-gray-400 font-medium mt-0.5" numberOfLines={1}>
                        {product.brand}
                    </Text>
                )}

                {/* Price Row */}
                <View className="flex-row items-center mt-1.5">
                    {product.price != null && (
                        <Text className="text-[15px] font-extrabold text-gray-900">
                            {'₹'}{product.price}
                        </Text>
                    )}
                    {hasDiscount && (
                        <Text className="text-[11px] text-gray-400 line-through ml-2">
                            {'₹'}{product.mrp}
                        </Text>
                    )}
                    {discountPct > 0 && (
                        <View className="bg-green-50 px-1.5 py-0.5 rounded ml-2">
                            <Text className="text-[10px] font-bold text-green-700">{discountPct}% OFF</Text>
                        </View>
                    )}
                </View>

                {/* Store info */}
                <View className="flex-row items-center mt-1.5">
                    <MapPin size={10} color="#9CA3AF" />
                    <Text className="text-[11px] text-gray-400 font-medium ml-1" numberOfLines={1}>
                        {product.store_name} {'•'} {formatDistance(product.store_distance)}
                    </Text>
                </View>
            </View>

            {/* UOM badge */}
            {product.uom && (
                <View className="absolute top-2 right-2 bg-gray-100 px-1.5 py-0.5 rounded">
                    <Text className="text-[9px] font-bold text-gray-500">{product.uom}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}
