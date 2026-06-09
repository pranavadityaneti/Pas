// @lock — DO NOT EDIT WITHOUT EXPLICIT USER PERMISSION.
// Pickup Checkout — multiple approved layers (cumulative, latest 2026-06-09):
//   1. Non-absolute bottom CTA with pb-[100px] for tab bar clearance (original layout fix).
//   2. handlePaymentSuccess session-recovery block: refresh + getSession to recover
//      from Razorpay WebView session eviction (uses `effectiveUser`, not `user`, for
//      both /payments/verify and /orders calls).
//   3. errorDiagnostic state + on-screen red diagnostic box that shows the actual
//      exception message (e.g. Prisma FK violations) — this is what surfaced the
//      missing-Prisma-User-row bug during the live demo.
//   4. apiClient.fetch migration for /order-requests/{id}/status PATCH and /orders POST
//      (approved 2026-06-08, Option A patch #1 — adds Authorization Bearer header
//      without changing the session-recovery semantics from layer #2; effectiveUser
//      resolution is preserved byte-for-byte and is still the user id passed in the body).
//   5. executeCancelOrder multi-store loop (approved 2026-06-08, Option A patch
//      #6 — replaces single-request cancel with Promise.allSettled over ALL
//      acceptedRequests + PENDING requests so stores B..N are not left ACCEPTED
//      until cron expiry. Does not touch handlePaymentSuccess, session-recovery,
//      or the apiClient migration from layer 4).
//   6. Phase 4 coupon-foolproof integration approved 2026-06-09. Reads
//      appliedCoupon from CartContext (single source of truth for the server-signed
//      validation token + signed discount). Sends validationToken + couponId +
//      couponCode in the POST /orders body so the server (Phase 2F) can verify
//      the token before applying the discount snapshot. Legacy AVAILABLE_COUPONS
//      local constant + couponCode / couponApplied / couponDiscount local state
//      removed — CartContext.appliedCoupon is now authoritative. On the proceed-
//      to-pay step we synchronously re-validate the coupon if its token expires
//      within 60s (closes the "stale token sent to server" bleed); on failure
//      we clear the coupon and alert the user. Live countdown UI on the banner
//      deferred to a follow-up styling pass (no bleeds, just polish). Does NOT
//      touch session-recovery (layer 2), errorDiagnostic (layer 3), apiClient.fetch
//      URL paths or effectiveUser resolution (layer 4), or executeCancelOrder
//      (layer 5).
// Any modification to the checkout flow, error UI, or session-handling logic
// REQUIRES the user's explicit chat-confirmed approval. Hard lock.
// Confirm Pre-order Screen: Order review with arrival details → Order confirmed with OTP.
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { useNavigation, useRoute, RouteProp, CommonActions, usePreventRemove } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useOrderRequests, OrderRequest } from '../hooks/useOrderRequests';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { apiClient, validateCoupon, checkCouponOrderEligibility, type ValidateCouponCartItem } from '../lib/api';
import TransactionalAuthModal from '../components/TransactionalAuthModal';
import { STORES, RESTAURANTS, findAlternativeStores, ALL_PRODUCTS } from '../lib/data';
import RazorpayCheckout from '../components/RazorpayCheckout';
import * as Contacts from 'expo-contacts';
import { parseUtc } from '../utils/dateFormat';

const TIME_OPTIONS = ['Today, 6:00 PM - 7:00 PM', 'Today, 7:00 PM - 8:00 PM', 'Today, 8:00 PM - 9:00 PM'];
// Phase 4 (2026-06-09): legacy AVAILABLE_COUPONS constant removed. The applied
// coupon now lives in CartContext (server-validated via /checkout/validate-coupon)
// and the discount comes from the signed token's `discount` field, not a hardcoded
// list. The old minOrder client-side guard is now enforced server-side too.

const generateTimeSlots = (store: any, day: 'Today' | 'Tomorrow') => {
    if (!store?.openingTime || !store?.closingTime) return TIME_OPTIONS;

    const prepTimeMinutes = store.prep_time || store.prepTime || 15;
    const now = new Date();
    const earliestPickupTime = new Date(now.getTime() + prepTimeMinutes * 60000);

    const [openHour] = store.openingTime.split(':').map(Number);
    const [closeHour] = store.closingTime.split(':').map(Number);

    const slots = [];

    for (let h = openHour; h < closeHour; h++) {
        const formatTime = (hour: number) => {
            const period = hour >= 12 ? 'PM' : 'AM';
            const h12 = hour % 12 || 12;
            return `${h12.toString().padStart(2, '0')}:00 ${period}`;
        };

        if (day === 'Today') {
            const slotEndTime = new Date(now);
            slotEndTime.setHours(h + 1, 0, 0, 0);
            
            // If the slot ends before our earliest possible pickup time, drop it
            if (slotEndTime < earliestPickupTime) {
                continue;
            }
        }

        slots.push(`${day}, ${formatTime(h)} - ${formatTime(h + 1)}`);
    }

    return slots;
};

