// Confirm Pre-order Screen: Order review with arrival details → Order confirmed with OTP.
import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    ScrollView, Platform, Alert, Modal, FlatList, ActivityIndicator, BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ShoppingBag, ArrowLeftCircle, Minus, Plus, ChevronRight, ChevronDown,
    Ticket, CheckCircle, Activity, XCircle, RefreshCw,
    Tag, MessageSquare, X, Info, HelpCircle, Utensils,
    MapPin, Clock, User, CircleDot, Circle, Search
} from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useOrderRequests, OrderRequest } from '../hooks/useOrderRequests';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import TransactionalAuthModal from '../components/TransactionalAuthModal';
import { STORES, RESTAURANTS, findAlternativeStores, ALL_PRODUCTS } from '../lib/data';
import RazorpayCheckout from '../components/RazorpayCheckout';
import * as Contacts from 'expo-contacts';

const TIME_OPTIONS = ['Today, 6:00 PM - 7:00 PM', 'Today, 7:00 PM - 8:00 PM', 'Today, 8:00 PM - 9:00 PM'];
const AVAILABLE_COUPONS = [
    { code: 'PASFIRST', discount: 100, description: 'Flat ₹100 off on your first order', minOrder: 500 },
    { code: 'SUNDAY50', discount: 50, description: '₹50 off on lazy Sundays', minOrder: 299 },
    { code: 'HUNGRY20', discount: 0.20, description: '20% off up to ₹100', isPercentage: true, maxDiscount: 100, minOrder: 400 },
];

const generateTimeSlots = (store: any, day: 'Today' | 'Tomorrow') => {
    if (!store?.openingTime || !store?.closingTime) return TIME_OPTIONS;

    const [openHour, openMin] = store.openingTime.split(':').map(Number);
    const [closeHour, closeMin] = store.closingTime.split(':').map(Number);

    let startHour = openHour;
    const slots = [];

    if (day === 'Today') {
        const now = new Date();
        const currentHour = now.getHours() + (now.getMinutes() > 30 ? 1 : 0);
        if (currentHour >= closeHour) return [];
        startHour = Math.max(openHour, currentHour);
    }

    for (let h = startHour; h < closeHour; h++) {
        const formatTime = (hour: number) => {
            const period = hour >= 12 ? 'PM' : 'AM';
            const h12 = hour % 12 || 12;
            return `${h12.toString().padStart(2, '0')}:00 ${period}`;
        };
        slots.push(`${day}, ${formatTime(h)} - ${formatTime(h + 1)}`);
    }
    return slots;
};

