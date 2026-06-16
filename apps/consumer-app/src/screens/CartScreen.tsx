// @lock — Do NOT overwrite. Multiple approved layers (cumulative):
//   1. Approved layout & sync logic as of April 1, 2026.
//   2. Phase 4 fix B2 coupon-flow rewire approved 2026-06-09. Replaces the legacy
//      local `coupon` state + route.params.selectedCoupon hand-off with the
//      CartContext.appliedCoupon single source of truth (set by OffersScreen and
//      CouponsScreen via the typed validateCoupon helper). Drops the navigate
//      call's selectedCoupon param — checkout screens read CartContext.
//      Does NOT touch the layout, isWaitingForAuthSync timer logic, or the
//      Supabase sync from layer 1.
//   3. Global Config min-order gate approved 2026-06-14 (Pranav: "Go ahead and
//      unlock. Wire everything properly."). Add-only: reads platform minOrderValue
//      from /config/public and blocks checkout below it (button greyed + tap
//      Alert + a note). Inert while minOrderValue=0. Does NOT touch layers 1-2.
//   4. Phase 3 Item 3 approved 2026-06-16 (Option B): the cart item thumbnail now
//      uses <SafeImage> (broken-image → placeholder) instead of <Image>. Pure
//      swap of one image render; does NOT touch layout, sync, coupon, or min-order.
import React, { useState, useMemo, useEffect } from 'react';
import { getPlatformConfig } from '../lib/platformConfig';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import SafeImage from '../components/SafeImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingBag, ArrowLeftCircle, Minus, Plus, ChevronRight, ChevronDown, Ticket, CheckCircle, Clock } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { MainTabParamList } from '../navigation/MainTabNavigator';
import { useCart } from '../context/CartContext';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import TransactionalAuthModal from '../components/TransactionalAuthModal';
import { STORES } from '../lib/data';

