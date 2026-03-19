import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Store, ShoppingBag } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';

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
    const [isLoading, setIsLoading] = useState(true);
    
    // Extracted Full objects from static data based on stored IDs
    const [favoriteStores, setFavoriteStores] = useState<any[]>([]);
    const [favoriteProducts, setFavoriteProducts] = useState<any[]>([]);

    const fetchFavorites = useCallback(async () => {
        try {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setIsLoading(false);
                return;
            }

            // 1. Fetch Store IDs
            const { data: storesData } = await supabase
                .from('favorite_stores')
                .select('store_id')
                .eq('user_id', session.user.id);
            
            // 2. Fetch Product IDs
            const { data: productsData } = await supabase
                .from('favorite_products')
                .select('store_product_id')
                .eq('user_id', session.user.id);

            // 3. Map IDs to Memory Static Models (Since this app uses static data natively)
            const ALL_VENDORS = [...RESTAURANTS, ...STORES];
            
            if (storesData) {
                const storeIds = storesData.map(s => s.store_id);
                const matchedStores = ALL_VENDORS.filter(v => storeIds.includes(String(v.id)));
                setFavoriteStores(matchedStores);
            }

            if (productsData) {
                const productIds = productsData.map(p => p.store_product_id);
                let matchedProducts: any[] = [];
                ALL_VENDORS.forEach(vendor => {
                    const found = vendor.products.filter(p => productIds.includes(String(p.id)));
                    found.forEach(p => {
                        // Inject store reference to ProductCard
                        matchedProducts.push({...p, storeId: vendor.id, storeName: vendor.name});
                    });
                });
                setFavoriteProducts(matchedProducts);
            }

        } catch (error) {
            console.error("Error fetching favorites:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchFavorites();
        });
        return unsubscribe;
    }, [navigation, fetchFavorites]);

    const handleAddToCart = (product: any) => {
        addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            storeId: product.storeId,
            storeName: product.storeName,
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
                {isLoading ? (
                    <View className="mt-20 items-center justify-center">
                        <ActivityIndicator size="large" color="#B52725" />
                    </View>
                ) : activeTab === 'stores' ? (
                    favoriteStores.length > 0 ? (
                        favoriteStores.map((store: any, idx) => (
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
                    favoriteProducts.length > 0 ? (
                        <View className="flex-row flex-wrap justify-between mt-2">
                            {favoriteProducts.map((product: any, idx) => (
                                <ProductCard
                                    key={`prod-${idx}`}
                                    item={product}
                                    quantity={getItemQuantity(product.id)}
                                    onAdd={handleAddToCart}
                                    onIncrement={(id, newQty) => updateQuantity(Number(id), newQty)}
                                    onDecrement={(id, newQty) => updateQuantity(Number(id), newQty)}
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