export default function CheckoutScreen() {
    // 1. ALL HOOKS AT THE VERY TOP (UNCONDITIONAL)
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Checkout'>>();
    const { items, getTotal, clearCart, updateQuantity, addItem, removeItem } = useCart();
    const {
        requests,
        allResolved,
        acceptedRequests,
        rejectedRequests,
        createRequests,
        loading
    } = useOrderRequests();

    const [step, setStep] = useState<'form' | 'waiting' | 'results' | 'confirmed' | 'error'>('form');
    const [finalTotalToPay, setFinalTotalToPay] = useState(0);
    const [finalGstToPay, setFinalGstToPay] = useState(0);
    const [selectedTime, setSelectedTime] = useState<Record<string, string>>({});
    const [isTimeModalVisible, setIsTimeModalVisible] = useState(false);
    const [activeStoreForTime, setActiveStoreForTime] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<'Today' | 'Tomorrow'>('Today');
    const [confirmedOrders, setConfirmedOrders] = useState<{ storeId: string, storeName: string, items: any[], total: number, otp: string }[]>([]);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [couponApplied, setCouponApplied] = useState(false);
    const [couponDiscount, setCouponDiscount] = useState(0);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [razorpayOrderId, setRazorpayOrderId] = useState<string | undefined>();
    const [pickupMode, setPickupMode] = useState<'myself' | 'other'>('myself');
    const [pickupName, setPickupName] = useState('');
    const [pickupPhone, setPickupPhone] = useState('');
    const [storeLocations, setStoreLocations] = useState<Record<string, any>>({});
    const { user, profile, isProfileLoading } = useAuth();
    const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card'>('upi');
    const [contactsModalVisible, setContactsModalVisible] = useState(false);
    const [contactsList, setContactsList] = useState<Contacts.Contact[]>([]);
    const [developerMode, setDeveloperMode] = useState(false);
    const [nowTimer, setNowTimer] = useState(Date.now());
    const [storeOtps, setStoreOtps] = useState<Record<string, string>>({});
    const [contactSearchText, setContactSearchText] = useState('');

    // Hooks: Effects
    useEffect(() => {
        if (items.length === 0) return; // Don't reset OTPs when cart is cleared
        const uniqueStoreIds = Array.from(new Set(items.map(i => i.storeId)));
        const otps: Record<string, string> = {};
        uniqueStoreIds.forEach(id => {
            otps[id] = Math.floor(1000 + Math.random() * 9000).toString();
        });
        setStoreOtps(otps);
    }, [items]);

    useEffect(() => {
        const handleBackPress = () => {
            if (step === 'waiting' || step === 'results') {
                Alert.alert(
                    'Cancel Checkout?',
                    'You are in the middle of confirming your order. Are you sure you want to go back and cancel these requests?',
                    [
                        { text: 'No, Stay', style: 'cancel' },
                        { text: 'Yes, Cancel', style: 'destructive', onPress: () => navigation.goBack() }
                    ]
                );
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
        return () => backHandler.remove();
    }, [step, navigation]);

    useEffect(() => {
        if (step === 'waiting' && allResolved) {
            setTimeout(() => {
                setStep('results');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }, 1000);
        }
    }, [allResolved, step]);

    useEffect(() => {
        if (step === 'waiting') {
            const interval = setInterval(() => setNowTimer(Date.now()), 1000);
            return () => clearInterval(interval);
        }
    }, [step]);

    useEffect(() => {
        if (user) {
            // Use profile name if exists, fallback to metadata name, then "User" or phone
            const userName = profile?.full_name || user.user_metadata?.full_name || 'New User';
            const userPhone = user.phone || '';

            if (pickupMode === 'myself') {
                setPickupName(userName);
                setPickupPhone(userPhone);
            }
        }
    }, [user, profile, pickupMode]);

    useEffect(() => {
        if (items.length === 0) return;
        const uniqueStoreIds = Array.from(new Set(items.map(i => i.storeId)));
        const locMap: Record<string, any> = {};
        uniqueStoreIds.forEach(id => {
            const s = STORES.find(st => st.id === id) || RESTAURANTS.find(r => r.id === id);
            if (s) locMap[id] = s;
        });
        setStoreLocations(locMap);
    }, [items]);

    useEffect(() => {
        if (route.params?.selectedCoupon) {
            const { code, discount } = route.params.selectedCoupon;
            setCouponCode(code);
            setCouponDiscount(discount);
            setCouponApplied(true);
        }
        if (route.params?.specialInstructions) {
            setSpecialInstructions(route.params.specialInstructions);
        }
    }, [route.params?.selectedCoupon, route.params?.specialInstructions]);



    // Hooks: Memoized Data
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

    const restaurantAddress = useMemo(() => {
        if (groupedStores.length === 0) return '';
        const r = RESTAURANTS.find((r: any) => r.id === groupedStores[0].storeId);
        return r?.address || '';
    }, [groupedStores]);

    const availableSlots = useMemo(() => {
        if (!activeStoreForTime) return [];
        return generateTimeSlots(storeLocations[activeStoreForTime], selectedDay);
    }, [activeStoreForTime, selectedDay, storeLocations]);

    // Derived Logic (Non-hook)
    const storeNamesList = groupedStores.map(g => g.storeName).join(', ');
    const subtotal = getTotal();
    const gst = Math.round(subtotal * 0.05);
    const discount = couponApplied ? couponDiscount : 0;
    const total = Math.max(0, subtotal + gst - discount);

    // Helpers
    const getIsVeg = (productId: string) => {
        const p = ALL_PRODUCTS.find((p: any) => String(p.id) === String(productId));
        return p?.isVeg ?? true;
    };

    const handleRemoveCoupon = () => {
        setCouponCode('');
        setCouponApplied(false);
        setCouponDiscount(0);
        navigation.setParams({ selectedCoupon: undefined });
    };

    const selectContact = async () => {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status === 'granted') {
            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
            });
            if (data.length > 0) {
                // Sort contacts alphabetically by name
                const sorted = [...data].sort((a, b) => {
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
                setContactsList(sorted);
                setContactSearchText('');
                setContactsModalVisible(true);
            } else {
                Alert.alert('No Contacts', 'No contacts found on your device.');
                setPickupMode('other');
            }
        } else {
            Alert.alert('Permission Denied', 'Please grant contacts permission in settings to pick a contact.', [{ text: 'OK' }]);
            setPickupMode('other');
        }
    };

    const handlePayConfirm = async () => {
        const missingTimeStores = groupedStores.filter(g => !selectedTime[g.storeId]);


        if (missingTimeStores.length > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const msg = missingTimeStores.length === 1
                ? `Please select a pickup time for ${missingTimeStores[0].storeName} before placing your order.`
                : 'Please select a pickup time for all your orders before proceeding.';
            Alert.alert('Select Pickup Time', msg);
            return;
        }

        if (pickupMode === 'other') {
            const cleanPhone = pickupPhone.replace('+91', '').trim();
            if (!pickupName.trim() || cleanPhone.length < 10) {
                Alert.alert('Missing Details', 'Please provide a valid name and mobile number for the person picking up.');
                return;
            }
        }


        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await createRequests(groupedStores.map(g => ({
                storeId: g.storeId,
                storeName: g.storeName,
                items: g.items,
                total: g.total
            })));
            setStep('waiting');
        } catch (e) {
            Alert.alert('Error', 'Failed to submit order requests. Please try again.');
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
                const baseOrderNumber = `PAS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${user.id.slice(0, 4).toUpperCase()}`;
                const actualSubtotal = acceptedRequests.reduce((sum: number, r: any) => sum + r.subtotal, 0);

                for (let i = 0; i < acceptedRequests.length; i++) {
                    const req = acceptedRequests[i];
                    const orderNumber = `${baseOrderNumber}-${Math.floor(100 + Math.random() * 900)}`;
                    const share = req.subtotal / (actualSubtotal || 1);
                    const groupGst = Math.round(finalGstToPay * share);
                    const groupDiscount = Math.round(discount * share);
                    const groupFinalTotal = Math.max(0, req.subtotal + groupGst - groupDiscount);

                    const storeIdStr = String(req.store_id);
                    const storeOtp = storeOtps[storeIdStr] || Math.floor(1000 + Math.random() * 9000).toString();
                    const now = new Date().toISOString();

                    const { data: orderData, error: orderError } = await supabase
                        .from('orders')
                        .insert({
                            user_id: user.id,
                            order_number: orderNumber,
                            customer_name: pickupMode === 'myself' ? (user.user_metadata?.full_name || user.email?.split('@')[0]) : pickupName,
                            customer_phone: pickupMode === 'myself' ? (user.phone || '') : pickupPhone,
                            store_id: req.store_id,
                            store_name: req.store_name,
                            amount: groupFinalTotal,
                            total_amount: groupFinalTotal,
                            order_type: 'pickup',
                            otp_code: storeOtp,
                            otp: storeOtp,
                            items_count: req.items.length,
                            status: 'PENDING',
                            special_instructions: specialInstructions,
                            arrival_time: selectedTime[storeIdStr] || 'Not selected',
                            guests_count: null,
                            created_at: now,
                            updated_at: now
                        })
                        .select()
                        .single();

                    if (orderError) throw orderError;

                    const orderItems = req.items.map((item: any) => ({
                        order_id: orderData.id,
                        product_name: item.name,
                        quantity: item.quantity,
                        price: item.price
                    }));

                    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
                    if (itemsError) throw itemsError;
                }

                // Save OTPs into confirmedOrders BEFORE clearing cart (clearCart wipes storeOtps via useEffect)
                setConfirmedOrders(acceptedRequests.map((r: any) => {
                    const sid = String(r.store_id);
                    return {
                        storeId: sid,
                        storeName: r.store_name,
                        items: r.items,
                        total: r.subtotal,
                        otp: storeOtps[sid] || Math.floor(1000 + Math.random() * 9000).toString()
                    };
                }));
                clearCart();
            }
        } catch (error) {
            console.error('Failed to persist order to Supabase:', error);
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

    // ==================== RENDERING LOGIC ====================

    if (step === 'error') {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center p-8">
                <XCircle size={60} color="#EF4444" className="mb-6" />
                <Text className="text-[24px] font-bold text-gray-900 text-center mb-3">Order Sync Failed</Text>
                <Text className="text-[14px] text-gray-500 text-center mb-8">
                    Your payment (ID: {paymentId}) was successful, but we encountered a network error sending your order to the restaurant.
                </Text>
                <TouchableOpacity onPress={handleBackToHome} className="w-full bg-[#B52725] rounded-2xl items-center justify-center" style={{ height: 56 }}>
                    <Text className="text-[15px] font-bold text-white">Back to Home</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (step === 'waiting') {
        const waitingCount = requests.filter(r => r.status === 'PENDING').length;
        const simulateMerchantResponse = async (reqId: string, newStatus: 'ACCEPTED' | 'REJECTED') => {
            try {
                const payload: any = { status: newStatus };
                if (newStatus === 'REJECTED') payload.rejection_reason = 'Simulated testing rejection';
                const { error } = await supabase.from('order_requests').update(payload).eq('id', reqId);
                if (error) throw error;
            } catch (err) {
                console.error('Failed to simulate update:', err);
                Alert.alert('Simulate Error', 'Could not update request.');
            }
        };

        return (
            <SafeAreaView className="flex-1 bg-white">
                <View className="flex-1 items-center justify-center px-8">
                    <Activity size={48} color="#B52725" className="mb-6 opacity-80" />
                    <TouchableOpacity onLongPress={() => setDeveloperMode(prev => !prev)} delayLongPress={1000} activeOpacity={0.8}>
                        <Text className="text-[24px] font-bold text-gray-900 text-center">Confirming Orders</Text>
                    </TouchableOpacity>
                    <Text className="text-[14px] text-gray-500 font-medium text-center mt-3 px-4 mb-10">
                        {waitingCount > 0 ? `Waiting for merchants to accept your order. This usually takes less than 2 minutes.` : `All merchants have responded!`}
                    </Text>
                    <View className="w-full bg-gray-50 rounded-2xl p-5 border border-gray-100">
                        {requests.map((req: any) => (
                            <View key={req.id} className="mb-4 last:mb-0">
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1 pr-4">
                                        <Text className="text-[14px] font-bold text-gray-900 mb-1" numberOfLines={1}>{req.store_name}</Text>
                                        <Text className="text-[12px] text-gray-500" numberOfLines={1}>{req.items.length} items • ₹{req.subtotal}</Text>
                                    </View>
                                    <View>
                                        {req.status === 'PENDING' && (
                                            <View className="bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                                                <Text className="text-[14px] font-bold text-orange-600">
                                                    {(() => {
                                                        const expires = new Date(req.expires_at).getTime();
                                                        const remaining = Math.max(0, Math.floor((expires - nowTimer) / 1000));
                                                        const mins = Math.floor(remaining / 60);
                                                        const secs = remaining % 60;
                                                        return `${mins}:${secs.toString().padStart(2, '0')}`;
                                                    })()}
                                                </Text>
                                            </View>
                                        )}
                                        {req.status === 'ACCEPTED' && <CheckCircle size={24} color="#10B981" />}
                                        {(req.status === 'REJECTED' || req.status === 'EXPIRED') && <XCircle size={24} color="#EF4444" />}
                                    </View>
                                </View>
                                {developerMode && req.status === 'PENDING' && (
                                    <View className="flex-row mt-2 pt-2 border-t border-gray-200 justify-end space-x-3">
                                        <TouchableOpacity onPress={() => simulateMerchantResponse(req.id, 'ACCEPTED')} className="bg-green-100 px-4 py-1.5 rounded-lg border border-green-200"><Text className="text-green-800 text-[12px] font-bold">Simulate Accept</Text></TouchableOpacity>
                                        <TouchableOpacity onPress={() => simulateMerchantResponse(req.id, 'REJECTED')} className="bg-red-100 px-4 py-1.5 rounded-lg border border-red-200"><Text className="text-red-800 text-[12px] font-bold">Simulate Reject</Text></TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    if (step === 'results') {
        const resultSubtotal = acceptedRequests.reduce((sum: number, req: any) => sum + req.subtotal, 0);
        const resultGst = Math.round(resultSubtotal * 0.05);
        const resultTotal = Math.max(0, resultSubtotal + resultGst - (couponApplied ? couponDiscount : 0));

        // Pending swap requests — show as "in progress"
        const pendingSwaps = requests.filter(r => r.status === 'PENDING');

        const confirmAccepted = async () => {
            if (acceptedRequests.length === 0) { navigation.goBack(); return; }
            let newDiscount = couponApplied ? couponDiscount : 0;
            if (couponApplied) {
                const appliedCoupon = AVAILABLE_COUPONS.find(c => c.code === couponCode);
                if (appliedCoupon && resultSubtotal < appliedCoupon.minOrder) {
                    Alert.alert('Coupon Removed', 'Subtotal below minimum for coupon.');
                    newDiscount = 0;
                }
            }
            const newTotal = Math.max(0, resultSubtotal + resultGst - newDiscount);
            setFinalTotalToPay(newTotal);
            setFinalGstToPay(resultGst);

            try {
                // Fetch the API URL from process.env
                const apiUrl = process.env.EXPO_PUBLIC_API_URL;
                const { data: { user } } = await supabase.auth.getUser();
                const res = await fetch(`${apiUrl}/payments/create-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: newTotal, type: 'consumer', userId: user?.id })
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

        const handleSwapStore = async (req: OrderRequest, alt: any) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            req.items.forEach(reqItem => {
                if (reqItem.id) removeItem(String(reqItem.id));
                else {
                    const cartMatch = items.find(i => String(i.storeId) === String(req.store_id) && i.name === reqItem.name);
                    if (cartMatch) removeItem(String(cartMatch.id));
                }
            });
            alt.matchedItems.forEach((altItem: any) => {
                const originalReqItem = req.items.find((i: any) => i.name === altItem.name);
                addItem({ ...altItem, storeId: alt.storeId, storeName: alt.storeName, isDining: alt.isDining, uom: String(originalReqItem?.quantity || 1) });
            });
            const newTotal = alt.matchedItems.reduce((sum: number, item: any) => {
                const originalReqItem = req.items.find((i: any) => i.name === item.name);
                return sum + (item.price * (originalReqItem?.quantity || 1));
            }, 0);
            const newReqItems = alt.matchedItems.map((item: any) => ({
                id: item.id, name: item.name, quantity: req.items.find((i: any) => i.name === item.name)?.quantity || 1, price: item.price
            }));
            const newStoreGroup = { storeId: alt.storeId, storeName: alt.storeName, items: newReqItems, total: newTotal };
            setStoreOtps(prev => ({ ...prev, [alt.storeId]: Math.floor(1000 + Math.random() * 9000).toString() }));
            const reqStoreId = parseInt(req.store_id, 10);
            if (selectedTime[reqStoreId]) setSelectedTime(prev => ({ ...prev, [alt.storeId]: prev[reqStoreId] }));
            try {
                await createRequests([newStoreGroup], req.id);
                // Stay on results screen — don't jump to waiting
                // The new PENDING request will appear in the pendingSwaps section
            } catch (err) { Alert.alert('Error', 'Failed to swap request.'); }
        };

        return (
            <SafeAreaView className="flex-1 bg-white">
                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
                    {/* Header */}
                    <View className="px-6 pt-6 pb-4">
                        <Text className="text-[28px] font-extrabold text-gray-900">Order Status</Text>
                        <Text className="text-[14px] text-gray-500 font-medium mt-1">Here&apos;s what your stores said</Text>
                    </View>

                    {/* Summary Banner */}
                    <View className="mx-5 mb-5 rounded-2xl overflow-hidden">
                        <View className="flex-row">
                            {acceptedRequests.length > 0 && (
                                <View className="flex-1 bg-green-50 px-5 py-4 border border-green-100 rounded-l-2xl">
                                    <Text className="text-[28px] font-extrabold text-green-700">{acceptedRequests.length}</Text>
                                    <Text className="text-[11px] font-bold text-green-600 uppercase mt-1">Accepted</Text>
                                </View>
                            )}
                            {rejectedRequests.length > 0 && (
                                <View className={`flex-1 bg-red-50 px-5 py-4 border border-red-100 ${acceptedRequests.length > 0 ? '' : 'rounded-l-2xl'} ${pendingSwaps.length > 0 ? '' : 'rounded-r-2xl'}`}>
                                    <Text className="text-[28px] font-extrabold text-red-600">{rejectedRequests.length}</Text>
                                    <Text className="text-[11px] font-bold text-red-500 uppercase mt-1">Unavailable</Text>
                                </View>
                            )}
                            {pendingSwaps.length > 0 && (
                                <View className={`flex-1 bg-orange-50 px-5 py-4 border border-orange-100 rounded-r-2xl`}>
                                    <Text className="text-[28px] font-extrabold text-orange-600">{pendingSwaps.length}</Text>
                                    <Text className="text-[11px] font-bold text-orange-500 uppercase mt-1">Pending</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Accepted Orders */}
                    {acceptedRequests.length > 0 && (
                        <View className="px-5 mb-6">
                            <Text className="text-[13px] font-extrabold text-green-700 uppercase tracking-wider mb-3 px-1">Ready to Fulfill</Text>
                            {acceptedRequests.map((req: any) => {
                                const storeIdNum = parseInt(req.store_id, 10);
                                return (
                                    <View key={req.id} className="bg-white p-5 rounded-2xl mb-3 border border-green-200 shadow-sm">
                                        <View className="flex-row items-center mb-3">
                                            <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mr-3">
                                                <CheckCircle size={18} color="#16A34A" />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="font-extrabold text-gray-900 text-[16px]">{req.store_name}</Text>
                                                {selectedTime[storeIdNum] && (
                                                    <Text className="text-[11px] text-gray-400 font-medium mt-0.5">{selectedTime[storeIdNum]}</Text>
                                                )}
                                            </View>
                                            <Text className="text-[15px] font-bold text-gray-900">₹{req.subtotal}</Text>
                                        </View>
                                        <View className="bg-gray-50 rounded-xl p-3">
                                            {req.items.map((item: any, idx: number) => (
                                                <View key={idx} className="flex-row justify-between items-center py-1.5">
                                                    <Text className="text-[13px] text-gray-600 font-medium flex-1">{item.quantity}x {item.name}</Text>
                                                    <Text className="text-[13px] text-gray-800 font-semibold">₹{item.price * item.quantity}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Rejected Orders */}
                    {rejectedRequests.length > 0 && (
                        <View className="px-5 mb-6">
                            <Text className="text-[13px] font-extrabold text-red-600 uppercase tracking-wider mb-3 px-1">Unavailable</Text>
                            {rejectedRequests.map((req: any) => {
                                const alternatives = findAlternativeStores(req.store_id, req.items.map((i: any) => i.name));
                                return (
                                    <View key={req.id} className="bg-white p-5 rounded-2xl mb-3 border border-red-100 shadow-sm">
                                        <View className="flex-row items-center mb-2">
                                            <View className="w-8 h-8 bg-red-50 rounded-full items-center justify-center mr-3">
                                                <XCircle size={18} color="#EF4444" />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="font-extrabold text-gray-900 text-[16px]">{req.store_name}</Text>
                                                <Text className="text-red-500 text-[11px] font-semibold mt-0.5">
                                                    {req.status === 'EXPIRED' ? 'Store timed out' : (req.rejection_reason || 'Currently unavailable')}
                                                </Text>
                                            </View>
                                        </View>
                                        {alternatives.length > 0 && (
                                            <View className="mt-3 pt-3 border-t border-gray-100">
                                                <Text className="text-[11px] font-bold text-gray-400 uppercase mb-2">Try these instead</Text>
                                                {alternatives.map((alt: any) => (
                                                    <View key={alt.storeId} className="flex-row items-center justify-between mb-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                        <View className="flex-1">
                                                            <Text className="font-bold text-gray-900 text-[13px]">{alt.storeName}</Text>
                                                            <Text className="text-gray-400 text-[11px]">{alt.distance} away</Text>
                                                        </View>
                                                        <TouchableOpacity onPress={() => handleSwapStore(req, alt)} className="bg-[#212121] px-4 py-2 rounded-xl">
                                                            <Text className="text-[11px] font-bold text-white">Swap</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Pending Swaps */}
                    {pendingSwaps.length > 0 && (
                        <View className="px-5 mb-6">
                            <Text className="text-[13px] font-extrabold text-orange-600 uppercase tracking-wider mb-3 px-1">Swap In Progress</Text>
                            {pendingSwaps.map((req: any) => (
                                <View key={req.id} className="bg-white p-5 rounded-2xl mb-3 border border-orange-200 shadow-sm">
                                    <View className="flex-row items-center">
                                        <View className="w-8 h-8 bg-orange-50 rounded-full items-center justify-center mr-3">
                                            <RefreshCw size={16} color="#EA580C" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-extrabold text-gray-900 text-[16px]">{req.store_name}</Text>
                                            <Text className="text-orange-500 text-[11px] font-semibold mt-0.5">Waiting for merchant response...</Text>
                                        </View>
                                        <ActivityIndicator size="small" color="#EA580C" />
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Bill Summary */}
                    {acceptedRequests.length > 0 && (
                        <View className="mx-5 mb-6 bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            <Text className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wider mb-3">Payment Summary</Text>
                            <View className="flex-row justify-between mb-2"><Text className="text-[13px] text-gray-500 font-medium">Subtotal</Text><Text className="text-[13px] text-gray-900 font-bold">₹{resultSubtotal}</Text></View>
                            <View className="flex-row justify-between mb-2"><Text className="text-[13px] text-gray-500 font-medium">GST (5%)</Text><Text className="text-[13px] text-gray-900 font-bold">₹{resultGst}</Text></View>
                            {couponApplied && <View className="flex-row justify-between mb-2"><Text className="text-[13px] text-green-600 font-bold">Discount</Text><Text className="text-[13px] text-green-600 font-bold">-₹{couponDiscount}</Text></View>}
                            <View className="border-t border-gray-200 my-2" />
                            <View className="flex-row justify-between"><Text className="text-[15px] text-gray-900 font-extrabold">Total</Text><Text className="text-[18px] text-gray-900 font-extrabold">₹{resultTotal}</Text></View>
                        </View>
                    )}
                </ScrollView>

                {/* Bottom CTA */}
                <View className="px-5 bg-white border-t border-gray-100 pt-4 pb-8">
                    {acceptedRequests.length > 0 && pendingSwaps.length === 0 ? (
                        <TouchableOpacity onPress={confirmAccepted} className="w-full bg-[#212121] rounded-[20px] items-center justify-between flex-row px-6" style={{ height: 60 }}>
                            <Text className="text-[16px] font-bold text-white">Proceed to Pay</Text>
                            <Text className="text-[16px] font-bold text-white">₹{resultTotal}</Text>
                        </TouchableOpacity>
                    ) : pendingSwaps.length > 0 ? (
                        <View className="w-full bg-gray-300 rounded-[20px] items-center justify-center" style={{ height: 60 }}>
                            <Text className="text-[14px] font-bold text-gray-600">Waiting for {pendingSwaps.length} swap{pendingSwaps.length > 1 ? 's' : ''} to confirm...</Text>
                        </View>
                    ) : (
                        <TouchableOpacity onPress={() => navigation.goBack()} className="w-full bg-gray-200 rounded-[20px] items-center justify-center" style={{ height: 60 }}>
                            <Text className="text-[15px] font-bold text-gray-700">Back to Cart</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <RazorpayCheckout visible={showPayment} onClose={() => setShowPayment(false)} onSuccess={handlePaymentSuccess} onError={handlePaymentError} amount={finalTotalToPay || total} restaurantName={storeNamesList} orderId={razorpayOrderId} />
            </SafeAreaView>
        );
    }

    if (items.length === 0 && step === 'form') {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <Text className="text-[18px] font-bold text-gray-900 mb-2">No items in cart</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} className="bg-[#B52725] rounded-2xl items-center justify-center px-8" style={{ height: 48 }}><Text className="text-[14px] font-bold text-white">Go Back</Text></TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (step === 'confirmed') {
        return (
            <SafeAreaView className="flex-1 bg-white">
                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 30 }}>
                    {/* Success Header */}
                    <View className="items-center pt-14 pb-8 bg-green-50/50">
                        <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-5">
                            <CheckCircle size={52} color="#16A34A" />
                        </View>
                        <Text className="text-[28px] font-extrabold text-gray-900 text-center">Order Confirmed!</Text>
                        <Text className="text-[14px] text-gray-500 font-medium text-center mt-2 px-8">
                            Show the OTP at the store when you arrive to collect your order.
                        </Text>
                    </View>

                    {/* OTP Cards */}
                    <View className="px-5 mt-6">
                        <Text className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wider mb-4 px-1">Your Pickup Codes</Text>
                        {confirmedOrders.map((group, idx) => (
                            <View key={group.storeId} className="bg-white rounded-2xl mb-4 border border-gray-200 shadow-sm overflow-hidden">
                                {/* Store Header */}
                                <View className="flex-row items-center px-5 pt-4 pb-3">
                                    <View className="w-8 h-8 bg-[#B52725] rounded-full items-center justify-center mr-3">
                                        <Text className="text-white text-[13px] font-bold">{idx + 1}</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[15px] font-extrabold text-gray-900">{group.storeName}</Text>
                                        <Text className="text-[11px] text-gray-400 font-medium mt-0.5">{group.items.length} item{group.items.length > 1 ? 's' : ''} • ₹{group.total}</Text>
                                    </View>
                                </View>
                                {/* OTP Display */}
                                <View className="mx-5 mb-4 bg-gray-50 rounded-xl p-4 items-center border border-gray-100">
                                    <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pickup OTP</Text>
                                    <Text className="text-[32px] font-extrabold text-[#212121] tracking-[8px]">{group.otp}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Payment Info */}
                    {paymentId && (
                        <View className="mx-5 mt-2 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <View className="flex-row justify-between"><Text className="text-[12px] text-gray-400 font-medium">Payment ID</Text><Text className="text-[12px] text-gray-600 font-bold">{paymentId}</Text></View>
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

    // ==================== MAIN FORM RENDER ====================
    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4"><ArrowLeftCircle size={28} color="#1F2937" fill="white" /></TouchableOpacity>
                    <Text className="text-[20px] font-bold text-gray-900">Checkout</Text>
                </View>

                <View className="px-5 mt-6 mb-3">
                    <Text className="text-[12px] font-extrabold text-[#B52725] uppercase tracking-wider">Pickup Locations</Text>
                </View>

                {groupedStores.map((group, idx) => {
                    const storeData = storeLocations[group.storeId];
                    return (
                        <View key={group.storeId} className="mx-5 mb-4 bg-white rounded-[20px] border border-gray-100 p-5 shadow-sm">
                            <View className="flex-row items-center mb-4">
                                <View className="w-6 h-6 bg-[#B52725] rounded-full items-center justify-center mr-3"><Text className="text-white text-[12px] font-bold">{idx + 1}</Text></View>
                                <Text className="text-[17px] font-extrabold text-[#111827] leading-tight flex-1">Stop {idx + 1}: {group.storeName}</Text>
                            </View>
                            <View className="flex-row items-start mb-4 bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                <MapPin size={18} color="#B52725" className="mt-0.5" />
                                <View className="ml-3 flex-1">
                                    <Text className="text-[14px] font-bold text-gray-900 mb-1">Location</Text>
                                    <Text className="text-[13px] text-gray-500 font-medium leading-5" numberOfLines={2}>{storeData?.address || storeData?.location || 'Fetching address...'}</Text>
                                </View>
                            </View>
                            <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-3.5 border border-gray-100 mt-2">
                                <View className="flex-row items-center flex-1">
                                    <Clock size={18} color="#4B5563" />
                                    <Text className="text-[14px] font-bold text-gray-900 ml-3 flex-1" numberOfLines={1}>{selectedTime[group.storeId] || 'Select Pickup Time'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => { setActiveStoreForTime(group.storeId); setIsTimeModalVisible(true); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Text className="text-[13px] font-bold text-gray-900 underline">Change</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}

                <View className="px-5 mt-4 mb-3">
                    <Text className="text-[12px] font-extrabold text-[#B52725] uppercase tracking-wider">Picking up for</Text>
                </View>
                <View className="mx-5 mb-4 bg-white rounded-[20px] border border-gray-100 p-5 shadow-sm">
                    <View className="flex-row bg-gray-100/80 rounded-xl p-1 mb-4">
                        <TouchableOpacity onPress={() => {
                            setPickupMode('myself');
                            // Restore user's own name/phone from global context
                            if (user) {
                                const userName = profile?.full_name || user.user_metadata?.full_name || 'New User';
                                setPickupName(userName);
                                setPickupPhone(user.phone || '');
                            }
                        }} className={`flex-1 py-3 rounded-lg items-center ${pickupMode === 'myself' ? 'bg-white shadow-sm' : ''}`}><Text className={`text-[14px] font-bold ${pickupMode === 'myself' ? 'text-gray-900' : 'text-gray-500'}`}>Myself</Text></TouchableOpacity>
                        <TouchableOpacity onPress={selectContact} className={`flex-1 py-3 rounded-lg items-center ${pickupMode === 'other' ? 'bg-white shadow-sm' : ''}`}><Text className={`text-[14px] font-bold ${pickupMode === 'other' ? 'text-gray-900' : 'text-gray-500'}`}>Someone Else</Text></TouchableOpacity>
                    </View>
                    {pickupMode === 'myself' && (
                        <View className="bg-gray-50 rounded-xl px-4 py-3.5 border border-gray-100">
                            <View className="flex-row items-center mb-2">
                                <User size={16} color="#6B7280" />
                                <Text className="text-[14px] font-bold text-gray-900 ml-3">
                                    {isProfileLoading ? 'Loading Profile...' : (pickupName || user?.phone || 'New User')}
                                </Text>
                            </View>
                            {pickupPhone ? (
                                <Text className="text-[13px] text-gray-500 font-medium ml-7">{pickupPhone}</Text>
                            ) : null}
                        </View>
                    )}
                    {pickupMode === 'other' && (
                        <View className="space-y-3">
                            <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50/50">
                                <User size={18} color="#9CA3AF" />
                                <TextInput className="flex-1 ml-3 text-[15px] font-bold text-[#111827]" placeholder="Enter Name" value={pickupName} onChangeText={setPickupName} placeholderTextColor="#9CA3AF" />
                            </View>
                            <View className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3.5 mt-3 bg-gray-50/50">
                                <View className="flex-row items-center flex-1">
                                    <Text className="text-[15px] font-bold text-gray-500 mr-2">+91</Text>
                                    <TextInput className="flex-1 text-[15px] font-bold text-[#111827]" placeholder="Mobile Number" value={pickupPhone.replace('+91', '').trim()} onChangeText={(t) => setPickupPhone('+91 ' + t)} keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />
                                </View>
                                <TouchableOpacity className="bg-white border border-gray-200 p-2 rounded-lg shadow-sm" onPress={selectContact}><Search size={16} color="#4B5563" /></TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                <View className="px-5 mt-4 mb-3"><Text className="text-[12px] font-extrabold text-[#B52725] uppercase tracking-wider">Bill Details</Text></View>
                <View className="mx-5 mb-20 bg-white rounded-2xl border border-gray-100 p-5">
                    <View className="flex-row justify-between mb-2.5"><Text className="text-[13px] text-gray-500 font-semibold">Item Total</Text><Text className="text-[13px] text-gray-900 font-bold">₹{subtotal}</Text></View>
                    <View className="flex-row justify-between mb-2.5"><Text className="text-[13px] text-gray-500 font-semibold">GST and Restaurant Charges</Text><Text className="text-[13px] text-gray-900 font-bold">₹{gst}</Text></View>
                    {couponApplied && <View className="flex-row justify-between mb-2.5"><Text className="text-[13px] text-green-600 font-bold">Offer Discount</Text><Text className="text-[13px] text-green-600 font-bold">−₹{discount}</Text></View>}
                    <View className="border-t border-gray-100 my-3" />
                    <View className="flex-row justify-between items-center"><Text className="text-[15px] text-gray-900 font-bold">To Pay</Text><Text className="text-[18px] text-gray-900 font-bold">₹{total}</Text></View>
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 bg-white border-t border-gray-50 pt-4">
                <TouchableOpacity onPress={handlePayConfirm} disabled={loading} className={`w-full rounded-[20px] items-center justify-between flex-row px-6 ${loading ? 'bg-gray-400' : 'bg-[#212121]'}`} style={{ height: 60 }}>
                    <Text className="text-[16px] font-bold text-white">{loading ? 'Processing...' : 'Place Order'}</Text>
                    {!loading && <Text className="text-[16px] font-bold text-white">₹{total}</Text>}
                </TouchableOpacity>
            </View>

            <Modal visible={contactsModalVisible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100"><Text className="text-[18px] font-bold text-gray-900">Select Contact</Text><TouchableOpacity onPress={() => setContactsModalVisible(false)}><X size={24} color="#6B7280" /></TouchableOpacity></View>
                    {/* Search Bar */}
                    <View className="px-5 py-3 border-b border-gray-100">
                        <View className="flex-row items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                            <Search size={16} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-[14px] font-semibold text-gray-800"
                                placeholder="Search by name or phone..."
                                placeholderTextColor="#9CA3AF"
                                value={contactSearchText}
                                onChangeText={setContactSearchText}
                                autoCorrect={false}
                            />
                            {contactSearchText.length > 0 && (
                                <TouchableOpacity onPress={() => setContactSearchText('')}>
                                    <X size={16} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <FlatList data={contactsList.filter(c => {
                        if (!contactSearchText) return true;
                        const q = contactSearchText.toLowerCase();
                        const nameMatch = (c.name || '').toLowerCase().includes(q);
                        const phoneMatch = c.phoneNumbers?.some(p => (p.number || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')));
                        return nameMatch || phoneMatch;
                    })} keyExtractor={(item) => (item as any).id || Math.random().toString()} renderItem={({ item }) => (
                        <TouchableOpacity className="px-5 py-4 border-b border-gray-50 flex-row items-center" onPress={() => { setPickupName(item.name || ''); const phone = item.phoneNumbers && item.phoneNumbers.length > 0 ? item.phoneNumbers[0].number : ''; setPickupPhone(phone || ''); setPickupMode('other'); setContactsModalVisible(false); }}>
                            <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3"><Text className="font-bold text-gray-500">{item.name?.charAt(0) || '?'}</Text></View>
                            <View><Text className="text-[16px] font-bold text-gray-900">{item.name}</Text>{item.phoneNumbers && item.phoneNumbers.length > 0 && <Text className="text-[13px] text-gray-500 mt-0.5">{item.phoneNumbers[0].number}</Text>}</View>
                        </TouchableOpacity>
                    )} />
                </SafeAreaView>
            </Modal>

            <Modal visible={isTimeModalVisible} animationType="slide" transparent={true}>
                <View className="flex-1 justify-end bg-black/40">
                    <TouchableOpacity className="flex-1" onPress={() => setIsTimeModalVisible(false)} />
                    <View className="bg-white rounded-t-3xl pt-4 pb-8 p-5">
                        <Text className="text-[18px] font-extrabold text-gray-900 text-center mb-6">Select Pickup Time</Text>
                        <View className="flex-row bg-gray-50 rounded-xl p-1 mb-6">
                            <TouchableOpacity onPress={() => setSelectedDay('Today')} className={`flex-1 py-3 rounded-lg items-center ${selectedDay === 'Today' ? 'bg-white shadow-sm' : ''}`}><Text className={`text-[14px] font-bold ${selectedDay === 'Today' ? 'text-gray-900' : 'text-gray-400'}`}>Today</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setSelectedDay('Tomorrow')} className={`flex-1 py-3 rounded-lg items-center ${selectedDay === 'Tomorrow' ? 'bg-white shadow-sm' : ''}`}><Text className={`text-[14px] font-bold ${selectedDay === 'Tomorrow' ? 'text-gray-900' : 'text-gray-400'}`}>Tomorrow</Text></TouchableOpacity>
                        </View>
                        <ScrollView className="max-h-[350px]">
                            {availableSlots.length > 0 ? (
                                <View className="flex-row flex-wrap justify-between">
                                    {availableSlots.map((slot, i) => (
                                        <TouchableOpacity key={i} onPress={() => { setSelectedTime({ ...selectedTime, [activeStoreForTime!]: slot }); setIsTimeModalVisible(false); }} className={`w-[48%] py-3.5 rounded-xl border mb-3 items-center ${selectedTime[activeStoreForTime!] === slot ? 'bg-[#212121]' : 'bg-white border-gray-200'}`}><Text className={`text-[13px] font-bold ${selectedTime[activeStoreForTime!] === slot ? 'text-white' : 'text-gray-700'}`}>{slot.split(', ')[1]}</Text></TouchableOpacity>
                                    ))}
                                </View>
                            ) : <Text className="text-center text-gray-500 py-10">Store is closed for the rest of {selectedDay.toLowerCase()}.</Text>}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <RazorpayCheckout visible={showPayment} onClose={() => setShowPayment(false)} onSuccess={handlePaymentSuccess} onError={handlePaymentError} amount={finalTotalToPay || total} restaurantName={storeNamesList} orderId={razorpayOrderId} />
        </SafeAreaView>
    );
}
