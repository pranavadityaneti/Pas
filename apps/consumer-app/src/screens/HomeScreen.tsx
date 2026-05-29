// @lock — Do NOT overwrite.
// Home Screen: 2-col Pickup/Dining cards + Featured hero card + sticky header.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Mic, MapPin, User, ArrowRight, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { MainTabParamList } from '../navigation/MainTabNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import GlobalHeader from '../components/GlobalHeader';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import * as Haptics from 'expo-haptics';
import CartSummaryBar from '../components/CartSummaryBar';
import { HERO_IMAGES } from '../lib/data';
import { useLocation } from '../context/LocationContext';
import { useGlobalSearch, SearchResultStore } from '../hooks/useGlobalSearch';
import { getStoreImageUrl } from '../utils/storageUrl';
import SearchResults from '../components/SearchResults';


export default function HomeScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const tabNavigation = useNavigation<any>();
    const { getItemCount, getTotal } = useCart();
    const [searchText, setSearchText] = useState("");
    const { activeLocation } = useLocation();

    // Universal search (no vertical filter)
    const { results: searchResults, allMatchedProducts, isLoading: isSearchLoading } = useGlobalSearch(
        searchText,
        activeLocation?.latitude,
        activeLocation?.longitude,
        null
    );

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            <GlobalHeader 
                searchText={searchText} 
                onSearchChange={setSearchText} 
                searchPlaceholder="Search for 'Atta' or 'Biryani'" 
            />

            <ScrollView
                className="flex-1 bg-[#F8F9FA]"
                contentContainerStyle={{ paddingBottom: 120, paddingTop: 20 }}
                showsVerticalScrollIndicator={false}
            >

                {searchText.trim() ? (
                    /* Universal Search Results */
                    <SearchResults
                        searchText={searchText}
                        results={searchResults}
                        allMatchedProducts={allMatchedProducts}
                        isLoading={isSearchLoading}
                        storeCardRenderer={(store: SearchResultStore) => (
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    navigation.navigate('Storefront', { storeId: store.branch_id });
                                }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3"
                                activeOpacity={0.9}
                            >
                                <View className="h-[120px] relative">
                                    <Image
                                        source={{ uri: getStoreImageUrl(store.store_photos?.[0]) }}
                                        className="w-full h-full"
                                    />
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.5)']}
                                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                    />
                                    <View className="absolute bottom-3 left-3">
                                        <Text className="text-white text-[15px] font-bold">{store.branch_name}</Text>
                                        <Text className="text-white/80 text-[11px] font-medium mt-0.5">
                                            {store.vertical_name || 'Store'} {'•'} {store.distance_meters >= 1000 ? `${(store.distance_meters / 1000).toFixed(1)} km` : `${Math.round(store.distance_meters)} m`}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                ) : (
                    <>
                    {/* 2-Column Grid: Pickup & Dining */}
                    <View className="px-6 mb-8 flex-row gap-4 h-[300px]">
                        {/* Pickup Card */}
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                tabNavigation.navigate('Pickup');
                            }}
                            className="flex-1 rounded-[30px] overflow-hidden bg-gray-200 shadow-sm relative"
                        >
                            <Image
                                source={{ uri: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80" }}
                                className="absolute w-full h-full"
                            />
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.7)']}
                                style={{ position: 'absolute', inset: 0, padding: 20, justifyContent: 'flex-end' }}
                            >
                                <Text className="text-3xl font-bold text-white leading-tight">Pickup</Text>
                                <Text className="text-xs font-semibold text-white/90 mt-1">Groceries & Essentials</Text>
                                <View className="mt-4 w-10 h-10 rounded-full bg-white items-center justify-center">
                                    <ArrowRight size={20} color="#000" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Dining Card */}
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                tabNavigation.navigate('Dining');
                            }}
                            className="flex-1 rounded-[30px] overflow-hidden bg-gray-200 shadow-sm relative"
                        >
                            <Image
                                source={{ uri: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80" }}
                                className="absolute w-full h-full"
                            />
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.7)']}
                                style={{ position: 'absolute', inset: 0, padding: 20, justifyContent: 'flex-end' }}
                            >
                                <Text className="text-3xl font-bold text-white leading-tight">Dining</Text>
                                <Text className="text-xs font-semibold text-white/90 mt-1">Book Tables & Pre-order</Text>
                                <View className="mt-4 w-10 h-10 rounded-full bg-white items-center justify-center">
                                    <ArrowRight size={20} color="#000" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>


                    {/* Featured Card (Hero Slider) ��� Static, non-interactive */}
                    <View className="px-6 mb-8">
                        <View className="relative w-full h-[220px] rounded-[30px] overflow-hidden shadow-sm bg-white border border-gray-100">
                            <Image
                                source={{ uri: HERO_IMAGES[0] }}
                                className="absolute w-full h-full"
                            />
                            <View className="absolute top-6 left-6 px-3 py-1.5 bg-black/30 rounded-xl border border-white/20">
                                <Text className="text-[10px] font-bold text-white uppercase tracking-wider">Featured</Text>
                            </View>
                        </View>
                    </View>


                    <View className="items-center mt-4">
                        <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-[4px]">Powered by Pick At Store</Text>
                    </View>
                    </>
                )}

            </ScrollView>

            <CartSummaryBar itemCount={getItemCount()} totalAmount={getTotal()} />
        </SafeAreaView>
    );
}
