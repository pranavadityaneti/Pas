import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Store, ShoppingBag } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../navigation/types';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import { useFavorites } from '../hooks/useFavorites';
import { useStores } from '../hooks/useStores';
import { useProductFavorites } from '../hooks/useProductFavorites';
import { supabase } from '../lib/supabase';

// Dummy Data Imports logic since Stores/Products aren't populated from DB originally in this app's architecture
import { RESTAURANTS, STORES } from '../lib/data';

const { width } = Dimensions.get('window');

// Reusable Store Card for Favorites View
const StoreCard = ({ store, onPress }: any) => (
    <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.9}
        onPress={onPress}
        className="flex-row items-center bg-white border border-gray-100 p-4 rounded-2xl mb-4 shadow-sm"
    >
        <View className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden border border-gray-100">
            <View className="w-full h-full bg-cover" style={{ backgroundImage: `url(${store.image})` }} />
        </View>
        <View className="flex-1 ml-4 justify-center">
            <Text className="text-base font-bold text-gray-900 mb-1">{store.name}</Text>
            <Text className="text-xs text-gray-500 font-medium">{store.address}</Text>
        </View>
        <View className="bg-red-50 p-2 rounded-full">
            <Store size={20} color="#B52725" />
        </View>
    </TouchableOpacity>
);

export default function FavoritesScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const insets = useSafeAreaInsets();
    const { addItem, updateQuantity, getItemQuantity } = useCart();
    
    const [activeTab, setActiveTab] = useState<'stores' | 'products'>('stores');
    const { favorites, loading: favoritesLoading } = useFavorites();
    const { stores, loading: storesLoading } = useStores();
    
    const favoriteStoresList = useMemo(() => {
        return stores.filter(s => favorites.includes(s.id));
    }, [stores, favorites]);

    const { productFavorites, loading: productFavoritesLoading } = useProductFavorites();
    const [favoriteItems, setFavoriteItems] = useState<any[]>([]);
    const [isHydrating, setIsHydrating] = useState(false);

    useEffect(() => {
        const hydrateProducts = async () => {
            if (!productFavorites.length) {
                setFavoriteItems([]);
                return;
            }

            try {
                setIsHydrating(true);
                const { data, error } = await supabase
                    .from('StoreProduct')
                    .select('*, product:Product(*), store:Store(name)')
                    .in('id', productFavorites);

                if (error) throw error;

                if (data) {
                    const hydrated = data.map((res: any) => ({
                        id: res.id,
                        name: res.product?.name,
                        price: res.price || res.product?.mrp,
                        mrp: res.product?.mrp,
                        image: res.product?.image,
                        uom: res.product?.uom,
                        isVeg: res.product?.isVeg,
                        storeId: res.storeId,
                        storeName: res.store?.name,
                        isDining: true // Fallback, could query store for this
                    }));
                    setFavoriteItems(hydrated);
                }
            } catch (err) {
                console.error("Hydration error:", err);
            } finally {
                setIsHydrating(false);
            }
        };

        hydrateProducts();
    }, [productFavorites]);

    const handleAddToCart = (product: any) => {
        addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            storeId: product.storeId,
            storeName: product.storeName,
            isDining: product.isDining,
            uom: product.uom || '1 Pc',
        });
    };

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="flex-row items-center px-4 py-4 bg-white border-b border-gray-100 z-10 shadow-sm relative">
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    className="p-2 -ml-2 absolute left-4 z-20 bg-gray-50 rounded-full"
                >
                    <ChevronLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text className="flex-1 text-lg font-bold text-center text-gray-900">Your Favorites</Text>
            </View>

            {/* Togglers */}
            <View className="flex-row p-4 bg-white shadow-sm border-b border-gray-100 mb-2">
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('stores');
                    }}
                    className={`flex-1 py-3 items-center rounded-l-xl border ${activeTab === 'stores' ? 'bg-[#B52725] border-[#B52725]' : 'bg-white border-gray-200'}`}
                >
                    <View className="flex-row items-center">
                        <Store size={16} color={activeTab === 'stores' ? '#FFF' : '#6B7280'} />
                        <Text className={`ml-2 font-bold ${activeTab === 'stores' ? 'text-white' : 'text-gray-500'}`}>Stores</Text>
                    </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('products');
                    }}
                    className={`flex-1 py-3 items-center rounded-r-xl border border-l-0 ${activeTab === 'products' ? 'bg-[#B52725] border-[#B52725]' : 'bg-white border-gray-200'}`}
                >
                    <View className="flex-row items-center">
                        <ShoppingBag size={16} color={activeTab === 'products' ? '#FFF' : '#6B7280'} />
                        <Text className={`ml-2 font-bold ${activeTab === 'products' ? 'text-white' : 'text-gray-500'}`}>Items</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* List Body */}
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            >
                {(favoritesLoading || storesLoading || productFavoritesLoading || isHydrating) ? (
                    <View className="mt-20 items-center justify-center">
                        <ActivityIndicator size="large" color="#B52725" />
                    </View>
                ) : activeTab === 'stores' ? (
                    favoriteStoresList.length > 0 ? (
                        favoriteStoresList.map((store: any, idx: number) => (
                            <StoreCard 
                                key={`store-${idx}`} 
                                store={store} 
                                onPress={() => navigation.navigate('Storefront', { storeId: store.id })} 
                            />
                        ))
                    ) : (
                        <View className="mt-20 items-center justify-center px-8">
                            <Store size={48} color="#D1D5DB" className="mb-4" />
                            <Text className="text-lg font-bold text-gray-400 text-center mb-2">No Favorite Stores</Text>
                            <Text className="text-sm text-gray-400 text-center leading-5">You haven't added any restaurants or markets to your favorites yet.</Text>
                        </View>
                    )
                ) : (
                    favoriteItems.length > 0 ? (
                        <View className="flex-row flex-wrap justify-between mt-2">
                            {favoriteItems.map((product: any, idx: number) => (
                                <ProductCard
                                    key={`prod-${idx}`}
                                    item={product}
                                    quantity={getItemQuantity(product.id)}
                                    onAdd={handleAddToCart}
                                    onIncrement={(id: string, newQty: number) => updateQuantity(id, newQty)}
                                    onDecrement={(id: string, newQty: number) => updateQuantity(id, newQty)}
                                />
                            ))}
                        </View>
                    ) : (
                        <View className="mt-20 items-center justify-center px-8">
                            <ShoppingBag size={48} color="#D1D5DB" className="mb-4" />
                            <Text className="text-lg font-bold text-gray-400 text-center mb-2">No Favorite Items</Text>
                            <Text className="text-sm text-gray-400 text-center leading-5">Tap the heart icon on any menu item to save it here for quick access later.</Text>
                        </View>
                    )
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
