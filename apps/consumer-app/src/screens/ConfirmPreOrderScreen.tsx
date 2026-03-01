// Confirm Pre-order Screen: Order review with arrival details → Order confirmed with OTP.
import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    ScrollView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeftCircle, ChevronDown, CheckCircle, Tag, MessageSquare,
    Minus, Plus, X, Info, HelpCircle
} from 'lucide-react-native';
import { useNavigation, CommonActions, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCart } from '../context/CartContext';
import { RESTAURANTS, ALL_PRODUCTS } from '../lib/data';
import * as Haptics from 'expo-haptics';
import RazorpayCheckout from '../components/RazorpayCheckout';

const TIME_OPTIONS = ['Now (ASAP)', 'In 30 mins', 'In 1 hour', 'In 1.5 hours', 'In 2 hours'];
const GUEST_OPTIONS = Array.from({ length: 10 }, (_, i) => `${i + 1} ${i === 0 ? 'Person' : 'People'}`);

export default function ConfirmPreOrderScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'ConfirmPreOrder'>>();
    const { items, getTotal, clearCart, updateQuantity } = useCart();

    const [step, setStep] = useState<'form' | 'confirmed'>('form');
    const [selectedTime, setSelectedTime] = useState(TIME_OPTIONS[0]);
    const [selectedGuests, setSelectedGuests] = useState(GUEST_OPTIONS[0]);
    const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
    const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [couponApplied, setCouponApplied] = useState(false);
    const [couponDiscount, setCouponDiscount] = useState(0);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentId, setPaymentId] = useState<string | null>(null);

    // Receive selected coupon from Offers screen
    useEffect(() => {
        if (route.params?.selectedCoupon) {
            const { code, discount } = route.params.selectedCoupon;
            setCouponCode(code);
            setCouponDiscount(discount);
            setCouponApplied(true);
        }
    }, [route.params?.selectedCoupon]);

    const AVAILABLE_COUPONS = [
        { code: 'PASFIRST', discount: 100, description: 'Flat ₹100 off on your first order', minOrder: 500 },
        { code: 'SUNDAY50', discount: 50, description: '₹50 off on lazy Sundays', minOrder: 299 },
        { code: 'HUNGRY20', discount: 0.20, description: '20% off up to ₹100', isPercentage: true, maxDiscount: 100, minOrder: 400 },
    ];

    // Restaurant info from cart items
    const restaurantInfo = useMemo(() => {
        if (items.length === 0) return { name: '', storeId: 0 };
        const first = items[0];
        return { name: first.storeName, storeId: first.storeId };
    }, [items]);

    // Find the restaurant address from static data
    const restaurantAddress = useMemo(() => {
        if (!restaurantInfo.storeId) return '';
        const r = RESTAURANTS.find((r: any) => r.id === restaurantInfo.storeId);
        return r?.address || '';
    }, [restaurantInfo.storeId]);

    const subtotal = getTotal();
    const gst = Math.round(subtotal * 0.05);
    const discount = couponApplied ? couponDiscount : 0;
    const total = Math.max(0, subtotal + gst - discount);

    // Veg/Non-veg helper
    const getIsVeg = (productId: number) => {
        const p = ALL_PRODUCTS.find(p => p.id === productId);
        return p?.isVeg ?? true; // Default to veg if not found
    };

    const handleRemoveCoupon = () => {
        setCouponCode('');
        setCouponApplied(false);
        setCouponDiscount(0);
        // Clear navigation params too
        navigation.setParams({ selectedCoupon: undefined });
    };

    // Generate a random 4-digit OTP
    const [otp] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());

    const handlePayConfirm = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowPayment(true);
    };

    const handlePaymentSuccess = (id: string) => {
        setPaymentId(id);
        setShowPayment(false);
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
        clearCart();
        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: 'Main' }],
            })
        );
    };

    // ==================== EMPTY CART GUARD ====================
    if (items.length === 0 && step === 'form') {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <Text className="text-[18px] font-bold text-gray-900 mb-2">No items in cart</Text>
                <Text className="text-[13px] text-gray-500 font-medium mb-6">Add items from a restaurant to pre-order</Text>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="bg-[#B52725] rounded-2xl items-center justify-center px-8"
                    style={{ height: 48 }}
                >
                    <Text className="text-[14px] font-bold text-white">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ==================== ORDER CONFIRMED ====================
    if (step === 'confirmed') {
        return (
            <SafeAreaView className="flex-1 bg-white">
                <View className="flex-1 items-center justify-center px-8">
                    {/* Green check */}
                    <View className="w-20 h-20 rounded-full bg-green-50 items-center justify-center mb-6">
                        <CheckCircle size={44} color="#16A34A" />
                    </View>

                    <Text className="text-[26px] font-bold text-gray-900 text-center">Order Confirmed!</Text>
                    <Text className="text-[14px] text-gray-500 font-medium text-center mt-3 px-4 leading-5">
                        Your order has been successfully placed. Please check your OTPs below.
                    </Text>

                    {/* OTP Card */}
                    <View className="w-full bg-white border border-gray-200 rounded-2xl flex-row items-center justify-between mt-8" style={{ paddingVertical: 20, paddingHorizontal: 20 }}>
                        <View>
                            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">OTP For</Text>
                            <Text className="text-[15px] font-bold text-gray-900 mt-1">{restaurantInfo.name}</Text>
                        </View>
                        <View className="border border-gray-200 rounded-xl px-4 py-2.5">
                            <Text className="text-[20px] font-bold text-gray-900 tracking-[6px]">{otp}</Text>
                        </View>
                    </View>

                    <Text className="text-[12px] text-gray-400 font-medium text-center mt-5 px-2">
                        Please provide this OTP at the restaurant on your arrival to confirm your pre-order.
                    </Text>
                </View>

                {/* Back to Home button */}
                <View className="px-6" style={{ paddingBottom: Platform.OS === 'ios' ? 16 : 24 }}>
                    <TouchableOpacity
                        onPress={handleBackToHome}
                        className="w-full bg-[#B52725] rounded-2xl items-center justify-center"
                        style={{ height: 56 }}
                        activeOpacity={0.9}
                    >
                        <Text className="text-[15px] font-bold text-white">Back to Home</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ==================== CONFIRM PRE-ORDER FORM ====================
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

                {/* Restaurant card */}
                <View className="mx-5 mt-4 bg-white rounded-2xl border border-gray-100" style={{ paddingVertical: 18, paddingHorizontal: 20 }}>
                    <Text className="text-[18px] font-bold text-gray-900">{restaurantInfo.name}</Text>
                    <Text className="text-[13px] text-gray-500 font-medium mt-1">{restaurantAddress}</Text>
                </View>

                {/* Order Summary & Instructions */}
                <View className="mx-5 mt-4 bg-white rounded-2xl border border-gray-100" style={{ paddingVertical: 18, paddingHorizontal: 20, zIndex: 1 }}>
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Order Summary</Text>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <View className="flex-row items-center">
                                <Plus size={12} color="#B52725" strokeWidth={3} />
                                <Text className="text-[12px] font-bold text-[#B52725] ml-1">Add items</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {items.map((item) => {
                        const isVeg = getIsVeg(item.id);
                        return (
                            <View key={item.id} className="flex-row items-center justify-between mb-4">
                                <View className="flex-row items-center flex-1">
                                    <View className={`w-3.5 h-3.5 border ${isVeg ? 'border-green-600' : 'border-red-600'} items-center justify-center mr-2`} style={{ borderWidth: 1 }}>
                                        <View className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[14px] font-semibold text-gray-800" numberOfLines={1}>{item.name}</Text>
                                        <Text className="text-[11px] font-bold text-gray-400">₹{item.price}</Text>
                                    </View>
                                </View>

                                {/* Quantity Stepper (Filled) */}
                                <View className="flex-row items-center bg-[#B52725]/5 rounded-xl px-2 py-1 mx-3 border border-[#B52725]/10">
                                    <TouchableOpacity
                                        onPress={() => {
                                            updateQuantity(item.id, item.quantity - 1);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        className="bg-[#B52725] rounded-lg p-1"
                                    >
                                        <Minus size={12} color="white" strokeWidth={4} />
                                    </TouchableOpacity>

                                    <View className="w-8 items-center">
                                        <Text className="text-[14px] font-bold text-[#B52725]">{item.quantity}</Text>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => {
                                            updateQuantity(item.id, item.quantity + 1);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        className="bg-[#B52725] rounded-lg p-1"
                                    >
                                        <Plus size={12} color="white" strokeWidth={4} />
                                    </TouchableOpacity>
                                </View>

                                <Text className="text-[14px] font-bold text-gray-900 w-[60px] text-right">₹{item.price * item.quantity}</Text>
                            </View>
                        );
                    })}

                    <View className="border-t border-gray-100 my-4" />

                    {/* Special Instructions (Internal) */}
                    <View className="flex-row items-center mb-3">
                        <MessageSquare size={14} color="#B52725" fill="#B52725" strokeWidth={0} />
                        <Text className="text-[11px] font-extrabold text-[#B52725] uppercase tracking-wider ml-2">Special Instructions</Text>
                    </View>
                    <TextInput
                        className="bg-gray-50 rounded-xl p-3 text-[13px] font-semibold text-gray-800"
                        placeholder="E.g., Allergic to peanuts, need high chair..."
                        placeholderTextColor="#9CA3AF"
                        value={specialInstructions}
                        onChangeText={setSpecialInstructions}
                        multiline
                        numberOfLines={1}
                        style={{ minHeight: 46, textAlignVertical: 'top' }}
                    />
                </View>

                {/* Offers (Separate Screen) */}
                <View className="mx-5 mt-4 bg-white rounded-2xl border border-gray-100" style={{ paddingVertical: 18, paddingHorizontal: 20, zIndex: 1 }}>
                    <View className="flex-row items-center mb-3">
                        <Tag size={16} color="#B52725" fill="#B52725" />
                        <Text className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider ml-2">Offers</Text>
                    </View>

                    {couponApplied ? (
                        <View className="flex-row items-center justify-between border border-green-100 bg-green-50 rounded-2xl" style={{ height: 56, paddingHorizontal: 16 }}>
                            <View className="flex-row items-center">
                                <View className="bg-green-600 rounded-full w-5 h-5 items-center justify-center mr-3">
                                    <CheckCircle size={12} color="white" />
                                </View>
                                <View>
                                    <Text className="text-[13px] font-extrabold text-green-700 uppercase">{couponCode}</Text>
                                    <Text className="text-[10px] font-bold text-green-600">Saved ₹{couponDiscount}!</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={handleRemoveCoupon}>
                                <Text className="text-[12px] font-bold text-red-500 uppercase">Remove</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate('Offers', { subtotal });
                            }}
                            className="flex-row items-center justify-between bg-gray-50 border border-gray-100 rounded-2xl px-5"
                            style={{ height: 56 }}
                        >
                            <View className="flex-row items-center">
                                <Text className="text-[13px] font-bold text-gray-700">Select an offer to save big</Text>
                            </View>
                            <ArrowLeftCircle size={16} color="#B52725" fill="white" style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Arrival Details */}
                <View className="mx-5 mt-4 bg-white rounded-2xl border border-gray-100" style={{ paddingVertical: 18, paddingHorizontal: 20, zIndex: 20 }}>
                    <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Arrival Details</Text>

                    <View className="flex-row gap-4">
                        <View className="flex-1" style={{ zIndex: timeDropdownOpen ? 30 : 1 }}>
                            <Text className="text-[12px] font-bold text-gray-700 mb-2">Time</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setGuestDropdownOpen(false);
                                    setTimeDropdownOpen(!timeDropdownOpen);
                                }}
                                className="flex-row items-center justify-between border border-gray-200 rounded-xl"
                                style={{ height: 46, paddingHorizontal: 14 }}
                            >
                                <Text className="text-[13px] font-bold text-gray-900" numberOfLines={1}>{selectedTime}</Text>
                                <ChevronDown size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                            {timeDropdownOpen && (
                                <View className="border border-gray-200 rounded-xl mt-1 overflow-hidden bg-white absolute left-0 right-0" style={{ top: 72, zIndex: 50, elevation: 10 }}>
                                    {TIME_OPTIONS.map((opt, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            onPress={() => {
                                                setSelectedTime(opt);
                                                setTimeDropdownOpen(false);
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }}
                                            className={`px-4 py-3 ${opt === selectedTime ? 'bg-gray-100' : 'bg-white'} ${idx < TIME_OPTIONS.length - 1 ? 'border-b border-gray-100' : ''}`}
                                        >
                                            <Text className={`text-[13px] ${opt === selectedTime ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View className="flex-1" style={{ zIndex: guestDropdownOpen ? 30 : 1 }}>
                            <Text className="text-[12px] font-bold text-gray-700 mb-2">Guests</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setTimeDropdownOpen(false);
                                    setGuestDropdownOpen(!guestDropdownOpen);
                                }}
                                className="flex-row items-center justify-between border border-gray-200 rounded-xl"
                                style={{ height: 46, paddingHorizontal: 14 }}
                            >
                                <Text className="text-[13px] font-bold text-gray-900" numberOfLines={1}>{selectedGuests}</Text>
                                <ChevronDown size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                            {guestDropdownOpen && (
                                <View className="border border-gray-200 rounded-xl mt-1 overflow-hidden bg-white absolute left-0 right-0" style={{ top: 72, zIndex: 50, elevation: 10 }}>
                                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                                        {GUEST_OPTIONS.map((opt, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => {
                                                    setSelectedGuests(opt);
                                                    setGuestDropdownOpen(false);
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                }}
                                                className={`px-4 py-3 ${opt === selectedGuests ? 'bg-gray-100' : 'bg-white'} ${idx < GUEST_OPTIONS.length - 1 ? 'border-b border-gray-100' : ''}`}
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


                {/* Bill Transparency */}
                <View className="mx-5 mt-4 bg-white rounded-2xl border border-gray-100" style={{ paddingVertical: 18, paddingHorizontal: 20, zIndex: 1 }}>
                    <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Bill Details</Text>

                    <View className="flex-row justify-between mb-2.5">
                        <Text className="text-[13px] text-gray-500 font-semibold">Item Total</Text>
                        <Text className="text-[13px] text-gray-900 font-bold">₹{subtotal}</Text>
                    </View>

                    <View className="flex-row justify-between mb-2.5">
                        <Text className="text-[13px] text-gray-500 font-semibold">GST and Restaurant Charges</Text>
                        <Text className="text-[13px] text-gray-900 font-bold">₹{gst}</Text>
                    </View>

                    {couponApplied && (
                        <View className="flex-row justify-between mb-2.5">
                            <Text className="text-[13px] text-green-600 font-bold">Offer Discount</Text>
                            <Text className="text-[13px] text-green-600 font-bold">−₹{discount}</Text>
                        </View>
                    )}

                    <View className="border-t border-gray-100 my-3" />

                    <View className="flex-row justify-between items-center">
                        <Text className="text-[15px] text-gray-900 font-bold">To Pay</Text>
                        <Text className="text-[18px] text-gray-900 font-bold">₹{total}</Text>
                    </View>
                </View>

                {/* Policies & Notes */}
                <View className="mx-5 mt-4 mb-20">
                    <View className="flex-row items-start mb-3 bg-white p-4 rounded-2xl border border-gray-100">
                        <Info size={16} color="#B52725" fill="#B52725" strokeWidth={0} />
                        <View className="ml-3 flex-1">
                            <Text className="text-[12px] font-bold text-gray-900 mb-1">Cancellation & Refund Policy</Text>
                            <Text className="text-[11px] text-gray-400 leading-4 font-medium">
                                We do not offer refunds once the restaurant has accepted your order.
                                In case of any disputes, our refund cycle is 5-7 working days.
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-center py-4 bg-gray-100/50 rounded-2xl border border-dashed border-gray-200">
                        <HelpCircle size={14} color="#9CA3AF" />
                        <Text className="text-[11px] font-bold text-gray-400 ml-2">Need help with your pre-order?</Text>
                    </View>
                </View>

                {/* Bottom spacing */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Pay & Confirm button */}
            <View className="absolute bottom-0 left-0 right-0 bg-white px-6 pt-3" style={{ paddingBottom: Platform.OS === 'ios' ? 32 : 24 }}>
                <TouchableOpacity
                    onPress={handlePayConfirm}
                    className="w-full bg-[#B52725] rounded-2xl items-center justify-center"
                    style={{ height: 56 }}
                    activeOpacity={0.9}
                >
                    <Text className="text-[15px] font-bold text-white">Pay & Confirm</Text>
                </TouchableOpacity>
            </View>

            <RazorpayCheckout
                visible={showPayment}
                onClose={() => setShowPayment(false)}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                amount={total}
                restaurantName={restaurantInfo.name}
            />
        </SafeAreaView>
    );
}