export default function CheckoutScreen() {
    // 1. ALL HOOKS AT THE VERY TOP (UNCONDITIONAL)
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Checkout'>>();
    // Phase 4 (2026-06-09): appliedCoupon + setAppliedCoupon + clearAppliedCoupon
    // are the source of truth for coupon state on this screen. clearCart
    // auto-clears appliedCoupon too (see CartContext.tsx), so post-order cleanup
    // doesn't need explicit clear. setAppliedCoupon is used by the proceed-to-pay
    // re-validate path to refresh the token when it nears expiry.
    const { items, getTotal, clearCart, updateQuantity, addItem, removeItem, appliedCoupon, setAppliedCoupon, clearAppliedCoupon } = useCart();
    const {
        requests,
        allResolved,
        acceptedRequests,
        rejectedRequests,
        createRequests,
        loading
    } = useOrderRequests();

    const [step, setStep] = useState<'form' | 'waiting' | 'results' | 'confirmed' | 'error'>('form');
    const [errorDiagnostic, setErrorDiagnostic] = useState<string>('');
    const [finalTotalToPay, setFinalTotalToPay] = useState(0);
    const [finalGstToPay, setFinalGstToPay] = useState(0);
    const [selectedTime, setSelectedTime] = useState<Record<string, string>>({});
    const [isTimeModalVisible, setIsTimeModalVisible] = useState(false);
    const [activeStoreForTime, setActiveStoreForTime] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<'Today' | 'Tomorrow'>('Today');
    const [confirmedOrders, setConfirmedOrders] = useState<{ storeId: string, storeName: string, items: any[], total: number, orderNumber?: string, otp: string }[]>([]);
    const [specialInstructions, setSpecialInstructions] = useState('');
    // Phase 4 (2026-06-09): legacy couponCode/couponApplied/couponDiscount local
    // state removed. CartContext.appliedCoupon is authoritative. See useCart()
    // destructuring above.
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
    const [alternativesMap, setAlternativesMap] = useState<Record<string, any[]>>({});

    // Detect dining vs pickup context from cart items
    const isDiningOrder = items.some(item => item.isDining);

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

    const forceNav = useRef(false);

    // Handle cancellation via API
    const executeCancelOrder = async () => {
        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            const toCancel: OrderRequest[] = [
                ...acceptedRequests,
                ...requests.filter(r => r.status === 'PENDING' && !acceptedRequests.some((ar) => ar.id === r.id))
            ];
            if (toCancel.length > 0) {
                const cancelResults = await Promise.allSettled(
                    toCancel.map((r) => {
                        const reqId = r.id.replace('req_', '');
                        return apiClient.fetch(`/order-requests/${reqId}/status`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'CANCELLED', reason: 'Cancelled by customer' })
                        });
                    })
                );
                const failures = cancelResults.filter(r => r.status === 'rejected');
                if (failures.length === 0) {
                    Alert.alert('Order Cancelled', 'Your order has been cancelled. No charges applied.');
                } else {
                    console.error(`[Cancel] ${failures.length}/${toCancel.length} cancel calls failed`, failures);
                    Alert.alert('Partial cancellation', `${toCancel.length - failures.length} of ${toCancel.length} stores cancelled. The rest will expire automatically in 2 minutes.`);
                }
            }
            forceNav.current = true;
        } catch (err) {
            console.error('[Checkout] Cancel failed:', err);
            Alert.alert('Error', 'Failed to cancel. Please try again.');
        }
    };

    usePreventRemove((step === 'results' || step === 'waiting') && !forceNav.current, (e) => {
        if (step === 'results') {
            Alert.alert(
                'Cancel Order?',
                'Your order has been approved by the restaurant. Going back will cancel this approval. You\'ll need to place a new request.',
                [
                    { text: 'Stay', style: 'cancel' },
                    { 
                        text: 'Cancel Order', 
                        style: 'destructive', 
                        onPress: async () => {
                            await executeCancelOrder();
                            navigation.dispatch(e.data.action);
                        } 
                    }
                ]
            );
        } else if (step === 'waiting') {
            // Just block it silently or show a wait message
            Alert.alert('Please Wait', 'We are waiting for the restaurant to respond.');
        }
    });

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
        
        const fetchLocations = async () => {
            const locMap: Record<string, any> = {};
            const dbQueryIds: string[] = [];

            // Pre-sort IDs: UUIDs go to DB, simple strings go straight to Mock fallback
            uniqueStoreIds.forEach(id => {
                if (id.length < 10) { // Simple heuristic: '1', '2' are not UUIDs
                    const mockStore = STORES.find(s => String(s.id) === String(id)) || RESTAURANTS.find(r => String(r.id) === String(id));
                    if (mockStore) {
                        locMap[id] = {
                            id: mockStore.id,
                            name: mockStore.name,
                            address: mockStore.address || 'Address unavailable',
                            openingTime: '09:00',
                            closingTime: '22:00'
                        };
                    }
                } else {
                    dbQueryIds.push(id);
                }
            });

            // Only query Supabase if we have valid UUIDs
            if (dbQueryIds.length > 0) {
                try {
                                    const { data, error } = await supabase
                        .from('merchant_branches')
                        .select('id, branch_name, address, city, operating_hours, prep_time_minutes, merchants(Vertical(name))')
                        .in('id', dbQueryIds);
                    
                    if (data) {
                        data.forEach((b: any) => {
                            const oh = typeof b.operating_hours === 'object' && b.operating_hours ? b.operating_hours : {};
                            const verticalName = b.merchants?.Vertical?.name || '';
                            locMap[b.id] = {
                                id: b.id,
                                name: b.branch_name,
                                address: b.address + (b.city ? `, ${b.city}` : ''),
                                openingTime: oh.open || '09:00',
                                closingTime: oh.close || '22:00',
                                prep_time: b.prep_time_minutes || 15,
                                type: verticalName
                            };
                        });
                    }
                } catch (err) {
                    console.error("Supabase fetch failed:", err);
                }
            }

            setStoreLocations(locMap);
        };
        fetchLocations();
    }, [items]);

    useEffect(() => {
        const fetchAlternatives = async () => {
            if (rejectedRequests.length === 0) return;
            const newMap = { ...alternativesMap };
            let updated = false;

            for (const req of rejectedRequests) {
                if (!newMap[req.id]) {
                    const productIds = req.items.map((i: any) => String(i.id));

                    // 1. Inventory Check: Find branches that actually stock these items
                    const { data: availableProducts } = await supabase
                        .from('StoreProduct')
                        .select('branch_id, stock, active, price, productId')
                        .eq('active', true)
                        .gt('stock', 0)
                        .neq('branch_id', req.store_id)
                        .in('productId', productIds);

                    if (availableProducts && availableProducts.length > 0) {
                        const branchMap: Record<string, any[]> = {};
                        availableProducts.forEach((sp: any) => {
                            if (sp.branch_id) {
                                if (!branchMap[sp.branch_id]) branchMap[sp.branch_id] = [];
                                const originalItem = req.items.find((i: any) => String(i.id) === String(sp.productId));
                                branchMap[sp.branch_id].push({
                                    id: sp.productId,
                                    name: originalItem?.name || 'Product',
                                    price: sp.price,
                                    quantity: originalItem?.quantity || 1
                                });
                            }
                        });

                        const candidateBranchIds = Object.keys(branchMap);

                        if (candidateBranchIds.length > 0) {
                            // 2. Fetch the branch details (Radius bounded by city if possible)
                            let altQuery = supabase
                                .from('merchant_branches')
                                .select('id, branch_name, address, city')
                                .eq('is_active', true)
                                .in('id', candidateBranchIds)
                                .limit(3);

                            // Optional radius bounds by matching the city
                            const reqCity = storeLocations[req.store_id]?.city;
                            if (reqCity) {
                                altQuery = altQuery.eq('city', reqCity);
                            }

                            const { data: altBranches } = await altQuery;

                            if (altBranches && altBranches.length > 0) {
                                newMap[req.id] = altBranches.map(alt => {
                                    const matched = branchMap[alt.id] || [];
                                    return {
                                        storeId: alt.id,
                                        storeName: alt.branch_name,
                                        distance: 'Nearby', // Mocked radius distance
                                        matchedItems: matched,
                                        isPartial: matched.length < req.items.length
                                    };
                                }).sort((a, b) => b.matchedItems.length - a.matchedItems.length);
                                updated = true;
                            } else {
                                newMap[req.id] = [];
                                updated = true;
                            }
                        } else {
                            newMap[req.id] = [];
                            updated = true;
                        }
                    } else {
                        newMap[req.id] = [];
                        updated = true;
                    }
                }
            }
            if (updated) setAlternativesMap(newMap);
        };
        fetchAlternatives();
    }, [rejectedRequests]);

    useEffect(() => {
        // Phase 4 (2026-06-09): selectedCoupon route param is now only a "wake up"
        // signal from CouponsScreen — the real applied-coupon state lives in
        // CartContext.appliedCoupon (set by CouponsScreen before navigating back).
        // We DON'T copy code/discount into local state here anymore; we render
        // directly from appliedCoupon below.
        if (route.params?.specialInstructions) {
            setSpecialInstructions(route.params.specialInstructions);
        }
    }, [route.params?.specialInstructions]);



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
    const exactGst = parseFloat(groupedStores.reduce((sum, group) => {
        // Check both branch and parent IDs to find the vertical type
        const storeInfo = storeLocations[group.branch_id] || storeLocations[group.storeId] || {};
        const type = storeInfo.type?.toLowerCase() || '';
        const isFnB = ['restaurant', 'bakery', 'cafe'].some(t => type.includes(t));
        return sum + (isFnB ? (group.total * 0.05) : 0);
    }, 0).toFixed(2));
    // Phase 4: derive discount from CartContext.appliedCoupon (single source of truth).
    const discount = appliedCoupon?.discount ?? 0;
    const total = subtotal + exactGst - discount;

    // Helpers
    const getIsVeg = (productId: string) => {
        const p = ALL_PRODUCTS.find((p: any) => String(p.id) === String(productId));
        return p?.isVeg ?? true;
    };

    const handleRemoveCoupon = () => {
        // Phase 4: clear CartContext.appliedCoupon (single source of truth).
        // Phase 4 audit re-fix (2026-06-09 evening): dropped the
        // navigation.setParams({ selectedCoupon: undefined }) call — the
        // selectedCoupon route param itself was dropped from RootStackParamList.
        clearAppliedCoupon();
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
            Alert.alert(isDiningOrder ? 'Select Arrival Time' : 'Select Pickup Time', msg);
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
                total: g.total,
                arrivalTime: selectedTime[g.storeId] || 'ASAP',
                orderType: 'pickup' as const
            })));
            setStep('waiting');
        } catch (e: any) {
            console.error('[Checkout] Order request failed:', e?.message || e);
            const msg = e?.message?.includes('offline')
                ? e.message
                : e?.message?.includes('session')
                    ? 'Your session has expired. Please sign out and sign in again.'
                    : 'Failed to submit order requests. Please try again.';
            Alert.alert('Error', msg);
        }
    };

    const handlePaymentSuccess = async (id: string, orderId?: string, signature?: string) => {
        setPaymentId(id);
        setShowPayment(false);

        try {
            // ANDROID DEMO HOTFIX (May 19, 2026, v2):
            // Razorpay WebView can evict the Supabase session, especially on Android.
            // If the cached useAuth user is null after payment, refresh + read from
            // getSession (NOT getUser — getUser hangs on GET /auth/v1/user, per supabase.ts).
            let effectiveUser: any = user;
            if (!effectiveUser) {
                try { await supabase.auth.refreshSession(); } catch (e) { console.warn('[Checkout] refreshSession failed', e); }
                const { data: { session: refreshedSession } } = await supabase.auth.getSession();
                effectiveUser = refreshedSession?.user || null;
                console.log('[Checkout] Session recovery attempt — user:', effectiveUser?.id || 'still null');
            }

            // Step 1: Verify Razorpay Signature
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

            // Step 2: Create orders via Backend API (NOT direct Supabase)
            // Use effectiveUser (cached or session-refresh recovered) — the Razorpay
            // WebView can evict the live useAuth context on Android.
            if (!effectiveUser) throw new Error('User not authenticated');

            const actualSubtotal = acceptedRequests.reduce((sum: number, r: any) => sum + r.subtotal, 0);
            const createdOrders: any[] = [];

            for (let i = 0; i < acceptedRequests.length; i++) {
                const req = acceptedRequests[i];
                const share = req.subtotal / (actualSubtotal || 1);
                const groupGst = Math.round(finalGstToPay * share);
                const groupDiscount = Math.round(discount * share);
                const groupFinalTotal = Math.max(0, req.subtotal + groupGst - groupDiscount);

                const storeIdStr = String(req.store_id);
                const storeOtp = storeOtps[storeIdStr] || Math.floor(1000 + Math.random() * 9000).toString();

                // Route through Backend API — triggers notifications, stock, and socket broadcasts.
                // The endpoint is IDEMPOTENT on paymentId, so we can safely auto-retry transient
                // failures (e.g. cold network) without risking a duplicate order or double charge.
                const orderPayload = {
                    userId: effectiveUser.id,
                    storeId: req.store_id,
                    branchId: req.branch_id,
                    totalAmount: groupFinalTotal,
                    paid: true,
                    paymentId: id,
                    orderRequestId: req.id,
                    customerName: pickupMode === 'myself'
                        ? (effectiveUser.user_metadata?.full_name || effectiveUser.email?.split('@')[0] || 'Guest')
                        : pickupName,
                    customerPhone: pickupMode === 'myself'
                        ? (effectiveUser.phone || '')
                        : pickupPhone,
                    storeName: req.store_name,
                    specialInstructions: specialInstructions,
                    arrivalTime: selectedTime[req.branch_id] || selectedTime[req.store_id] || 'ASAP',
                    otp: storeOtp,
                    items: req.items.map((item: any) => {
                        // Phase 4 audit re-fix (2026-06-09 evening): look up
                        // storeProductId from CartContext.items (durable post-C1)
                        // because req.items has storeProductId stripped by
                        // useOrderRequests.createRequests. Match by product .id.
                        const cartMatch = items.find((ci) => String(ci.id) === String(item.id));
                        const trustedStoreProductId = cartMatch?.storeProductId ?? null;
                        return {
                            name: item.name,
                            quantity: item.quantity,
                            price: item.price,
                            // Phase 4 fix C2 (2026-06-09): on coupon orders use ONLY
                            // the trusted storeProductId from CartContext (no fallback)
                            // so the server's cartHash recompute is deterministic.
                            // The D2 eligibility gate above guarantees the cart has
                            // a storeProductId match for every item on coupon orders.
                            // Non-coupon orders keep the legacy fallback path so
                            // existing stock-decrement keeps working.
                            storeProductId: appliedCoupon
                                ? trustedStoreProductId
                                : (trustedStoreProductId || item.id || null)
                        };
                    }),
                    // Phase 4 (2026-06-09): include the server-signed validation token
                    // so the server (Phase 2F) can verify the discount before applying
                    // it to this Order's snapshot columns. Only present when a coupon
                    // was applied to this cart; absent for no-coupon orders. The server
                    // accepts both shapes via the Phase 2G shim for backward compat.
                    ...(appliedCoupon ? {
                        validationToken: appliedCoupon.validationToken,
                        couponId: appliedCoupon.couponId,
                        couponCode: appliedCoupon.code,
                    } : {}),
                };

                let orderData: any = null;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    const orderRes = await apiClient.fetch(`/orders`, {
                        method: 'POST',
                        body: JSON.stringify(orderPayload)
                    });

                    if (orderRes.ok) { orderData = await orderRes.json(); break; }

                    const errBody: any = await orderRes.json().catch(() => ({}));
                    console.error(`[CheckoutScreen] order attempt ${attempt}/3 failed for ${req.store_name}:`, JSON.stringify(errBody));

                    // Store-availability errors: don't retry — surface clearly (payment will be refunded).
                    if (['STORE_OFFLINE', 'STORE_CLOSED_TODAY', 'STORE_CLOSED_HOURS', 'STORE_LUNCH_BREAK'].includes(errBody.error)) {
                        Alert.alert('Store Unavailable', errBody.message || 'This store is currently not accepting orders. Your payment will be refunded.');
                        throw new Error(errBody.message || 'Store unavailable');
                    }

                    // Retry only transient/retryable failures (idempotent on paymentId).
                    if (errBody.retryable && attempt < 3) {
                        await new Promise(r => setTimeout(r, 1200 * attempt));
                        continue;
                    }

                    // Out of retries → surface the API's friendly, money-safe message (never raw internals).
                    throw new Error(errBody.message || "We couldn't place your order. Your payment is safe — we'll reconcile or refund it automatically.");
                }

                console.log(`[CheckoutScreen] ✅ Order created via API: ${orderData.orderNumber}`);
                createdOrders.push({ ...orderData, localOtp: storeOtp });
            }

            // Step 3: Save OTPs into confirmedOrders BEFORE clearing cart
            setConfirmedOrders(acceptedRequests.map((r: any) => {
                const sid = String(r.store_id);
                const serverOrder = createdOrders.find((o: any) => String(o.storeId) === sid || String(o.store_id) === sid);
                if (!serverOrder?.otp_code && !serverOrder?.otp) {
                    console.error('[Checkout] No OTP returned from API for order', sid);
                }
                return {
                    storeId: sid,
                    storeName: r.store_name,
                    items: r.items,
                    total: r.subtotal,
                    orderNumber: serverOrder?.order_number || serverOrder?.orderNumber || 'Unknown',
                    otp: serverOrder?.otp_code || serverOrder?.otp || ''
                };
            }));
            clearCart();
        } catch (error: any) {
            // Full detail to logs only — never surface raw DB/internal errors to the customer.
            console.error('[CheckoutScreen] Failed to create order via API:', error, '| user=', user?.id ? 'present' : 'NULL');
            setErrorDiagnostic(error?.message || "We couldn't place your order. Your payment is safe — we'll reconcile or refund it automatically, and our team has been alerted.");
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
        forceNav.current = true;
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
    };

    // ==================== RENDERING LOGIC ====================

    if (step === 'error') {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center p-8">
                <XCircle size={60} color="#EF4444" className="mb-6" />
                <Text className="text-[24px] font-bold text-gray-900 text-center mb-3">Order Sync Failed</Text>
                <Text className="text-[14px] text-gray-500 text-center mb-3">
                    Your payment (ID: {paymentId}) was successful, but we encountered a network error sending your order to the restaurant.
                </Text>
                {errorDiagnostic ? (
                    <Text selectable className="text-[11px] font-mono text-red-600 text-center bg-red-50 p-3 rounded-lg mb-8">
                        {errorDiagnostic}
                    </Text>
                ) : <View className="mb-8" />}
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
                                        <Text className="text-[12px] text-gray-500 font-medium mb-0.5">Req ID: #REQ-{req.id.substring(0,4).toUpperCase()}</Text>
                                        <Text className="text-[12px] text-gray-500" numberOfLines={1}>{req.items.length} items • ₹{req.subtotal}</Text>
                                    </View>
                                    <View>
                                        {req.status === 'PENDING' && (
                                            <View className="bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                                                <Text className="text-[14px] font-bold text-orange-600">
                                                    {(() => {
                                                        const expires = parseUtc(req.expires_at).getTime();
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
        const resultGst = Math.round(acceptedRequests.reduce((sum: number, req: any) => {
            const storeInfo = storeLocations[req.branch_id] || storeLocations[req.store_id] || {};
            const type = storeInfo.type?.toLowerCase() || '';
            const isFnB = ['restaurant', 'bakery', 'cafe'].some(t => type.includes(t));
            return sum + (isFnB ? (req.subtotal * 0.05) : 0);
        }, 0));
        // Phase 4: derived discount from CartContext.appliedCoupon (single source of truth).
        const resultTotal = Math.max(0, resultSubtotal + resultGst - (appliedCoupon?.discount ?? 0));

        // Pending swap requests — show as "in progress"
        const pendingSwaps = requests.filter(r => r.status === 'PENDING');

        const confirmAccepted = async () => {
            if (acceptedRequests.length === 0) { navigation.goBack(); return; }
            // Phase 4 fixes D2 + A2 (2026-06-09): eligibility gate at the TOP
            // of confirmAccepted — runs UNCONDITIONALLY for every coupon order,
            // not only inside the near-expiry branch. Catches: (a) cart drift
            // (items missing storeProductId after Supabase reload), and (b)
            // multi-store coupon orders (rejected until Phase 5 ships allocation).
            // If the order is ineligible, drop the coupon and abort — user
            // re-taps Pay to retry without the coupon at the updated total.
            //
            // Phase 4 audit re-fix (2026-06-09 evening): source storeProductId
            // from CartContext.items (durable post-C1), not from
            // acceptedRequests[].items where useOrderRequests.createRequests
            // strips the field. Match by product id (cart item .id == order
            // request item .id, both come from the same upstream feed).
            if (appliedCoupon) {
                const cartItemsByProductId = new Map(
                    items.map((ci) => [String(ci.id), ci])
                );
                const orderItemsFlat = acceptedRequests.flatMap((req: any) =>
                    (req.items || []).map((it: any) => {
                        const cartMatch = cartItemsByProductId.get(String(it.id));
                        return {
                            storeProductId: cartMatch?.storeProductId ?? null,
                            storeId: req.store_id,
                        };
                    })
                );
                const elig = checkCouponOrderEligibility(orderItemsFlat, appliedCoupon);
                if (!elig.ok) {
                    clearAppliedCoupon();
                    Alert.alert('Coupon removed', elig.reason!);
                    return;
                }
            }
            // Phase 4: removed legacy AVAILABLE_COUPONS minOrder check — the
            // server's /checkout/validate-coupon (Phase 2L) now enforces minOrder
            // against the server-trusted cart total. If a customer's cart drops
            // below minOrder after applying, the next interaction with the cart
            // auto-clears appliedCoupon (see CartContext.tsx Phase 4 changes),
            // so no client-side mirror check is needed.
            //
            // Phase 4H (2026-06-09): if the coupon token is within 60s of expiry,
            // re-validate before the Razorpay payment order is created. Prevents
            // the customer being charged the full amount and then the server (Phase
            // 2F) rejecting the stale token. On re-validate failure, the coupon is
            // dropped and the customer is informed BEFORE payment is initiated.
            let effectiveDiscount = appliedCoupon?.discount ?? 0;
            if (appliedCoupon && appliedCoupon.expiresAt - 60 < Math.floor(Date.now() / 1000)) {
                const itemsWithProductId = items.every((ci) => !!ci.storeProductId);
                if (!itemsWithProductId) {
                    // Cart has legacy items lacking storeProductId — can't safely
                    // re-validate. Drop the coupon defensively.
                    clearAppliedCoupon();
                    effectiveDiscount = 0;
                    Alert.alert(
                        'Coupon removed',
                        'Your cart was updated. Proceeding without the discount.'
                    );
                } else {
                    const reValidatePayload: ValidateCouponCartItem[] = items.map((ci) => ({
                        storeProductId: String(ci.storeProductId),
                        quantity: ci.quantity,
                        price: ci.price,
                        id: ci.id,
                        name: ci.name,
                    }));
                    const reValidateStoreIds = Array.from(new Set(items.map((ci) => String(ci.storeId))));
                    const reValidate = await validateCoupon({
                        code: appliedCoupon.code,
                        cartItems: reValidatePayload,
                        storeIds: reValidateStoreIds,
                        orderType: 'pickup',
                    });
                    if (!reValidate.valid) {
                        clearAppliedCoupon();
                        effectiveDiscount = 0;
                        Alert.alert(
                            'Coupon expired',
                            `${reValidate.error} Proceeding without the discount.`
                        );
                    } else {
                        // Refresh CartContext with the new server-signed token.
                        setAppliedCoupon({
                            code: reValidate.code,
                            couponId: reValidate.couponId,
                            discount: reValidate.discount,
                            fundingSource: reValidate.fundingSource,
                            discountType: reValidate.discountType,
                            validationToken: reValidate.validationToken,
                            expiresAt: reValidate.expiresAt,
                            cartHash: '',
                        });
                        effectiveDiscount = reValidate.discount;
                    }
                }
            }
            const newTotal = Math.max(0, resultSubtotal + resultGst - effectiveDiscount);
            setFinalTotalToPay(newTotal);
            setFinalGstToPay(resultGst);

            try {
                // Fetch the API URL from process.env
                const apiUrl = process.env.EXPO_PUBLIC_API_URL;
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
            const newStoreGroup = { storeId: alt.storeId, storeName: alt.storeName, items: newReqItems, total: newTotal, arrivalTime: selectedTime[alt.storeId] || selectedTime[String(req.store_id)] || 'ASAP', orderType: 'pickup' as const };
            setStoreOtps(prev => ({ ...prev, [alt.storeId]: Math.floor(1000 + Math.random() * 9000).toString() }));
            const reqStoreId = String(req.store_id);
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
                                const storeIdStr = String(req.store_id);
                                return (
                                    <View key={req.id} className="bg-white p-5 rounded-2xl mb-3 border border-green-200 shadow-sm">
                                        <View className="flex-row items-center mb-3">
                                            <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mr-3">
                                                <CheckCircle size={18} color="#16A34A" />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="font-extrabold text-gray-900 text-[16px] mb-1">{req.store_name}</Text>
                                                <Text className="text-[12px] text-gray-600 font-medium mb-0.5">Order ID: #REQ-{req.id.substring(0,4).toUpperCase()}</Text>
                                                <Text className="text-[12px] text-gray-600 font-medium mb-0.5">{isDiningOrder ? 'Arrival' : 'Pickup'} Time: {selectedTime[req.branch_id] || selectedTime[req.store_id] || selectedTime[storeIdStr] || 'ASAP'}</Text>
                                                <Text className="text-[12px] text-gray-600 font-medium">Location: {storeLocations[req.branch_id]?.address || storeLocations[req.store_id]?.address || 'Store Location'}</Text>
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
                                const alternatives = alternativesMap[req.id] || [];
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
                                                            <Text className="text-gray-400 text-[11px]">
                                                                {alt.distance} away {alt.isPartial ? '• Partial Match' : ''}
                                                            </Text>
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
                            {resultGst > 0 && (
                                <View className="flex-row justify-between mb-2"><Text className="text-[13px] text-gray-500 font-medium">GST (5%)</Text><Text className="text-[13px] text-gray-900 font-bold">₹{resultGst}</Text></View>
                            )}
                            {appliedCoupon && <View className="flex-row justify-between mb-2"><Text className="text-[13px] text-green-600 font-bold">Discount</Text><Text className="text-[13px] text-green-600 font-bold">-₹{appliedCoupon.discount}</Text></View>}
                            <View className="border-t border-gray-200 my-2" />
                            <View className="flex-row justify-between"><Text className="text-[15px] text-gray-900 font-extrabold">Total</Text><Text className="text-[18px] text-gray-900 font-extrabold">₹{resultTotal}</Text></View>
                        </View>
                    )}
                </ScrollView>

                {/* Bottom CTA */}
                <View className="px-5 bg-white border-t border-gray-100 pt-4 pb-[90px]">
                    {acceptedRequests.length > 0 && pendingSwaps.length === 0 ? (
                        <View className="flex-row items-center justify-between">
                            <TouchableOpacity onPress={() => navigation.goBack()} className="w-[30%] bg-[#DC2626] rounded-[20px] items-center justify-center" style={{ height: 60 }}>
                                <Text className="text-[15px] font-bold text-white text-center">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={confirmAccepted} className="w-[67%] bg-[#212121] rounded-[20px] items-center justify-between flex-row px-6" style={{ height: 60 }}>
                                <Text className="text-[16px] font-bold text-white">Proceed to Pay</Text>
                                <Text className="text-[16px] font-bold text-white">₹{resultTotal}</Text>
                            </TouchableOpacity>
                        </View>
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
                <RazorpayCheckout visible={showPayment} onClose={() => setShowPayment(false)} onSuccess={handlePaymentSuccess} onError={handlePaymentError} amount={finalTotalToPay} restaurantName={storeNamesList} orderId={razorpayOrderId} />
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
                            {isDiningOrder
                                ? 'Show the OTP at the restaurant when you arrive. Your table and food will be ready!'
                                : 'Show the OTP at the store when you arrive to collect your order.'
                            }
                        </Text>
                    </View>

                    {/* OTP Cards */}
                    <View className="px-5 mt-6">
                        <Text className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wider mb-4 px-1">{isDiningOrder ? 'Your Dining Codes' : 'Your Pickup Codes'}</Text>
                        {confirmedOrders.map((group, idx) => (
                            <View key={group.storeId} className="bg-white rounded-2xl mb-4 border border-gray-200 shadow-sm overflow-hidden">
                                {/* Store Header */}
                                <View className="flex-row items-center px-5 pt-4 pb-3">
                                    <View className="w-8 h-8 bg-[#B52725] rounded-full items-center justify-center mr-3">
                                        <Text className="text-white text-[13px] font-bold">{idx + 1}</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[15px] font-extrabold text-gray-900">{group.storeName}</Text>
                                        <Text className="text-[11px] text-gray-400 font-medium mt-0.5">Order #{group.orderNumber}</Text>
                                    </View>
                                </View>

                                {/* Order Details Block */}
                                <View className="px-5 mb-4">
                                    {group.items && group.items.map((item: any, iIdx: number) => (
                                        <View key={iIdx} className="flex-row items-center mb-2">
                                            <View className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-3" />
                                            <Text className="text-[14px] text-gray-700 font-medium flex-1">{item.quantity}x {item.name}</Text>
                                            <Text className="text-[14px] text-gray-900 font-semibold">₹{item.price * item.quantity}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* OTP Display */}
                                <View className="mx-5 mb-4 bg-gray-50 rounded-xl p-4 items-center border border-gray-100">
                                    <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{isDiningOrder ? 'Dining OTP' : 'Pickup OTP'}</Text>
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
                    <Text className="text-[12px] font-extrabold text-[#B52725] uppercase tracking-wider">{isDiningOrder ? 'Restaurant' : 'Pickup Locations'}</Text>
                </View>

                {groupedStores.map((group, idx) => {
                    const storeData = storeLocations[group.storeId];
                    return (
                        <View key={group.storeId} className="mx-5 mb-4 bg-white rounded-[20px] border border-gray-100 p-5 shadow-sm">
                            <View className="flex-row items-center mb-4">
                                <Text className="text-[17px] font-extrabold text-[#111827] leading-tight flex-1">{group.storeName}</Text>
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
                                    <Text className="text-[14px] font-bold text-gray-900 ml-3 flex-1" numberOfLines={1}>{selectedTime[group.storeId] || (isDiningOrder ? 'Select Arrival Time' : 'Select Pickup Time')}</Text>
                                </View>
                                <TouchableOpacity onPress={() => { setActiveStoreForTime(group.storeId); setIsTimeModalVisible(true); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Text className="text-[13px] font-bold text-gray-900 underline">Change</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}

                <View className="px-5 mt-4 mb-3">
                    <Text className="text-[12px] font-extrabold text-[#B52725] uppercase tracking-wider">{isDiningOrder ? 'Dining reservation for' : 'Picking up for'}</Text>
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
                                <TextInput className="flex-1 ml-3 text-[15px] font-bold text-[#111827]" placeholder="Enter Name" value={pickupName} onChangeText={setPickupName} placeholderTextColor="#9CA3AF" style={{ textAlignVertical: 'center', paddingVertical: 0, includeFontPadding: false }} />
                            </View>
                            <View className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3.5 mt-3 bg-gray-50/50">
                                <View className="flex-row items-center flex-1">
                                    <Text className="text-[15px] font-bold text-gray-500 mr-2">+91</Text>
                                    <TextInput className="flex-1 text-[15px] font-bold text-[#111827]" placeholder="Mobile Number" value={pickupPhone.replace('+91', '').trim()} onChangeText={(t) => setPickupPhone('+91 ' + t)} keyboardType="phone-pad" placeholderTextColor="#9CA3AF" style={{ textAlignVertical: 'center', paddingVertical: 0, includeFontPadding: false }} />
                                </View>
                                <TouchableOpacity className="bg-white border border-gray-200 p-2 rounded-lg shadow-sm" onPress={selectContact}><Search size={16} color="#4B5563" /></TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Phase 4 fix B1 (2026-06-09): Apply Coupon entry-point row.
                    Re-fixed 2026-06-09 evening: (a) restructured so the Remove
                    button is a SIBLING of the navigate-to-Coupons row, not a
                    nested TouchableOpacity (the prior nested pattern could
                    intermittently fire both handlers — coupon cleared AND
                    CouponsScreen opened); (b) disabled the row when the cart
                    is multi-store, since A2's eligibility check would reject
                    a coupon order at confirmAccepted anyway (silent UX trap). */}
                <View className="mx-5 mt-4 mb-3 flex-row items-center bg-white border border-gray-100 rounded-2xl p-4">
                    <TouchableOpacity
                        onPress={() => {
                            if (groupedStores.length > 1) return; // disabled multi-store
                            navigation.navigate('Coupons' as any, {
                                subtotal,
                                storeId: groupedStores[0]?.storeId || '',
                                appliedCouponId: appliedCoupon?.couponId,
                                returnTo: 'Checkout',
                            });
                        }}
                        disabled={groupedStores.length > 1}
                        activeOpacity={groupedStores.length > 1 ? 1 : 0.7}
                        className="flex-1 flex-row items-center"
                    >
                        <Ticket size={20} color={groupedStores.length > 1 ? '#9CA3AF' : '#B52725'} />
                        <View className="flex-1 ml-3">
                            <Text className={`text-[14px] font-bold ${groupedStores.length > 1 ? 'text-gray-400' : 'text-gray-900'}`}>
                                {groupedStores.length > 1
                                    ? 'Coupons (multi-store cart)'
                                    : appliedCoupon ? `${appliedCoupon.code} applied` : 'Apply Coupon'}
                            </Text>
                            {groupedStores.length > 1 ? (
                                <Text className="text-[12px] text-gray-400 font-medium mt-0.5">
                                    Single-store carts only for now
                                </Text>
                            ) : appliedCoupon ? (
                                <Text className="text-[12px] text-green-600 font-semibold mt-0.5">
                                    You saved ₹{appliedCoupon.discount.toFixed(2)} · Tap to change
                                </Text>
                            ) : (
                                <Text className="text-[12px] text-gray-500 font-medium mt-0.5">
                                    Browse offers or enter a code
                                </Text>
                            )}
                        </View>
                        {appliedCoupon && groupedStores.length === 1 ? null : groupedStores.length === 1 ? (
                            <ChevronRight size={18} color="#B52725" />
                        ) : null}
                    </TouchableOpacity>
                    {appliedCoupon && (
                        <TouchableOpacity
                            onPress={handleRemoveCoupon}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            className="ml-2 px-3 py-1.5 rounded-full bg-gray-100"
                        >
                            <Text className="text-[12px] font-bold text-gray-700">Remove</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View className="px-5 mt-4 mb-3"><Text className="text-[12px] font-extrabold text-[#B52725] uppercase tracking-wider">Bill Details</Text></View>
                <View className="mx-5 mb-20 bg-white rounded-2xl border border-gray-100 p-5">
                    <View className="flex-row justify-between mb-2.5"><Text className="text-[13px] text-gray-500 font-semibold">Item Total</Text><Text className="text-[13px] text-gray-900 font-bold">₹{subtotal}</Text></View>
                    {exactGst > 0 && (
                        <View className="flex-row justify-between mb-2.5"><Text className="text-[13px] text-gray-500 font-semibold">GST (5%)</Text><Text className="text-[13px] text-gray-900 font-bold">₹{exactGst.toFixed(2)}</Text></View>
                    )}
                    {appliedCoupon && <View className="flex-row justify-between mb-2.5"><Text className="text-[13px] text-green-600 font-bold">Offer Discount</Text><Text className="text-[13px] text-green-600 font-bold">−₹{discount.toFixed(2)}</Text></View>}
                    <View className="border-t border-gray-100 my-3" />
                    <View className="flex-row justify-between items-center"><Text className="text-[15px] text-gray-900 font-bold">To Pay</Text><Text className="text-[18px] text-gray-900 font-bold">₹{total.toFixed(2)}</Text></View>
                </View>
            </ScrollView>

            {/* Bottom CTA — sits below ScrollView in flex layout, pb clears the absolute tab bar */}
            <View className="px-4 bg-white border-t border-gray-50 pt-4 pb-[100px]">
                <TouchableOpacity onPress={handlePayConfirm} disabled={loading} className={`w-full rounded-[20px] items-center justify-between flex-row px-6 ${loading ? 'bg-gray-400' : 'bg-[#212121]'}`} style={{ height: 60 }}>
                    <Text className="text-[16px] font-bold text-white">{loading ? 'Processing...' : 'Place Order'}</Text>
                    {!loading && <Text className="text-[16px] font-bold text-white">₹{total.toFixed(2)}</Text>}
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
                                style={{ textAlignVertical: 'center', paddingVertical: 0, includeFontPadding: false }}
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
                        <Text className="text-[18px] font-extrabold text-gray-900 text-center mb-6">{isDiningOrder ? 'Select Arrival Time' : 'Select Pickup Time'}</Text>
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

            <RazorpayCheckout visible={showPayment} onClose={() => setShowPayment(false)} onSuccess={handlePaymentSuccess} onError={handlePaymentError} amount={finalTotalToPay} restaurantName={storeNamesList} orderId={razorpayOrderId} />
        </SafeAreaView>
    );
}
