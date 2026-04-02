// Dining Pre-order Checkout: Restaurant info → Arrival details → Order summary → Pay & Confirm.
import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    Platform, Alert, BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeftCircle, ChevronDown, CheckCircle, XCircle,
    MapPin, Clock, User
} from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCart } from '../context/CartContext';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import TransactionalAuthModal from '../components/TransactionalAuthModal';
import { RESTAURANTS, ALL_PRODUCTS } from '../lib/data';
import RazorpayCheckout from '../components/RazorpayCheckout';

const GUEST_OPTIONS = Array.from({ length: 10 }, (_, i) => `${i + 1} ${i === 0 ? 'Person' : 'People'}`);

const generateArrivalSlots = (restaurant: any): string[] => {
    const slots: string[] = ['Now (ASAP)'];
    const now = new Date();
    let startHour = now.getHours() + 1;
    const endHour = 22; // assume restaurants close by 10 PM

    if (restaurant?.closingTime) {
        const [closeH] = restaurant.closingTime.split(':').map(Number);
        if (closeH > 0) {
            // use the closing time if available
        }
    }

    for (let h = startHour; h <= endHour; h++) {
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        slots.push(`Today, ${h12}:00 ${period}`);
    }
    return slots;
};

export default function DiningCheckoutScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'DiningCheckout'>>();
    const { items, getTotal, clearCart } = useCart();

    const [step, setStep] = useState<'form' | 'confirmed' | 'error'>('form');
    const [selectedTime, setSelectedTime] = useState('Now (ASAP)');
    const [selectedGuests, setSelectedGuests] = useState(GUEST_OPTIONS[0]);
    const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
    const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [razorpayOrderId, setRazorpayOrderId] = useState<string | undefined>();
    const [confirmedOtp, setConfirmedOtp] = useState('');
    const [couponApplied, setCouponApplied] = useState(false);
    const [couponDiscount, setCouponDiscount] = useState(0);
    const [couponCode, setCouponCode] = useState('');

    // Get restaurant info from cart items
    const restaurantId = items.length > 0 ? String(items[0].storeId) : null;
    const restaurant = restaurantId ? RESTAURANTS.find(r => String(r.id) === restaurantId) : null;
    const restaurantName = restaurant?.name || (items.length > 0 ? items[0].storeName : 'Restaurant');
    const restaurantAddress = restaurant?.address || '';

    const arrivalSlots = useMemo(() => generateArrivalSlots(restaurant), [restaurant]);

    // Apply coupon from route params
    useEffect(() => {
        if (route.params?.selectedCoupon) {
            const { code, discount } = route.params.selectedCoupon;
            setCouponCode(code);
            setCouponDiscount(discount);
            setCouponApplied(true);
        }
    }, [route.params?.selectedCoupon]);

    // Handle hardware back
    useEffect(() => {
        const handleBackPress = () => {
            if (step === 'confirmed') return true;
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
        return () => backHandler.remove();
    }, [step]);

    // Calculations
    const subtotal = getTotal();
    const gst = Math.round(subtotal * 0.05);
    const discount = couponApplied ? couponDiscount : 0;
    const total = Math.max(0, subtotal + gst - discount);

    const getIsVeg = (productId: string) => {
        const p = ALL_PRODUCTS.find((p: any) => String(p.id) === String(productId));
        return p?.isVeg ?? true;
    };

    const handlePayConfirm = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            const { data: { user } } = await supabase.auth.getUser();
            const res = await fetch(`${apiUrl}/payments/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: total, type: 'consumer', userId: user?.id })
            });
            const data = await res.json();
            if (data.order_id) {
                setRazorpayOrderId(data.order_id);
                setShowPayment(true);
            } else {
                Alert.alert('Payment Error', 'Failed to initialize secure payment.');
            }
        } catch (err) {
            console.error('Create order error:', err);
            Alert.alert('Error', 'Could not connect to payment server.');
        }
    };

    const handlePaymentSuccess = async (id: string, orderId?: string, signature?: string) => {
        setPaymentId(id);
        setShowPayment(false);

        try {
            // Verify Signature
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            const verifyRes = await fetch(`${apiUrl}/payments/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    razorpay_order_id: orderId,
                    razorpay_payment_id: id,
                    razorpay_signature: signature
                })
            });
            const verifyData = await verifyRes.json();
            
            if (!verifyData.success) {
                Alert.alert('Security Error', 'Payment signature could not be verified. Please contact support.');
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const orderNumber = `PAS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${user.id.slice(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
                const otp = Math.floor(1000 + Math.random() * 9000).toString();
                const now = new Date().toISOString();

                const { data: orderData, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        user_id: user.id,
                        order_number: orderNumber,
                        customer_name: user.user_metadata?.full_name || user.email?.split('@')[0],
                        customer_phone: user.phone || '',
                        store_id: String(restaurantId),
                        store_name: restaurantName,
                        amount: total,
                        total_amount: total,
                        order_type: 'dine-in',
                        otp_code: otp,
                        otp: otp,
                        items_count: items.length,
                        status: 'CONFIRMED',
                        special_instructions: '',
                        arrival_time: selectedTime,
                        guests_count: parseInt(selectedGuests) || 1,
                        created_at: now,
                        updated_at: now
                    })
                    .select()
                    .single();

                if (orderError) throw orderError;

                // Save order items
                const orderItems = items.map(item => ({
                    order_id: orderData.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    price: item.price
                }));

                const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
                if (itemsError) throw itemsError;

                setConfirmedOtp(otp);
                clearCart();
            }
        } catch (error) {
            console.error('Failed to persist dining order to Supabase:', error);
            setStep('error');
            return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('confirmed');
    };

    const handlePaymentError = (error: string) => {
        setShowPayment(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        console.warn('Payment failed:', error);
    };

    const handleBackToHome = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
    };

    // ==================== ERROR STATE ====================
    if (step === 'error') {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center p-8">
                <XCircle size={60} color="#EF4444" className="mb-6" />
                <Text className="text-[24px] font-bold text-gray-900 text-center mb-3">Order Sync Failed</Text>
                <Text className="text-[14px] text-gray-500 text-center mb-8">
                    Your payment (ID: {paymentId}) was successful, but we encountered a network error saving your order.
                </Text>
                <TouchableOpacity onPress={handleBackToHome} className="w-full bg-[#B52725] rounded-2xl items-center justify-center" style={{ height: 56 }}>
                    <Text className="text-[15px] font-bold text-white">Back to Home</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ==================== CONFIRMED STATE ====================
    if (step === 'confirmed') {
        return (
            <SafeAreaView className="flex-1 bg-white">
                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 30 }}>
                    {/* Success Header */}
                    <View className="items-center pt-14 pb-8 bg-green-50/50">
                        <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-5">
                            <CheckCircle size={52} color="#16A34A" />
                        </View>
                        <Text className="text-[28px] font-extrabold text-gray-900 text-center">Pre-order Confirmed!</Text>
                        <Text className="text-[14px] text-gray-500 font-medium text-center mt-2 px-8">
                            Show the OTP at the restaurant when you arrive. Your food will be ready!
                        </Text>
                    </View>

                    {/* OTP Card */}
                    <View className="px-5 mt-6">
                        <View className="bg-white rounded-2xl mb-4 border border-gray-200 shadow-sm overflow-hidden">
                            <View className="flex-row items-center px-5 pt-4 pb-3">
                                <View className="w-8 h-8 bg-[#B52725] rounded-full items-center justify-center mr-3">
                                    <Text className="text-white text-[13px] font-bold">1</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-[15px] font-extrabold text-gray-900">{restaurantName}</Text>
                                    <Text className="text-[11px] text-gray-400 font-medium mt-0.5">{selectedTime} • {selectedGuests}</Text>
                                </View>
                            </View>
                            <View className="mx-5 mb-4 bg-gray-50 rounded-xl p-4 items-center border border-gray-100">
                                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Dining OTP</Text>
                                <Text className="text-[32px] font-extrabold text-[#212121] tracking-[8px]">{confirmedOtp}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Payment Info */}
                    {paymentId && (
                        <View className="mx-5 mt-2 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <View className="flex-row justify-between">
                                <Text className="text-[12px] text-gray-400 font-medium">Payment ID</Text>
                                <Text className="text-[12px] text-gray-600 font-bold">{paymentId}</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Bottom CTAs */}
                <View className="px-5 pb-8 pt-4 bg-white border-t border-gray-100">
                    <TouchableOpacity onPress={handleBackToHome} className="w-full bg-[#212121] rounded-[20px] items-center justify-center" style={{ height: 60 }}>
                        <Text className="text-[16px] font-bold text-white">Back to Home</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { handleBackToHome(); setTimeout(() => navigation.navigate('YourOrders' as any), 100); }} className="w-full items-center justify-center mt-3" style={{ height: 44 }}>
                        <Text className="text-[14px] font-bold text-[#B52725]">View Order History</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ==================== EMPTY CART ====================
    if (items.length === 0 && step === 'form') {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <Text className="text-[18px] font-bold text-gray-900 mb-2">No items in cart</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} className="bg-[#B52725] rounded-2xl items-center justify-center px-8" style={{ height: 48 }}>
                    <Text className="text-[14px] font-bold text-white">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ==================== MAIN FORM ====================
    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                        <ArrowLeftCircle size={28} color="#1F2937" fill="white" />
                    </TouchableOpacity>
                    <Text className="text-[20px] font-bold text-gray-900">Confirm Pre-order</Text>
                </View>

                {/* Restaurant Card */}
                <View className="mx-5 mt-6 bg-white rounded-[20px] border border-gray-100 p-5 shadow-sm">
                    <Text className="text-[17px] font-extrabold text-[#111827] leading-tight">{restaurantName}</Text>
                    {restaurantAddress ? (
                        <Text className="text-[13px] text-gray-500 font-medium mt-1.5 leading-5">{restaurantAddress}</Text>
                    ) : null}
                </View>

                {/* Arrival Details */}
                <View className="px-5 mt-6 mb-3">
                    <Text className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wider">Arrival Details</Text>
                </View>
                <View className="mx-5 bg-white rounded-[20px] border border-gray-100 p-5 shadow-sm">
                    <View className="flex-row gap-4">
                        {/* Time Dropdown */}
                        <View className="flex-1">
                            <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Time</Text>
                            <TouchableOpacity
                                onPress={() => { setTimeDropdownOpen(!timeDropdownOpen); setGuestDropdownOpen(false); }}
                                className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 bg-gray-50/50"
                                style={{ height: 48 }}
                            >
                                <Text className="text-[14px] font-bold text-gray-900 flex-1" numberOfLines={1}>{selectedTime}</Text>
                                <ChevronDown size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                            {timeDropdownOpen && (
                                <View className="border border-gray-200 rounded-xl mt-1 overflow-hidden bg-white max-h-48">
                                    <ScrollView nestedScrollEnabled>
                                        {arrivalSlots.map((slot, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => { setSelectedTime(slot); setTimeDropdownOpen(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                                                className={`px-4 py-3 ${slot === selectedTime ? 'bg-gray-100' : 'bg-white'} ${idx < arrivalSlots.length - 1 ? 'border-b border-gray-50' : ''}`}
                                            >
                                                <Text className={`text-[13px] ${slot === selectedTime ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>{slot}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {/* Guests Dropdown */}
                        <View className="flex-1">
                            <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Guests</Text>
                            <TouchableOpacity
                                onPress={() => { setGuestDropdownOpen(!guestDropdownOpen); setTimeDropdownOpen(false); }}
                                className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 bg-gray-50/50"
                                style={{ height: 48 }}
                            >
                                <Text className="text-[14px] font-bold text-gray-900 flex-1" numberOfLines={1}>{selectedGuests}</Text>
                                <ChevronDown size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                            {guestDropdownOpen && (
                                <View className="border border-gray-200 rounded-xl mt-1 overflow-hidden bg-white max-h-48">
                                    <ScrollView nestedScrollEnabled>
                                        {GUEST_OPTIONS.map((opt, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => { setSelectedGuests(opt); setGuestDropdownOpen(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                                                className={`px-4 py-3 ${opt === selectedGuests ? 'bg-gray-100' : 'bg-white'} ${idx < GUEST_OPTIONS.length - 1 ? 'border-b border-gray-50' : ''}`}
                                            >
                                                <Text className={`text-[13px] ${opt === selectedGuests ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Order Summary */}
                <View className="px-5 mt-6 mb-3">
                    <Text className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wider">Order Summary</Text>
                </View>
                <View className="mx-5 bg-white rounded-[20px] border border-gray-100 p-5 shadow-sm">
                    {items.map((item, idx) => (
                        <View key={item.id} className={`flex-row justify-between items-center py-3 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                            <View className="flex-row items-center flex-1">
                                {/* Veg/Non-veg indicator */}
                                <View className={`w-4 h-4 border items-center justify-center mr-3 ${getIsVeg(String(item.id)) ? 'border-green-600' : 'border-red-600'}`}>
                                    <View className={`w-2 h-2 rounded-full ${getIsVeg(String(item.id)) ? 'bg-green-600' : 'bg-red-600'}`} />
                                </View>
                                <View className="bg-gray-100 rounded-lg w-7 h-7 items-center justify-center mr-3">
                                    <Text className="text-[12px] font-bold text-gray-600">{item.quantity}</Text>
                                </View>
                                <Text className="text-[14px] font-semibold text-gray-900 flex-1" numberOfLines={1}>{item.name}</Text>
                            </View>
                            <Text className="text-[14px] font-bold text-gray-900 ml-3">₹{item.price * item.quantity}</Text>
                        </View>
                    ))}

                    {/* Bill */}
                    <View className="border-t border-gray-100 mt-3 pt-3">
                        <View className="flex-row justify-between mb-1.5">
                            <Text className="text-[13px] text-gray-500 font-medium">Subtotal</Text>
                            <Text className="text-[13px] text-gray-900 font-bold">₹{subtotal}</Text>
                        </View>
                        <View className="flex-row justify-between mb-1.5">
                            <Text className="text-[13px] text-gray-500 font-medium">GST (5%)</Text>
                            <Text className="text-[13px] text-gray-900 font-bold">₹{gst}</Text>
                        </View>
                        {couponApplied && (
                            <View className="flex-row justify-between mb-1.5">
                                <Text className="text-[13px] text-green-600 font-bold">Discount</Text>
                                <Text className="text-[13px] text-green-600 font-bold">-₹{discount}</Text>
                            </View>
                        )}
                        <View className="border-t border-gray-100 my-2" />
                        <View className="flex-row justify-between items-center">
                            <Text className="text-[16px] text-gray-900 font-extrabold">Total Pay</Text>
                            <Text className="text-[18px] text-gray-900 font-extrabold">₹{total}</Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom CTA */}
            <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 bg-white border-t border-gray-50 pt-4">
                <TouchableOpacity
                    onPress={handlePayConfirm}
                    className="w-full bg-[#212121] rounded-[20px] items-center justify-center"
                    style={{ height: 60 }}
                    activeOpacity={0.9}
                >
                    <Text className="text-[16px] font-bold text-white">Pay & Confirm</Text>
                </TouchableOpacity>
            </View>

            <RazorpayCheckout
                visible={showPayment}
                onClose={() => setShowPayment(false)}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                amount={total}
                restaurantName={restaurantName}
                orderId={razorpayOrderId}
            />
        </SafeAreaView>
    );
}
