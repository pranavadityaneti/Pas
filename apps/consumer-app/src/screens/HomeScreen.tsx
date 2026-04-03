// @lock — Do NOT overwrite.
// Home Screen: 2-col Pickup/Dining cards + Featured hero card + sticky header.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Dimensions, TextInput } from 'react-native';
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

const { width } = Dimensions.get('window');

const CATEGORIES = [
    { name: "Grocery & Kirana", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&h=200&fit=crop" },
    { name: "Fresh Fruits", image: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=200&h=200&fit=crop" },
    { name: "Restaurants & Cafes", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop" },
    { name: "Bakeries & Desserts", image: "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=200&h=200&fit=crop" },
    { name: "Sports and fitness", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200&h=200&fit=crop" },
    { name: "Pharmacy & Wellness", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&h=200&fit=crop" },
    { name: "Electronics & Accessories", image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200&h=200&fit=crop" },
    { name: "Fashion & Apparel", image: "https://images.unsplash.com/photo-1445205170230-053b830c6046?w=200&h=200&fit=crop" },
    { name: "Home & Lifestyle", image: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=200&h=200&fit=crop" },
    { name: "Beauty & Personal Care", image: "https://images.unsplash.com/photo-1596462502278-27bfdc4033c8?w=200&h=200&fit=crop" },
    { name: "Pet Care & Supplies", image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=200&h=200&fit=crop" },
    { name: "Stationery, Gifting & Toys", image: "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=200&h=200&fit=crop" },
    { name: "Electricals, Paints & Automotive", image: "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=200&h=200&fit=crop" },
    { name: "Hardware and plumbing", image: "https://images.unsplash.com/photo-1581141849291-1110b9c1d30a?w=200&h=200&fit=crop" },
    { name: "Pooja and festive needs", image: "https://images.unsplash.com/photo-1513410191585-79cee3e047fb?w=200&h=200&fit=crop" },
];

export default function HomeScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const tabNavigation = useNavigation<any>();
    const { getItemCount, getTotal } = useCart();
    const [searchText, setSearchText] = useState("");

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


                {/* Featured Card (Hero Slider) */}
                <View className="px-6 mb-8">
                    <View className="relative w-full h-[220px] rounded-[30px] overflow-hidden shadow-sm bg-white border border-gray-100">
                        <Image
                            source={{ uri: HERO_IMAGES[0] }}
                            className="absolute w-full h-full"
                        />
                        <View className="absolute top-6 left-6 px-3 py-1.5 bg-black/30 rounded-xl border border-white/20">
                            <Text className="text-[10px] font-bold text-white uppercase tracking-wider">Featured</Text>
                        </View>
                        <View className="absolute bottom-6 right-6">
                            <TouchableOpacity
                                className="px-5 py-2.5 bg-white rounded-xl shadow-lg flex-row items-center"
                                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                            >
                                <Text className="text-xs font-bold text-black mr-2">Order Now</Text>
                                <ChevronRight size={14} color="#000" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Shop by Category: 5-Column Grid */}
                <View className="px-5 mb-8">
                    <View className="mb-5">
                        <Text className="text-xl font-bold text-gray-900">Shop by Category</Text>
                    </View>

                    <View className="flex-row flex-wrap justify-between">
                        {CATEGORIES.map((category, idx) => (
                            <TouchableOpacity
                                key={`cat-${idx}`}
                                activeOpacity={0.7}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    navigation.navigate('CategoryDetail', { categoryId: category.name, categoryName: category.name });
                                }}
                                style={{ width: (width - 40) / 5 }}
                                className="items-center mb-6"
                            >
                                <View className="w-14 h-14 rounded-full bg-gray-100 shadow-sm border border-gray-100 overflow-hidden mb-2">
                                    <Image
                                        source={{ uri: category.image }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                </View>
                                <Text
                                    className="text-[10px] font-medium text-gray-800 text-center leading-tight px-0.5"
                                    numberOfLines={2}
                                >
                                    {category.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View className="items-center mt-4">
                    <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-[4px]">Powered by Pick At Store</Text>
                </View>

            </ScrollView>

            <CartSummaryBar itemCount={getItemCount()} totalAmount={getTotal()} />
        </SafeAreaView>
    );
}
