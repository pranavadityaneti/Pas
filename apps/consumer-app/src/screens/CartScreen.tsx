// @lock — Do NOT overwrite. Approved layout & sync logic as of April 1, 2026.
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingBag, ArrowLeftCircle, Minus, Plus, ChevronRight, ChevronDown, Ticket, CheckCircle } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { MainTabParamList } from '../navigation/MainTabNavigator';
import { useCart } from '../context/CartContext';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import TransactionalAuthModal from '../components/TransactionalAuthModal';
import { STORES, RESTAURANTS } from '../lib/data';

export default function CartScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<MainTabParamList, 'Cart'>>();
    const { items, updateQuantity, getItemCount, getTotal, clearCart } = useCart();
    const { session: currentSession, isLoading: authLoading, user, isProfileLoading } = useAuth();
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [isWaitingForAuthSync, setIsWaitingForAuthSync] = useState(false);
    const [coupon, setCoupon] = useState<any>(null);

    // Receive coupon from OffersScreen
    useEffect(() => {
        const params = route.params as any;
        if (params?.selectedCoupon) {
            setCoupon(params.selectedCoupon);
        }
    }, [route.params]);
    const subtotal = getTotal();
    const itemCount = getItemCount();
    const gst = Math.round(subtotal * 0.05);

    useEffect(() => {
        // Evaluate coupon minimum requirements
        if (coupon && coupon.minOrder) {
            if (subtotal < coupon.minOrder) {
                // Remove coupon if threshold breaks
                setCoupon(null);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert("Coupon Removed", `Your cart total dropped below the minimum requirement of ₹${coupon.minOrder} for this coupon.`);
            }
        }
    }, [subtotal, coupon]);

    const discount = coupon ? coupon.discount : 0;
    const total = Math.max(0, subtotal + gst - discount);

    // Reactive Auth Sync Watcher
    // This hook waits for background session sync AND profile hydration to complete
    useEffect(() => {
        if (!isWaitingForAuthSync) return;

        // 1. The Success Condition
        if (user && !isProfileLoading) {
            setIsWaitingForAuthSync(false);
            const isRestaurantOrder = items.length > 0 && items[0].storeId < 100;
            if (isRestaurantOrder) {
                navigation.navigate('DiningCheckout', { selectedCoupon: coupon } as any);
            } else {
                navigation.navigate('Checkout', { selectedCoupon: coupon } as any);
            }
            return; // Exit early
        }

        // 2. The Waiting Condition (Fallback)
        // If we are here, we are still waiting. Start the timer.
        const timeoutId = setTimeout(() => {
            setIsWaitingForAuthSync(false);
            Alert.alert(
                'Sync Delayed',
                'Login synchronization is taking longer than expected. Please try proceeding to checkout again.'
            );
        }, 8000);

        // 3. The Cleanup
        // If user or isProfileLoading changes BEFORE 8 seconds, this cleanup runs, 
        // kills the old timeout, and the effect re-evaluates with fresh state.
        return () => clearTimeout(timeoutId);
    }, [user, isProfileLoading, isWaitingForAuthSync, navigation, items, coupon]);

    const handleCheckout = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (authLoading || isWaitingForAuthSync) return;

        // Use the global session from context as primary check
        if (!currentSession) {
            setAuthModalVisible(true);
            return;
        }

        const isRestaurantOrder = items.length > 0 && items[0].storeId < 100;
        if (isRestaurantOrder) {
            navigation.navigate('DiningCheckout', { selectedCoupon: coupon } as any);
        } else {
            navigation.navigate('Checkout', { selectedCoupon: coupon } as any);
        }
    };

    const groupedStores = useMemo(() => {
        const storeMap = new Map();
        items.forEach(item => {
            if (!storeMap.has(item.storeId)) {
                storeMap.set(item.storeId, { storeId: item.storeId, storeName: item.storeName, items: [], total: 0 });
            }
            const group = storeMap.get(item.storeId);
            group.items.push(item);
            group.total += item.price * item.quantity;
        });
        return Array.from(storeMap.values());
    }, [items]);

    if (items.length === 0) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
                <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-6">
                    <ShoppingBag size={40} color="#B52725" />
                </View>
                <Text className="text-xl font-bold text-[#111827] mb-2 text-center">Your Cart is Empty</Text>
                <Text className="text-gray-500 text-center mb-10 px-4">
                    Looks like you haven&apos;t added anything to your cart yet.
                </Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Main')}
                    className="bg-[#B52725] px-8 py-3.5 rounded-2xl shadow-sm"
                >
                    <Text className="text-white font-bold text-base">Start Shopping</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
            {/* Header */}
            <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100 justify-between">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                        <ArrowLeftCircle size={24} color="#111827" fill="transparent" strokeWidth={2} />
                    </TouchableOpacity>
                    <Text className="text-[18px] font-bold text-[#111827]">My Cart</Text>
                </View>
                <TouchableOpacity onPress={() => {
                    Alert.alert('Clear Cart?', 'Are you sure you want to remove all items?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Clear All', style: 'destructive', onPress: () => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                clearCart();
                                navigation.navigate('Main' as any);
                            }
                        }
                    ]);
                }}>
                    <Text className="text-[#EF4444] text-[13px] font-bold uppercase tracking-wide">Clear All</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 220 }}>
                <View className="p-4">
                    {/* Store Groups */}
                    {groupedStores.map((group) => {
                        const storeMeta = STORES.find(s => s.id === group.storeId) || RESTAURANTS.find(r => r.id === group.storeId);
                        const storeLocation = storeMeta ? (storeMeta as any).location?.split(',')[0] || (storeMeta as any).address?.split(',')[0] || 'Local Store' : 'Local Store';
                        return (
                            <View key={group.storeId} className="bg-white rounded-[20px] p-5 mb-4 border border-gray-100 shadow-sm">
                                <View className="flex-row justify-between items-center mb-1">
                                    <Text className="text-[17px] font-bold text-gray-900 flex-1 mr-2" numberOfLines={1} ellipsizeMode="tail">{group.storeName}</Text>
                                </View>
                                <Text className="text-[12px] text-gray-400 font-medium mb-5">{group.storeId < 100 ? 'Pre-order items' : 'Items to be picked up from here'}</Text>

                                {group.items.map((item: any, index: number) => (
                                    <View key={item.id} className={`flex-row items-center py-3 ${index < group.items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                        <View className="relative border border-gray-100 rounded-[14px] bg-gray-50">
                                            <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} className="w-[60px] h-[60px] rounded-[14px]" />
                                        </View>
                                        <View className="flex-1 ml-4 justify-center py-1 pr-2">
                                            <Text className="text-[15px] font-semibold text-gray-900 mb-0.5" numberOfLines={1}>{item.name}</Text>
                                            {item.uom && <Text className="text-[11px] font-medium text-gray-400 mb-0.5" numberOfLines={1}>{item.uom}</Text>}
                                            <Text className="text-[13px] font-medium text-gray-500">₹{item.price}</Text>
                                        </View>
                                        <View className="flex-row items-center bg-white border border-gray-200 rounded-[12px] px-2 py-1.5 ml-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                                            <TouchableOpacity delayPressIn={0} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateQuantity(item.id, item.quantity - 1); }} className="p-1">
                                                <Minus size={14} color="#111827" strokeWidth={2.5} />
                                            </TouchableOpacity>
                                            <View className="w-8 items-center">
                                                <Text className="font-bold text-[14px] text-gray-900">{item.quantity}</Text>
                                            </View>
                                            <TouchableOpacity delayPressIn={0} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateQuantity(item.id, item.quantity + 1); }} className="p-1">
                                                <Plus size={14} color="#111827" strokeWidth={2.5} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )
                    })}

                    {/* Apply Coupon Card */}
                    {coupon ? (
                        <View className="bg-green-50 rounded-[20px] p-5 mb-4 border border-green-100 shadow-sm flex-row items-center justify-between mt-2">
                            <View className="flex-row items-center">
                                <View className="bg-green-600 rounded-full w-6 h-6 items-center justify-center mr-3">
                                    <CheckCircle size={14} color="white" />
                                </View>
                                <View>
                                    <Text className="text-[14px] font-bold text-green-700 uppercase">{coupon.code}</Text>
                                    <Text className="text-[11px] font-semibold text-green-600">Saved ₹{coupon.discount}!</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCoupon(null); }}>
                                <Text className="text-[12px] font-bold text-red-500 uppercase tracking-widest">Remove</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity onPress={() => navigation.navigate('Offers' as any, { subtotal })} className="bg-white rounded-[20px] p-5 mb-4 border border-gray-100 shadow-sm flex-row items-center justify-between mt-2">
                            <View className="flex-row items-center">
                                <Ticket size={22} color="#111827" strokeWidth={2} />
                                <Text className="ml-3 text-[16px] font-bold text-gray-900">Apply Coupon</Text>
                            </View>
                            <ChevronRight size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}


                </View>
            </ScrollView>

            <View className="absolute left-0 right-0 px-4" pointerEvents="box-none" style={{ bottom: 105, zIndex: 99, elevation: 20 }}>
                <TouchableOpacity
                    delayPressIn={0}
                    onPress={handleCheckout}
                    disabled={isWaitingForAuthSync}
                    className={`${isWaitingForAuthSync ? 'bg-gray-400' : 'bg-[#212121]'} rounded-[20px] flex-row items-center justify-between px-6`}
                    style={{ height: 64, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 10 }}
                    activeOpacity={0.9}
                >
                    {isWaitingForAuthSync ? (
                        <View className="flex-row items-center justify-center w-full">
                            <ActivityIndicator color="white" size="small" className="mr-3" />
                            <Text className="text-white text-[17px] font-bold">Synchronizing...</Text>
                        </View>
                    ) : (
                        <>
                            <Text className="text-white text-[17px] font-bold">Proceed to Pay</Text>
                            <Text className="text-white text-[17px] font-bold">₹{total.toFixed(2)}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Auth Modal must be absolutely on top */}
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 }} pointerEvents={authModalVisible ? "auto" : "none"}>
                <TransactionalAuthModal
                    visible={authModalVisible}
                    onClose={() => setAuthModalVisible(false)}
                    onSuccess={() => {
                        setAuthModalVisible(false);
                        setIsWaitingForAuthSync(true);
                    }}
                    title="Secure Checkout"
                    subtitle="Login or sign up to complete your purchase."
                />
            </View>
        </SafeAreaView>
    );
}