export default function CartScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<MainTabParamList, 'Cart'>>();
    // Phase 4 fix B2 (2026-06-09): appliedCoupon comes from CartContext now —
    // OffersScreen + CouponsScreen call setAppliedCoupon after a real server
    // validateCoupon. CartContext auto-clears the coupon on any cart mutation
    // (addItem/removeItem/updateQuantity/clearCart), so the legacy minOrder
    // watchdog is no longer needed here (server is the authoritative gate at
    // confirmAccepted; client clears on any cart-shape change).
    const { items, groupedItems, updateQuantity, getItemCount, getTotal, clearCart, appliedCoupon } = useCart();
    const { session: currentSession, isLoading: authLoading, user, isProfileLoading } = useAuth();
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [isWaitingForAuthSync, setIsWaitingForAuthSync] = useState(false);

    // 2026-06-14: platform minimum-order value (admin Global Config → /config/public).
    const [minOrderValue, setMinOrderValue] = useState(0);
    useEffect(() => {
        let m = true;
        getPlatformConfig().then(c => { if (m) setMinOrderValue(c.minOrderValue || 0); }).catch(() => {});
        return () => { m = false; };
    }, []);

    // Phase 4 fix B2 (2026-06-09): removed local `coupon` state, the
    // route.params.selectedCoupon useEffect, and the minOrder watchdog.
    // appliedCoupon lives in CartContext.
    const subtotal = getTotal();
    const itemCount = getItemCount();
    const isRestaurantOrder = items.some(item => item.isDining);
    const gst = isRestaurantOrder ? parseFloat((subtotal * 0.05).toFixed(2)) : 0;

    const discount = appliedCoupon?.discount ?? 0;
    const total = Math.max(0, subtotal + gst - discount);

    // Reactive Auth Sync Watcher
    // This hook waits for background session sync AND profile hydration to complete
    useEffect(() => {
        if (!isWaitingForAuthSync) return;

        // 1. The Success Condition
        if (user && !isProfileLoading) {
            setIsWaitingForAuthSync(false);
            const isRestaurantOrder = items.length > 0 && items[0].isDining;
            // Phase 4 fix B2 (2026-06-09): no selectedCoupon param — checkout
            // screens read CartContext.appliedCoupon directly.
            if (isRestaurantOrder) {
                navigation.navigate('DiningCheckout');
            } else {
                navigation.navigate('Checkout');
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
    }, [user, isProfileLoading, isWaitingForAuthSync, navigation, items]);

    const handleCheckout = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (authLoading || isWaitingForAuthSync) return;

        // Use the global session from context as primary check
        if (!currentSession) {
            setAuthModalVisible(true);
            return;
        }

        if (minOrderValue > 0 && subtotal < minOrderValue) {
            Alert.alert('Minimum order not met', `Add ₹${Math.ceil(minOrderValue - subtotal)} more to checkout (minimum order ₹${minOrderValue}).`);
            return;
        }

        const isRestaurantOrder = items.length > 0 && items[0].isDining;
        // Phase 4 fix B2 (2026-06-09): no selectedCoupon param.
        if (isRestaurantOrder) {
            navigation.navigate('DiningCheckout');
        } else {
            navigation.navigate('Checkout');
        }
    };

    const belowMinOrder = minOrderValue > 0 && subtotal < minOrderValue;
    const isCheckoutDisabled = isWaitingForAuthSync || belowMinOrder;

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
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        // Direct navigation to the 'Home' tab sibling
                        navigation.navigate('Home' as any);
                    }}
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
                    {Object.keys(groupedItems).map((storeId) => {
                        const storeItems = groupedItems[storeId];
                        const storeName = storeItems[0].storeName;
                        const storeMeta = STORES.find(s => String(s.id) === String(storeId));
                        
                        return (
                            <View key={storeId} className="bg-white rounded-[20px] p-5 mb-4 border border-gray-100 shadow-sm">
                                <View className="flex-row justify-between items-center mb-1">
                                    <Text className="text-[17px] font-bold text-gray-900 flex-1 mr-2" numberOfLines={1} ellipsizeMode="tail">{storeName}</Text>
                                </View>
                                <Text className="text-[12px] text-gray-400 font-medium mb-5">{storeItems[0]?.isDining ? 'Dine-in items' : 'Items to be picked up from here'}</Text>

                                {storeItems.map((item: any, index: number) => (
                                    <View key={item.id} className={`flex-row items-center py-3 ${index < storeItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                        <View className="relative border border-gray-100 rounded-[14px] bg-gray-50">
                                            <SafeImage source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={{ width: 60, height: 60, borderRadius: 14 }} />
                                        </View>
                                        <View className="flex-1 ml-4 justify-center py-1 pr-2">
                                            <Text className="text-[15px] font-semibold text-gray-900 mb-0.5" numberOfLines={2}>{item.name}</Text>
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

                    {/* Apply Coupon Card Removed */}

                    {/* Bill Details */}
                    <View className="bg-white rounded-[20px] p-5 mb-8 border border-gray-100 shadow-sm mt-3">
                        <Text className="text-[17px] font-bold text-gray-900 mb-4">Bill Details</Text>
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-[14px] font-medium text-gray-500">Item Total</Text>
                            <Text className="text-[14px] font-medium text-gray-900">₹{subtotal}</Text>
                        </View>
                        {gst > 0 && (
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-[14px] font-medium text-gray-500">GST (5%)</Text>
                                <Text className="text-[14px] font-medium text-gray-900">₹{gst.toFixed(2)}</Text>
                            </View>
                        )}
                        {discount > 0 && (
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-[14px] font-bold text-green-600">Item Discount</Text>
                                <Text className="text-[14px] font-bold text-green-600">-₹{discount}</Text>
                            </View>
                        )}
                        <View className="border-t border-gray-100 mt-2 mb-3" />
                        <View className="flex-row justify-between items-center">
                            <Text className="text-[16px] font-bold text-gray-900">Grand Total</Text>
                            <Text className="text-[16px] font-extrabold text-[#111827]">₹{total.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View className="absolute left-0 right-0 px-4" pointerEvents="box-none" style={{ bottom: 105, zIndex: 99, elevation: 20 }}>
                {belowMinOrder && (
                    <View className="mb-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <Text className="text-[13px] text-amber-800 font-medium text-center">Add ₹{Math.ceil(minOrderValue - subtotal)} more — minimum order ₹{minOrderValue}</Text>
                    </View>
                )}
                <TouchableOpacity
                    delayPressIn={0}
                    onPress={handleCheckout}
                    disabled={isCheckoutDisabled}
                    className={`${isCheckoutDisabled ? 'bg-gray-400' : 'bg-[#212121]'} rounded-[20px] flex-row items-center justify-between px-6`}
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
