// @lock — Do NOT overwrite. Approved layout & sync logic as of April 1, 2026.
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Modal } from 'react-native';
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
import { STORES, RESTAURANTS } from '../lib/data';

export default function CartScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<MainTabParamList, 'Cart'>>();
    const { items, pickupTimes, setPickupTime, groupedItems, updateQuantity, getItemCount, getTotal, clearCart } = useCart();
    const { session: currentSession, isLoading: authLoading, user, isProfileLoading } = useAuth();
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [isWaitingForAuthSync, setIsWaitingForAuthSync] = useState(false);
    const [coupon, setCoupon] = useState<any>(null);
    const [activeTimePickerStoreId, setActiveTimePickerStoreId] = useState<string | null>(null);
    const [selectedDayTab, setSelectedDayTab] = useState<'Today' | 'Tomorrow'>('Today');

    // CRITICAL EXECUTE: 15-Minute Interval Engine
    const generateTimeSlots = (openTime: string, closeTime: string) => {
        const slots = [];
        
        const now = new Date();
        // 1. Buffer: Current Time + 15 mins
        const bufferTime = new Date(now.getTime() + 15 * 60000);
        
        // 2. Interval: Round up to next 15-min interval
        const remainder = bufferTime.getMinutes() % 15;
        if (remainder !== 0) {
            bufferTime.setMinutes(bufferTime.getMinutes() + (15 - remainder));
        }
        bufferTime.setSeconds(0);
        bufferTime.setMilliseconds(0);
        
        // 3. Horizon: 24 hours from now
        const horizon = new Date(now.getTime() + 24 * 60 * 60000);
        
        const [openH, openM] = openTime.split(':').map(Number);
        const [closeH, closeM] = closeTime.split(':').map(Number);
        
        let currentSlot = new Date(bufferTime.getTime());
        
        while (currentSlot <= horizon) {
            const h = currentSlot.getHours();
            const m = currentSlot.getMinutes();
            
            const currentSlotMinutes = h * 60 + m;
            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;
            
            // 4. Store Hours
            let isValid = false;
            if (closeMinutes > openMinutes) {
                isValid = currentSlotMinutes >= openMinutes && currentSlotMinutes < closeMinutes;
            } else {
                // Overnight hours
                isValid = currentSlotMinutes >= openMinutes || currentSlotMinutes < closeMinutes;
            }
            
            if (isValid) {
                // Format String
                const isTomorrow = currentSlot.getDate() !== now.getDate();
                const prefix = isTomorrow ? "Tomorrow" : "Today";
                
                const displayH = h % 12 === 0 ? 12 : h % 12;
                const displayM = m.toString().padStart(2, '0');
                const ampm = h >= 12 ? 'PM' : 'AM';
                
                slots.push(`${prefix}, ${displayH}:${displayM} ${ampm}`);
                
                // Advance by 15 mins
                currentSlot = new Date(currentSlot.getTime() + 15 * 60000);
            } else {
                // Jump logic
                if (currentSlotMinutes < openMinutes) {
                    currentSlot.setHours(openH, openM, 0, 0);
                } else {
                    currentSlot.setDate(currentSlot.getDate() + 1);
                    currentSlot.setHours(openH, openM, 0, 0);
                }
            }
        }
        
        return slots;
    };

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
            const isRestaurantOrder = items.length > 0 && RESTAURANTS.some(r => String(r.id) === String(items[0].storeId));
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

        const isRestaurantOrder = items.length > 0 && RESTAURANTS.some(r => String(r.id) === String(items[0].storeId));
        if (isRestaurantOrder) {
            navigation.navigate('DiningCheckout', { selectedCoupon: coupon } as any);
        } else {
            navigation.navigate('Checkout', { selectedCoupon: coupon } as any);
        }
    };

    const isMissingPickupTime = Object.keys(groupedItems).some(storeId => !pickupTimes[storeId]);
    const isCheckoutDisabled = isWaitingForAuthSync || isMissingPickupTime;

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
                        const storeMeta = STORES.find(s => String(s.id) === String(storeId)) || RESTAURANTS.find(r => String(r.id) === String(storeId));
                        
                        return (
                            <View key={storeId} className="bg-white rounded-[20px] p-5 mb-4 border border-gray-100 shadow-sm">
                                <View className="flex-row justify-between items-center mb-1">
                                    <Text className="text-[17px] font-bold text-gray-900 flex-1 mr-2" numberOfLines={1} ellipsizeMode="tail">{storeName}</Text>
                                </View>
                                <Text className="text-[12px] text-gray-400 font-medium mb-5">{RESTAURANTS.some(r => String(r.id) === String(storeId)) ? 'Pre-order items' : 'Items to be picked up from here'}</Text>

                                {storeItems.map((item: any, index: number) => (
                                    <View key={item.id} className={`flex-row items-center py-3 ${index < storeItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                        <View className="relative border border-gray-100 rounded-[14px] bg-gray-50">
                                            <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} className="w-[60px] h-[60px] rounded-[14px]" />
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

                                {/* Time Slot UI */}
                                <View className="mt-4 pt-4 border-t border-gray-100 flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <Clock size={16} color="#6B7280" />
                                        <Text className="text-[14px] font-semibold text-gray-700 ml-2">Pickup Time</Text>
                                    </View>
                                    <TouchableOpacity 
                                        delayPressIn={0}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setActiveTimePickerStoreId(storeId);
                                        }}
                                        className={`px-4 py-2 rounded-xl flex-row items-center ${pickupTimes[storeId] ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                                    >
                                        <Text className={`font-bold text-[13px] ${pickupTimes[storeId] ? 'text-green-700' : 'text-red-600'}`}>
                                            {pickupTimes[storeId] || 'Requires Selection'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
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

                    {/* Bill Details */}
                    <View className="bg-white rounded-[20px] p-5 mb-8 border border-gray-100 shadow-sm mt-3">
                        <Text className="text-[17px] font-bold text-gray-900 mb-4">Bill Details</Text>
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-[14px] font-medium text-gray-500">Item Total</Text>
                            <Text className="text-[14px] font-medium text-gray-900">₹{subtotal}</Text>
                        </View>
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-[14px] font-medium text-gray-500">Taxes & Platform Fee</Text>
                            <Text className="text-[14px] font-medium text-gray-900">₹{gst}</Text>
                        </View>
                        {discount > 0 && (
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-[14px] font-bold text-green-600">Item Discount</Text>
                                <Text className="text-[14px] font-bold text-green-600">-₹{discount}</Text>
                            </View>
                        )}
                        <View className="border-t border-gray-100 mt-2 mb-3" />
                        <View className="flex-row justify-between items-center">
                            <Text className="text-[16px] font-bold text-gray-900">Grand Total</Text>
                            <Text className="text-[16px] font-extrabold text-[#111827]">₹{total}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View className="absolute left-0 right-0 px-4" pointerEvents="box-none" style={{ bottom: 105, zIndex: 99, elevation: 20 }}>
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
                    ) : isMissingPickupTime ? (
                        <View className="flex-row items-center justify-center w-full">
                            <Text className="text-white text-[17px] font-bold">Select All Pickup Times</Text>
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
            {/* Time Picker Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={!!activeTimePickerStoreId}
                onRequestClose={() => setActiveTimePickerStoreId(null)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[24px] overflow-hidden" style={{ maxHeight: '60%' }}>
                        <View className="p-5 flex-row justify-between items-center border-b border-gray-100">
                            <Text className="text-[18px] font-bold text-gray-900">Select Pickup Time</Text>
                            <TouchableOpacity onPress={() => setActiveTimePickerStoreId(null)}>
                                <Text className="text-red-500 font-bold text-[16px]">Close</Text>
                            </TouchableOpacity>
                        </View>
                        
                        {/* Day Tabs */}
                        <View className="flex-row mx-4 mt-4 mb-2 bg-gray-100 rounded-[12px] p-1">
                            <TouchableOpacity 
                                onPress={() => { Haptics.selectionAsync(); setSelectedDayTab('Today'); }}
                                className={`flex-1 py-2 items-center justify-center rounded-[10px] ${selectedDayTab === 'Today' ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : ''}`}
                            >
                                <Text className={`font-bold ${selectedDayTab === 'Today' ? 'text-gray-900' : 'text-gray-500'}`}>Today</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => { Haptics.selectionAsync(); setSelectedDayTab('Tomorrow'); }}
                                className={`flex-1 py-2 items-center justify-center rounded-[10px] ${selectedDayTab === 'Tomorrow' ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : ''}`}
                            >
                                <Text className={`font-bold ${selectedDayTab === 'Tomorrow' ? 'text-gray-900' : 'text-gray-500'}`}>Tomorrow</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ minHeight: 250, maxHeight: 400, width: '100%' }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 30, paddingTop: 10, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
                            {(() => {
                                if (!activeTimePickerStoreId) return null;
                                
                                // Attempt local lookup (fallback for older mock data)
                                const storeMeta = STORES.find(s => String(s.id) === String(activeTimePickerStoreId)) || RESTAURANTS.find(r => String(r.id) === String(activeTimePickerStoreId));
                                
                                // CRITICAL HOTFIX: Never return null! Default to 08:00-22:00 if store meta isn't found
                                const safeOpen = (storeMeta as any)?.opening_time || (storeMeta as any)?.openingTime || "08:00";
                                const safeClose = (storeMeta as any)?.closing_time || (storeMeta as any)?.closingTime || "22:00";
                                
                                const timeSlots = generateTimeSlots(safeOpen, safeClose);
                                
                                // CRITICAL EXECUTE: The Isolation Override
                                const displaySlots = timeSlots && timeSlots.length > 0 ? timeSlots : ["Test Slot 1", "Test Slot 2", "Test Slot 3"];

                                // Filter slots by active tab
                                const todaySlots = displaySlots.filter(t => t.startsWith("Today")).map(t => t.replace("Today, ", ""));
                                const tomorrowSlots = displaySlots.filter(t => t.startsWith("Tomorrow")).map(t => t.replace("Tomorrow, ", ""));
                                
                                const activeSlots = selectedDayTab === 'Today' ? todaySlots : tomorrowSlots;

                                return (
                                    <View className="flex-row flex-wrap justify-between w-full">
                                        {activeSlots.length === 0 && (
                                            <Text className="text-gray-500 text-center w-full mt-5 text-[15px]">No available time slots for {selectedDayTab.toLowerCase()}.</Text>
                                        )}
                                        {activeSlots.map((time, idx) => {
                                            const fullTimeStr = `${selectedDayTab}, ${time}`;
                                            const isSelected = pickupTimes[activeTimePickerStoreId] === fullTimeStr;
                                            return (
                                                <TouchableOpacity 
                                                    key={idx}
                                                    onPress={() => {
                                                        Haptics.selectionAsync();
                                                        setPickupTime(activeTimePickerStoreId, fullTimeStr);
                                                        setActiveTimePickerStoreId(null);
                                                    }}
                                                    delayPressIn={0}
                                                    activeOpacity={0.7}
                                                    className={`w-[48%] py-3 mb-3 rounded-[12px] flex-row items-center justify-center border ${isSelected ? 'border-[#B52725] bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                                                >
                                                    <Text className={`font-bold text-[15px] text-center ${isSelected ? 'text-[#B52725]' : 'text-gray-800'}`}>{time}</Text>
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                )
                            })()}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
