// @lock — DO NOT EDIT WITHOUT EXPLICIT USER PERMISSION.
// Dining Checkout — multiple approved layers (cumulative, latest 2026-06-09):
//   1. Sticky header/CTA, non-absolute bottom button, Android time picker dismiss
//      handling, iOS-only spinner guard (original layout fix).
//   2. handlePaymentSuccess session-recovery: refreshSession before reading
//      getSession to defeat Razorpay WebView session eviction.
//   3. apiClient.fetch migration for /order-requests/{id}/status PATCH and /orders POST
//      (approved 2026-06-08, Option A patch #1 — adds Authorization Bearer header
//      without changing the session-recovery semantics from layer #2; the recovered
//      user id from refreshSession + getSession is preserved byte-for-byte and is
//      still the user id passed in the body).
//   4. executeCancelOrder multi-store loop (approved 2026-06-08, Option A patch
//      #6 — replaces single-request cancel with Promise.allSettled over ALL
//      acceptedRequests + PENDING requests so stores B..N are not left ACCEPTED
//      until cron expiry. Does not touch handlePaymentSuccess, session-recovery,
//      or the apiClient migration from layer 3).
//   5. parseUtc timezone-parsing fix (approved 2026-06-08, Option A task #45 —
//      swaps two bare new Date(req.expires_at/created_at) calls for parseUtc
//      from utils/dateFormat.ts, matching CheckoutScreen.tsx and defending
//      against any JSON pipeline that strips the Z suffix. Does not touch
//      executeCancelOrder, handlePaymentSuccess, session-recovery, or imports
//      other than adding parseUtc.)
//   6. Phase 4 coupon-foolproof integration approved 2026-06-09. Reads
//      appliedCoupon from CartContext (single source of truth for the server-signed
//      validation token + signed discount). Sends validationToken + couponId +
//      couponCode in the POST /orders body so the server (Phase 2F) can verify
//      the token before applying the discount snapshot. Local couponCode /
//      couponApplied / couponDiscount state removed — CartContext.appliedCoupon
//      is authoritative. On the proceed-to-pay step we synchronously re-validate
//      the coupon if its token expires within 60s (closes the "stale token sent
//      to server" bleed); on failure we clear the coupon and alert the user.
//      Live countdown UI on the banner deferred to a follow-up styling pass.
//      Does NOT touch session-recovery (layer 2), apiClient.fetch URL paths
//      (layer 3), executeCancelOrder (layer 4), or parseUtc (layer 5).
// Any modification to the checkout flow or session handling REQUIRES the user's
// explicit chat-confirmed approval. Hard lock.
// Dining Pre-order Checkout: Restaurant info → Arrival details → Order summary → Pay & Confirm.
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    Platform, Alert, BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeftCircle, ChevronDown, ChevronRight, CheckCircle, XCircle, Activity,
    Plus, Minus,
    MapPin, Clock, User, Ticket,
} from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp, CommonActions, usePreventRemove } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCart } from '../context/CartContext';
import { useOrderRequests } from '../hooks/useOrderRequests';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { apiClient, validateCoupon, checkCouponOrderEligibility, type ValidateCouponCartItem } from '../lib/api';
import TransactionalAuthModal from '../components/TransactionalAuthModal';
import RazorpayCheckout from '../components/RazorpayCheckout';
import { parseUtc } from '../utils/dateFormat';

const GUEST_OPTIONS = Array.from({ length: 10 }, (_, i) => `${i + 1} ${i === 0 ? 'Person' : 'People'}`);

const generateArrivalSlots = (openingTime?: string, closingTime?: string, prepTimeMinutes?: number, operatingDays?: number[]): string[] => {
    const slots: string[] = [];
    const now = new Date();
    const effectivePrepTime = prepTimeMinutes || 15;
    
    // Check if today is an operating day
    if (operatingDays && Array.isArray(operatingDays)) {
        const jsDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const ohDay = jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Mon, 6=Sun
        if (!operatingDays.includes(ohDay)) {
            return ['Restaurant closed today'];
        }
    }

    const nowPlusPrepMinutes = now.getHours() * 60 + now.getMinutes() + effectivePrepTime;

    // Parse opening time (format: "HH:mm")
    let openHour = 0;
    let openMinute = 0;
    if (openingTime) {
        const [h, m] = openingTime.split(':').map(Number);
        if (!isNaN(h)) { openHour = h; openMinute = m || 0; }
    }
    const openingMinutes = openHour * 60 + openMinute;

    // Parse closing time (format: "HH:mm")
    let endHour = 22;
    let endMinute = 0;
    if (closingTime) {
        const [h, m] = closingTime.split(':').map(Number);
        if (!isNaN(h)) { endHour = h; endMinute = m || 0; }
    }
    const closingMinutes = endHour * 60 + endMinute;

    // Only offer specific hourly slots for dining reservations, no 'Now (ASAP)'

    // Generate hourly slots: start from max(now+1h, opening hour) until closing
    const earliestSlotHour = Math.max(now.getHours() + 1, openHour);
    for (let h = earliestSlotHour; h <= endHour; h++) {
        const slotMinutes = h * 60;
        // Skip slots before opening time
        if (slotMinutes < openingMinutes) continue;
        // Skip slots where prep time would exceed closing
        if ((slotMinutes + effectivePrepTime) > closingMinutes && h < endHour) continue;
        if (h > endHour) break;
        if (h === endHour && endMinute === 0) break;

        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        slots.push(`Today, ${h12}:00 ${period}`);
    }

    if (slots.length === 0) {
        slots.push('No available slots today');
    }
    return slots;
};

export default function DiningCheckoutScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'DiningCheckout'>>();
    // Phase 4 (2026-06-09): appliedCoupon + setAppliedCoupon + clearAppliedCoupon
    // for coupon state. clearCart auto-clears appliedCoupon too (see CartContext.tsx).
    // setAppliedCoupon is used by the proceed-to-pay re-validate path (Phase 4H).
    const { items, getTotal, clearCart, appliedCoupon, setAppliedCoupon, clearAppliedCoupon } = useCart();
    const { requests, allResolved, acceptedRequests, rejectedRequests, createRequests, loading } = useOrderRequests();

    const [step, setStep] = useState<'form' | 'waiting' | 'results' | 'confirmed' | 'error'>('form');
    const [nowTimer, setNowTimer] = useState(Date.now());
    const [developerMode, setDeveloperMode] = useState(false);
    const [finalTotalToPay, setFinalTotalToPay] = useState(0);

    const getDefaultTime = () => {
        const t = new Date();
        t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15 + 30); // 30m global prep time buffer
        return t;
    };
    
    const [guestCount, setGuestCount] = useState(1);
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(getDefaultTime());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [razorpayOrderId, setRazorpayOrderId] = useState<string | undefined>();
    const [confirmedOtp, setConfirmedOtp] = useState('');
    const [confirmedOrderNumber, setConfirmedOrderNumber] = useState('');
    // Phase 4 (2026-06-09): legacy couponApplied/couponDiscount/couponCode local
    // state removed. CartContext.appliedCoupon is authoritative.
    const [confirmedOrderData, setConfirmedOrderData] = useState<{
        restaurantName: string;
        items: any[];
        subtotal: number;
        gstAmount: number;
        totalAmount: number;
        orderNumber: string;
        otp: string;
    } | null>(null);

    // Get restaurant info from cart items
    const restaurantId = items.length > 0 ? String(items[0].storeId) : null;
    const restaurantName = items.length > 0 ? items[0].storeName : 'Restaurant';

    // Fetch actual branch data from Supabase
    const [branchData, setBranchData] = useState<{ address?: string; operating_hours?: any; prep_time_minutes?: number } | null>(null);
    const [branchLoading, setBranchLoading] = useState(false);

    useEffect(() => {
        if (!restaurantId) return;
        setBranchLoading(true);
        (async () => {
            try {
                const { data } = await supabase
                    .from('merchant_branches')
                    .select('address, operating_hours, prep_time_minutes')
                    .eq('id', restaurantId)
                    .single();
                if (data) setBranchData(data);
            } catch (err) {
                console.error('[DiningCheckout] Branch fetch error:', err);
            } finally {
                setBranchLoading(false);
            }
        })();
    }, [restaurantId]);

    const restaurantAddress = branchData?.address || '';
    const openingTime = branchData?.operating_hours?.open || null;
    const closingTime = branchData?.operating_hours?.close || null;
    const operatingDays = branchData?.operating_hours?.days || null;
    const prepTimeMinutes = 30; // Global dine-in default

    const handleDonePicker = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        let finalDate = tempDate;
        let finalTime = tempTime;

        // 1. Operating Hours Validation
        if (showTimePicker && openingTime && closingTime) {
            const [openH, openM] = openingTime.split(':').map(Number);
            const [closeH, closeM] = closingTime.split(':').map(Number);
            const selH = tempTime.getHours();
            const selM = tempTime.getMinutes();
            
            if (!isNaN(openH) && !isNaN(closeH)) {
                const selTotal = selH * 60 + selM;
                const openTotal = openH * 60 + openM;
                const closeTotal = closeH * 60 + closeM;
                
                const formatDisplayTime = (h: number, m: number) => {
                    const period = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
                };

                let isValid = false;
                if (closeTotal >= openTotal) {
                    isValid = selTotal >= openTotal && selTotal <= closeTotal;
                } else {
                    // Crosses midnight
                    isValid = selTotal >= openTotal || selTotal <= closeTotal;
                }

                if (!isValid) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert('Store Closed', `The restaurant operates from ${formatDisplayTime(openH, openM)} to ${formatDisplayTime(closeH, closeM)}. Please select a valid time.`);
                    return; // Abort save
                }
            }
        }

        // 2. Strict "No Time Travel" Validation (Minimum 30 mins)
        const now = new Date();
        const isToday = (showDatePicker ? tempDate : date).toDateString() === now.toDateString();
        
        if (showTimePicker && isToday) {
            const selectedTimeToday = new Date(now);
            selectedTimeToday.setHours(tempTime.getHours(), tempTime.getMinutes(), 0, 0);
            
            // Require at least 30 mins buffer
            if (selectedTimeToday.getTime() < now.getTime() + 29 * 60000) { 
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert('Invalid Time', 'All dine-in bookings require a minimum 30-minute preparation time.');
                finalTime = getDefaultTime(); // Snap to future
            }
        }

        if (showDatePicker) setDate(finalDate);
        if (showTimePicker) setTime(finalTime);
        setShowDatePicker(false);
        setShowTimePicker(false);
    };

    const arrivalSlots = useMemo(() => generateArrivalSlots(openingTime, closingTime, prepTimeMinutes, operatingDays), [openingTime, closingTime, prepTimeMinutes, operatingDays]);

    // Phase 4 (2026-06-09): coupon route-param sync removed. Applied coupon
    // state now lives in CartContext (set by CouponsScreen via setAppliedCoupon
    // before navigating back here). This screen reads appliedCoupon directly.

    const forceNav = useRef(false);

    // Handle cancellation via API
    const executeCancelOrder = async () => {
        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            const toCancel = [
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
            console.error('[DiningCheckout] Cancel failed:', err);
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

    // Date Time Helpers
    const [tempDate, setTempDate] = useState(date);
    const [tempTime, setTempTime] = useState(time);

    const formatDate = (dateObj: Date) => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (dateObj.toDateString() === today.toDateString()) return 'Today';
        if (dateObj.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatTime = (timeObj: Date) => {
        return timeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        // Android: native dialog auto-closes on any action, always reset state
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) {
                setDate(selectedDate);
            }
            return;
        }
        // iOS: inline spinner, update temp value for Cancel/Done toolbar
        if (selectedDate) {
            setTempDate(selectedDate);
        }
    };

    const onTimeChange = (event: any, selectedTime?: Date) => {
        // Android: native dialog auto-closes on any action, always reset state
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
            if (event.type === 'set' && selectedTime) {
                setTime(selectedTime);
            }
            return;
        }
        // iOS: inline spinner, update temp value for Cancel/Done toolbar
        if (selectedTime) {
            setTempTime(selectedTime);
        }
    };

    const handleCancelPicker = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTempDate(date);
        setTempTime(time);
        setShowDatePicker(false);
        setShowTimePicker(false);
    };

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    const combinedArrivalTime = `${formatDate(date)}, ${formatTime(time)}`;

    // Calculations
    const subtotal = getTotal();
    const exactGst = parseFloat((subtotal * 0.05).toFixed(2));
    // Phase 4: derived from CartContext.appliedCoupon (single source of truth).
    const discount = appliedCoupon?.discount ?? 0;
    const total = subtotal + exactGst - discount;

    const getIsVeg = (productId: string) => {
        const item = items.find(i => String(i.id) === productId);
        return item ? item.isVeg : true;
    };

    const handleRequestOrder = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await createRequests([{
                storeId: restaurantId!,
                storeName: restaurantName,
                items: items,
                total: subtotal,
                arrivalTime: combinedArrivalTime,
                orderType: 'dine-in' as const,
                guestsCount: guestCount
            }]);
            setStep('waiting');
        } catch (e: any) {
            console.error('[DiningCheckout] Request booking failed:', e);
            const msg = e?.message || String(e) || 'Unknown error';
            Alert.alert('Booking Failed', msg.length > 300 ? msg.substring(0, 300) + '...' : msg);
        }
    };

    const confirmAccepted = async () => {
        console.log('[DiningCheckout] confirmAccepted called. acceptedRequests:', acceptedRequests.length, 'total:', total);
        if (acceptedRequests.length === 0) {
            console.log('[DiningCheckout] No accepted requests, going back');
            navigation.goBack(); return;
        }

        // Phase 4 fixes D2 + A2 (2026-06-09): eligibility gate at TOP of
        // confirmAccepted. For dining the multi-store check is structurally
        // always single-store (one restaurant), but the storeProductId presence
        // check is the load-bearing invariant — Supabase reload mid-session can
        // wipe storeProductId. Run unconditionally for every coupon order, not
        // only inside the near-expiry branch below.
        if (appliedCoupon) {
            const orderItemsFlat = items.map((ci) => ({
                storeProductId: ci.storeProductId ?? null,
                storeId: ci.storeId,
            }));
            const elig = checkCouponOrderEligibility(orderItemsFlat, appliedCoupon);
            if (!elig.ok) {
                clearAppliedCoupon();
                Alert.alert('Coupon removed', elig.reason!);
                return;
            }
        }

        // Phase 4H (2026-06-09): re-validate coupon if token is within 60s of
        // expiry, BEFORE the Razorpay payment order is created. Closes the
        // "stale token charged then rejected" bleed. On re-validate failure
        // (expired / no longer eligible / cart drift), drop the coupon and
        // alert the user BEFORE payment is initiated.
        let effectiveDiscount = appliedCoupon?.discount ?? 0;
        if (appliedCoupon && appliedCoupon.expiresAt - 60 < Math.floor(Date.now() / 1000)) {
            const itemsWithProductId = items.every((ci) => !!ci.storeProductId);
            if (!itemsWithProductId) {
                clearAppliedCoupon();
                effectiveDiscount = 0;
                Alert.alert('Coupon removed', 'Your cart was updated. Proceeding without the discount.');
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
                    orderType: 'dining',
                });
                if (!reValidate.valid) {
                    clearAppliedCoupon();
                    effectiveDiscount = 0;
                    Alert.alert('Coupon expired', `${reValidate.error} Proceeding without the discount.`);
                } else {
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
        const effectiveTotal = Math.max(0, subtotal + exactGst - effectiveDiscount);
        setFinalTotalToPay(effectiveTotal);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            // Phase 4 fix A1 (2026-06-09): charge the re-validated effectiveTotal,
            // not the pre-re-validate `total`. Phase 4H may have just dropped/refreshed
            // the discount in the lines above; using stale `total` would mis-charge.
            console.log('[DiningCheckout] API URL:', apiUrl, 'amount:', effectiveTotal);
            // Use getSession() — supabase.auth.getUser() hangs on this project (see supabase.ts:43-54)
            const { data: { session: authSession } } = await supabase.auth.getSession();
            const user = authSession?.user;
            console.log('[DiningCheckout] User:', user?.id);
            const res = await fetch(`${apiUrl}/payments/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: effectiveTotal, type: 'consumer', userId: user?.id })
            });
            console.log('[DiningCheckout] Response status:', res.status);
            const data = await res.json();
            console.log('[DiningCheckout] Response data:', JSON.stringify(data));
            if (data.order_id) {
                setRazorpayOrderId(data.order_id);
                setShowPayment(true);
                console.log('[DiningCheckout] Razorpay opened with order:', data.order_id);
            } else {
                console.log('[DiningCheckout] No order_id in response');
                Alert.alert('Payment Error', 'Failed to initialize secure payment.');
            }
        } catch (err: any) {
            console.error('[DiningCheckout] Create order error:', err?.message || err);
            Alert.alert('Error', 'Could not connect to payment server.');
        }
    };

    const handlePaymentSuccess = async (id: string, orderId?: string, signature?: string) => {
        setPaymentId(id);
        setShowPayment(false);

        // Capture all cart/booking data into local variables IMMEDIATELY
        // to prevent stale state issues during async operations
        const localItems = [...items];
        const localRestaurantName = restaurantName;
        const localSubtotal = subtotal;
        const localGst = exactGst;
        // Phase 4 audit re-fix (2026-06-09 evening): use finalTotalToPay
        // unconditionally — handlePaymentSuccess only fires after Razorpay
        // returns, which means confirmAccepted has already called
        // setFinalTotalToPay(effectiveTotal). The `|| total` fallback would
        // silently record the pre-discount amount in Order.totalAmount for
        // a free-coupon dining order (data integrity bleed).
        const localTotal = finalTotalToPay;
        const localGuestCount = guestCount;

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

            // ANDROID DEMO HOTFIX (May 19, 2026): refresh the Supabase session first
            // in case the Razorpay WebView evicted it. Then read user from session.
            try { await supabase.auth.refreshSession(); } catch (e) { console.warn('[DiningCheckout] refreshSession failed', e); }
            // IMPORTANT: Do NOT call supabase.auth.getUser() — it hits GET /auth/v1/user
            // which is known to hang on this project (see supabase.ts:43-54). Use
            // getSession() instead and read user from the session object.
            const { data: { session: authSession } } = await supabase.auth.getSession();
            const user = authSession?.user;
            if (!user) {
                console.error('[DiningCheckout] No auth session during payment success');
                Alert.alert('Session Issue', 'Your payment succeeded but we could not link it to your account. Please contact support with this Payment ID: ' + id);
                setStep('error');
                return;
            }
            {
                const otp = Math.floor(1000 + Math.random() * 9000).toString();

                // Create order via API instead of direct Supabase insert
                // Pull the correct store_id and branch_id from the accepted order_request
                // (don't trust restaurantId from cart items — that's the branch UUID)
                const acceptedReq: any = acceptedRequests[0];
                const correctStoreId = acceptedReq?.store_id || String(restaurantId);
                const correctBranchId = acceptedReq?.branch_id || String(restaurantId);

                const orderPayload = {
                    userId: user.id,
                    storeId: correctStoreId,
                    branchId: correctBranchId,
                    items: items.map(item => ({
                        // Phase 4 fix C2 (2026-06-09): the previous `?? item.id ?? null`
                        // fallback silently substituted an identifier that may not be a
                        // real StoreProduct.id — once REQUIRE_COUPON_TOKEN=true, that
                        // would break cartHash recompute after payment.
                        //
                        // Strict policy:
                        //   - coupon order: use ONLY item.storeProductId; null if missing
                        //     (Fix D2's invariant check at confirmAccepted entry guarantees
                        //     we never get here without storeProductId on coupon orders);
                        //   - non-coupon order: keep the legacy item.id fallback so the
                        //     server's stock-decrement (filters on storeProductId !== null)
                        //     continues to work for ordinary non-coupon dining orders.
                        storeProductId: appliedCoupon
                            ? (item.storeProductId ?? null)
                            : (item.storeProductId ?? item.id ?? null),
                        name: item.name,
                        isVeg: item.isVeg,
                        quantity: item.quantity,
                        price: item.price
                    })),
                    // Phase 4 audit re-fix (2026-06-09 evening): see localTotal comment above.
                    totalAmount: finalTotalToPay,
                    paid: true,
                    paymentId: id,
                    orderRequestId: acceptedRequests[0]?.id,
                    customerName: user.user_metadata?.full_name || user.email?.split('@')[0],
                    customerPhone: user.phone || '',
                    storeName: restaurantName,
                    specialInstructions: '',
                    arrivalTime: combinedArrivalTime,
                    otp,
                    orderType: 'dine-in',
                    guestsCount: guestCount,
                    // Phase 4 (2026-06-09): server-signed coupon token + identifiers
                    // for the POST /orders snapshot path. Only included when a coupon
                    // is applied; absent for no-coupon orders.
                    ...(appliedCoupon ? {
                        validationToken: appliedCoupon.validationToken,
                        couponId: appliedCoupon.couponId,
                        couponCode: appliedCoupon.code,
                    } : {}),
                };

                // Idempotent on paymentId → safe to auto-retry transient failures.
                let createdOrder: any = {};
                for (let attempt = 1; attempt <= 3; attempt++) {
                    const orderRes = await apiClient.fetch(`/orders`, {
                        method: 'POST',
                        body: JSON.stringify(orderPayload)
                    });

                    if (orderRes.ok) {
                        try { createdOrder = await orderRes.json(); } catch { createdOrder = {}; }
                        break;
                    }

                    let errBody: any = {};
                    try { errBody = await orderRes.json(); } catch { errBody = {}; }
                    console.error(`[DiningCheckout] order attempt ${attempt}/3 failed:`, orderRes.status, JSON.stringify(errBody));

                    if (['STORE_OFFLINE', 'STORE_CLOSED_TODAY', 'STORE_CLOSED_HOURS', 'STORE_LUNCH_BREAK'].includes(errBody.error)) {
                        Alert.alert('Store Unavailable', errBody.message || 'This store is currently not accepting orders. Your payment will be refunded.');
                        throw new Error(errBody.message || 'Store unavailable');
                    }

                    if (errBody.retryable && attempt < 3) {
                        await new Promise(r => setTimeout(r, 1200 * attempt));
                        continue;
                    }

                    throw new Error(errBody.message || "We couldn't place your order. Your payment is safe — we'll reconcile or refund it automatically.");
                }
                
                // Capture all needed data before clearing cart
                setConfirmedOrderData({
                    restaurantName: localRestaurantName,
                    items: localItems,
                    subtotal: localSubtotal,
                    gstAmount: localGst,
                    totalAmount: localTotal,
                    orderNumber: createdOrder.order_number || createdOrder.orderNumber || '',
                    otp: createdOrder.otp || createdOrder.otp_code || otp
                });
                
                setConfirmedOtp(createdOrder.otp || createdOrder.otp_code || otp);
                setConfirmedOrderNumber(createdOrder.order_number || createdOrder.orderNumber || '');
                clearCart();
            }
        } catch (error) {
            console.error('Failed to persist dining order:', error);
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


    if (step === 'waiting') {
        const waitingCount = requests.filter((r: any) => r.status === 'PENDING').length;
        const simulateMerchantResponse = async (reqId: string, newStatus: 'ACCEPTED' | 'REJECTED') => {
            try {
                const payload: any = { status: newStatus };
                if (newStatus === 'REJECTED') payload.rejection_reason = 'Simulated testing rejection';
                const { error } = await supabase.from('order_requests').update(payload).eq('id', reqId);
                if (error) throw error;
            } catch (err) {
                console.error('Failed to simulate update:', err);
            }
        };

        return (
            <SafeAreaView className="flex-1 bg-white">
                <View className="flex-1 items-center justify-center px-8">
                    <Activity size={48} color="#B52725" className="mb-6 opacity-80" />
                    <TouchableOpacity onLongPress={() => setDeveloperMode(prev => !prev)} delayLongPress={1000} activeOpacity={0.8}>
                        <Text className="text-[24px] font-bold text-gray-900 text-center">Confirming Booking</Text>
                    </TouchableOpacity>
                    <Text className="text-[14px] text-gray-500 font-medium text-center mt-3 px-4 mb-10">
                        {waitingCount > 0 ? `Waiting for ${restaurantName} to accept your dine-in request. This usually takes less than 2 minutes.` : `Restaurant has responded!`}
                    </Text>
                    <View className="w-full bg-gray-50 rounded-2xl p-5 border border-gray-100">
                        {requests.map((req: any) => (
                            <View key={req.id} className="mb-4 last:mb-0">
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1 pr-4">
                                        <Text className="text-[14px] font-bold text-gray-900 mb-1" numberOfLines={1}>{req.store_name}</Text>
                                        <Text className="text-[12px] text-gray-500 font-medium mb-0.5">Arrival: {combinedArrivalTime}</Text>
                                        <Text className="text-[12px] text-gray-500" numberOfLines={1}>Guests: {guestCount}</Text>
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
        const isAccepted = acceptedRequests.length > 0;

        return (
            <SafeAreaView className="flex-1 bg-white">
                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
                    <View className="px-6 pt-6 pb-4">
                        <Text className="text-[28px] font-extrabold text-gray-900">Booking Status</Text>
                        <Text className="text-[14px] text-gray-500 font-medium mt-1">Here is what the restaurant said</Text>
                    </View>
                    <View className="mx-5 mt-2">
                        <Text className="text-[18px] font-bold text-gray-900 mb-4">{isAccepted ? 'Booking Confirmed' : 'Booking Declined'}</Text>
                        {requests.map((req: any) => {
                            const reqIdShort = req.id.substring(0, 4).toUpperCase();
                            const placedAt = parseUtc(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const subtotal = req.subtotal || 0;
                            const tax = subtotal * 0.05;
                            const totalAmount = subtotal + tax;

                            return (
                            <View key={req.id} className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm">
                                {/* Header */}
                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-row items-center flex-1">
                                        <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-3 border border-gray-100">
                                            <MapPin size={20} color="#111827" />
                                        </View>
                                        <Text className="text-[16px] font-bold text-gray-900 flex-1" numberOfLines={1}>{req.store_name}</Text>
                                    </View>
                                    {req.status === 'ACCEPTED' ? (
                                        <View className="flex-row items-center bg-green-50 px-2.5 py-1 rounded-full"><CheckCircle size={14} color="#10B981" /><Text className="text-green-700 text-[12px] font-bold ml-1.5">Accepted</Text></View>
                                    ) : (
                                        <View className="flex-row items-center bg-red-50 px-2.5 py-1 rounded-full"><XCircle size={14} color="#EF4444" /><Text className="text-red-700 text-[12px] font-bold ml-1.5">Declined</Text></View>
                                    )}
                                </View>

                                {/* Order Info */}
                                <View className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-[13px] text-gray-500 font-medium">Request ID</Text>
                                        <Text className="text-[13px] text-gray-900 font-bold">REQ-{reqIdShort}</Text>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-[13px] text-gray-500 font-medium">Placed At</Text>
                                        <Text className="text-[13px] text-gray-900 font-bold">{placedAt}</Text>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Text className="text-[13px] text-gray-500 font-medium">Dine-In Time</Text>
                                        <Text className="text-[13px] text-gray-900 font-bold">{req.arrival_time}</Text>
                                    </View>
                                </View>

                                {/* Items */}
                                <View className="mb-4">
                                    <Text className="text-[14px] font-bold text-gray-900 mb-2">Items</Text>
                                    {req.items?.map((item: any, idx: number) => (
                                        <View key={idx} className="flex-row justify-between mb-1">
                                            <Text className="text-[13px] text-gray-700 flex-1" numberOfLines={1}>
                                                <Text className="font-bold text-gray-900">{item.quantity}x</Text> {item.name}
                                            </Text>
                                            <Text className="text-[13px] text-gray-900 font-medium ml-2">₹{item.price * item.quantity}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Bill Breakup */}
                                <View className="border-t border-gray-100 pt-3 mb-4">
                                    <View className="flex-row justify-between mb-1.5">
                                        <Text className="text-[13px] text-gray-500">Subtotal</Text>
                                        <Text className="text-[13px] text-gray-900 font-medium">₹{subtotal.toFixed(2)}</Text>
                                    </View>
                                    <View className="flex-row justify-between mb-3">
                                        <Text className="text-[13px] text-gray-500">Tax</Text>
                                        <Text className="text-[13px] text-gray-900 font-medium">₹{tax.toFixed(2)}</Text>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Text className="text-[15px] font-bold text-gray-900">Total Bill</Text>
                                        <Text className="text-[15px] font-bold text-gray-900">₹{totalAmount.toFixed(2)}</Text>
                                    </View>
                                </View>

                                {/* Rejection Reason */}
                                {req.status === 'REJECTED' && req.rejection_reason && (
                                    <View className="bg-red-50 p-3 rounded-xl border border-red-200">
                                        <Text className="text-[12px] text-red-600 font-bold uppercase tracking-wider mb-1">Reason for Decline</Text>
                                        <Text className="text-[14px] text-red-900 font-medium">{req.rejection_reason}</Text>
                                    </View>
                                )}
                            </View>
                            );
                        })}
                    </View>
                </ScrollView>

                {isAccepted && (
                    <View className="absolute bottom-0 left-0 right-0 px-4 bg-white border-t border-gray-50 pt-4 pb-[110px]">
                        <View className="flex-row items-center justify-between">
                            <TouchableOpacity onPress={() => navigation.goBack()} className="w-[30%] bg-[#DC2626] rounded-[20px] items-center justify-center" style={{ height: 60 }}>
                                <Text className="text-[15px] font-bold text-white text-center">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={confirmAccepted} className="w-[67%] bg-[#212121] rounded-[20px] items-center justify-between flex-row px-6" style={{ height: 60 }}>
                                <Text className="text-[16px] font-bold text-white">Pay & Confirm</Text>
                                <Text className="text-[16px] font-bold text-white">₹{total.toFixed(2)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            <RazorpayCheckout
                visible={showPayment}
                onClose={() => setShowPayment(false)}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                /* Phase 4 fix A1 (2026-06-09): bind to finalTotalToPay so the
                   charge matches /payments/create-order. */
                amount={finalTotalToPay}
                restaurantName={restaurantName}
                orderId={razorpayOrderId}
            />
            </SafeAreaView>
        );
    }

    // ==================== CONFIRMED STATE ====================
    if (step === 'confirmed') {
        const displayData = confirmedOrderData || {
            restaurantName: restaurantName,
            items: [],
            subtotal: 0,
            gstAmount: 0,
            // Phase 4 audit re-fix (2026-06-09 evening): finalTotalToPay
            // unconditionally — same precondition holds (this runs after
            // confirmAccepted has set the state).
            totalAmount: finalTotalToPay,
            orderNumber: confirmedOrderNumber,
            otp: confirmedOtp
        };

        return (
            <SafeAreaView className="flex-1 bg-white">
                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 30 }}>
                    {/* Success Header */}
                    <View className="items-center pt-12 pb-6 bg-green-50/50">
                        <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-4">
                            <CheckCircle size={44} color="#16A34A" />
                        </View>
                        <Text className="text-[24px] font-extrabold text-gray-900 text-center">Dining Order Confirmed!</Text>
                        <Text className="text-[13px] text-gray-500 font-medium text-center mt-1 px-8">
                            Show the OTP at the restaurant when you arrive
                        </Text>
                    </View>

                    {/* OTP Card — HIGHEST PRIORITY */}
                    <View className="px-5 mt-4">
                        <View className="bg-[#FEF2F2] rounded-2xl border-2 border-[#FECACA] items-center py-6 px-5">
                            <Text className="text-[11px] font-bold text-[#B52725] uppercase tracking-widest mb-2">Dining OTP</Text>
                            <Text className="text-[40px] font-extrabold text-[#B52725] tracking-[8px]">{displayData.otp}</Text>
                        </View>
                    </View>

                    {/* Reservation Details Card */}
                    <View className="px-5 mt-4">
                        <View className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            {displayData.orderNumber ? (
                                <View className="flex-row justify-between items-center pb-3 border-b border-gray-200">
                                    <Text className="text-[13px] text-gray-500 font-medium">Order #</Text>
                                    <Text className="text-[13px] font-bold text-gray-900">{displayData.orderNumber}</Text>
                                </View>
                            ) : null}
                            <View className="flex-row justify-between items-center py-3 border-b border-gray-200">
                                <Text className="text-[13px] text-gray-500 font-medium">Restaurant</Text>
                                <Text className="text-[13px] font-bold text-gray-900 flex-1 text-right ml-2" numberOfLines={1}>{displayData.restaurantName}</Text>
                            </View>
                            <View className="flex-row justify-between items-center py-3 border-b border-gray-200">
                                <Text className="text-[13px] text-gray-500 font-medium">Dine-in Time</Text>
                                <Text className="text-[13px] font-bold text-gray-900">{time.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</Text>
                            </View>
                            <View className="flex-row justify-between items-center pt-3">
                                <Text className="text-[13px] text-gray-500 font-medium">Guests</Text>
                                <Text className="text-[13px] font-bold text-gray-900">{guestCount} {guestCount === 1 ? 'Person' : 'People'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Order Items */}
                    <View className="px-5 mt-4">
                        <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Your Order</Text>
                        <View className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            {displayData.items.map((item, idx) => (
                                <View key={idx} className={`flex-row justify-between items-center ${idx < displayData.items.length - 1 ? 'pb-3 mb-3 border-b border-gray-200' : ''}`}>
                                    <Text className="text-[13px] text-gray-700 font-medium flex-1" numberOfLines={1}>
                                        <Text className="font-bold">{item.quantity}x</Text> {item.name}
                                    </Text>
                                    <Text className="text-[13px] font-bold text-gray-900 ml-2">₹{(item.price * item.quantity).toFixed(2)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Bill Breakdown */}
                    <View className="px-5 mt-4">
                        <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Bill Summary</Text>
                        <View className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            <View className="flex-row justify-between items-center pb-2">
                                <Text className="text-[13px] text-gray-500 font-medium">Subtotal</Text>
                                <Text className="text-[13px] text-gray-900 font-medium">₹{displayData.subtotal.toFixed(2)}</Text>
                            </View>
                            <View className="flex-row justify-between items-center pb-3 border-b border-gray-200">
                                <Text className="text-[13px] text-gray-500 font-medium">GST (5%)</Text>
                                <Text className="text-[13px] text-gray-900 font-medium">₹{displayData.gstAmount.toFixed(2)}</Text>
                            </View>
                            <View className="flex-row justify-between items-center pt-3">
                                <Text className="text-[15px] font-bold text-gray-900">Total Paid</Text>
                                <Text className="text-[18px] font-extrabold text-[#B52725]">₹{displayData.totalAmount.toFixed(2)}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Payment ID (compact) */}
                    {paymentId ? (
                        <View className="px-5 mt-3">
                            <Text className="text-[10px] text-gray-400 font-medium text-center">Payment ID: {paymentId}</Text>
                        </View>
                    ) : null}

                    {/* Arrival reminder */}
                    <Text className="text-[11px] text-gray-400 font-medium text-center mt-4 px-6">
                        Please arrive 10 minutes before your dining time
                    </Text>
                </ScrollView>

                {/* Bottom CTAs */}
                <View className="px-5 pb-8 pt-4 bg-white border-t border-gray-100">
                    <TouchableOpacity onPress={handleBackToHome} className="w-full bg-[#212121] rounded-[20px] items-center justify-center" style={{ height: 56 }}>
                        <Text className="text-[16px] font-bold text-white">Back to Home</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { handleBackToHome(); setTimeout(() => navigation.navigate('YourOrders' as any), 100); }} className="w-full items-center justify-center mt-2" style={{ height: 40 }}>
                        <Text className="text-[13px] font-bold text-[#B52725]">View Order History</Text>
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
            {/* Fixed Header */}
            <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                    <ArrowLeftCircle size={28} color="#1F2937" fill="white" />
                </TouchableOpacity>
                <Text className="text-[20px] font-bold text-gray-900">Confirm Dining Order</Text>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
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
                
                <View className="mx-5 bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden">
                    {/* Number of Guests Row */}
                    <View className="flex-row justify-between items-center px-5 py-4">
                        <View className="flex-row items-center">
                            <User size={18} color="#374151" />
                            <Text className="text-[15px] font-bold text-gray-900 ml-3">Number of Guests</Text>
                        </View>
                        <View className="flex-row items-center">
                            <TouchableOpacity
                                onPress={() => {
                                    if (guestCount > 1) {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setGuestCount(guestCount - 1);
                                    }
                                }}
                                className={`w-9 h-9 rounded-xl border items-center justify-center ${guestCount <= 1 ? 'border-gray-50 bg-gray-50' : 'border-gray-200 bg-white'}`}
                            >
                                <Minus size={16} color={guestCount <= 1 ? '#D1D5DB' : '#374151'} />
                            </TouchableOpacity>
                            <Text className="text-[17px] font-bold text-gray-900 w-10 text-center">{guestCount}</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    if (guestCount < 20) {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setGuestCount(guestCount + 1);
                                    }
                                }}
                                className={`w-9 h-9 rounded-xl border items-center justify-center ${guestCount >= 20 ? 'border-gray-50 bg-gray-50' : 'border-gray-200 bg-white'}`}
                            >
                                <Plus size={16} color={guestCount >= 20 ? '#D1D5DB' : '#374151'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="h-[1px] bg-gray-50 mx-5" />

                    {/* Date & Time Row */}
                    <View className="p-5">
                        <View className="flex-row gap-4">
                            <View className="flex-1">
                                <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setTempDate(date);
                                        setShowTimePicker(false);
                                        setShowDatePicker(true);
                                    }}
                                    className={`border rounded-xl mt-2 flex-row items-center px-4 h-12 ${showDatePicker ? 'border-[#B52725] bg-red-50/10' : 'border-gray-200 bg-white'}`}
                                >
                                    <Clock size={14} color={showDatePicker ? '#B52725' : '#9CA3AF'} className="mr-2" />
                                    <Text className={`text-[14px] font-bold ${showDatePicker ? 'text-[#B52725]' : 'text-gray-900'}`}>{formatDate(date)}</Text>
                                </TouchableOpacity>
                            </View>
                            <View className="flex-1">
                                <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Time</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setTempTime(time);
                                        setShowDatePicker(false);
                                        setShowTimePicker(true);
                                    }}
                                    className={`border rounded-xl mt-2 flex-row items-center px-4 h-12 ${showTimePicker ? 'border-[#B52725] bg-red-50/10' : 'border-gray-200 bg-white'}`}
                                >
                                    <Clock size={14} color={showTimePicker ? '#B52725' : '#9CA3AF'} className="mr-2" />
                                    <Text className={`text-[14px] font-bold ${showTimePicker ? 'text-[#B52725]' : 'text-gray-900'}`}>{formatTime(time)}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Enhanced Picker with Confirmation Toolbar (iOS only) */}
                    {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
                        <View className="bg-gray-50 border-t border-gray-100 pb-4">
                            <View className="flex-row justify-between items-center px-6 py-3 border-b border-gray-100">
                                <TouchableOpacity onPress={handleCancelPicker} className="w-10 h-10 items-center justify-center rounded-full bg-gray-200/50">
                                    <XCircle size={22} color="#EF4444" />
                                </TouchableOpacity>
                                <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">
                                    {showDatePicker ? 'Select Date' : 'Select Time'}
                                </Text>
                                <TouchableOpacity onPress={handleDonePicker} className="w-10 h-10 items-center justify-center rounded-full bg-green-100">
                                    <CheckCircle size={22} color="#10B981" />
                                </TouchableOpacity>
                            </View>
                            
                            {showDatePicker && (
                                <DateTimePicker
                                    key="date-picker"
                                    value={tempDate}
                                    mode="date"
                                    display="spinner"
                                    minimumDate={new Date()}
                                    maximumDate={maxDate}
                                    onChange={onDateChange}
                                    textColor="#111827"
                                    themeVariant="light"
                                />
                            )}
                            {showTimePicker && (
                                <DateTimePicker
                                    key="time-picker"
                                    value={tempTime}
                                    mode="time"
                                    display="spinner"
                                    minuteInterval={15}
                                    minimumDate={date.toDateString() === new Date().toDateString() ? new Date(Date.now() + 30 * 60000) : undefined}
                                    onChange={onTimeChange}
                                    textColor="#111827"
                                    themeVariant="light"
                                />
                            )}
                        </View>
                    )}

                    {/* Android Pickers (Standard display) */}
                    {Platform.OS === 'android' && showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display="default"
                            minimumDate={new Date()}
                            maximumDate={maxDate}
                            onChange={onDateChange}
                        />
                    )}
                    {Platform.OS === 'android' && showTimePicker && (
                        <DateTimePicker
                            value={time}
                            mode="time"
                            display="default"
                            minuteInterval={15}
                            minimumDate={date.toDateString() === new Date().toDateString() ? new Date(Date.now() + 30 * 60000) : undefined}
                            onChange={onTimeChange}
                        />
                    )}
                </View>

                {/* Info Text */}
                <View className="px-7 mt-2">
                    <Text className="text-[11px] text-gray-400 font-medium italic">
                        * All dine-in bookings require a minimum of 30 minutes preparation time.
                    </Text>
                </View>

                {/* Order Summary */}
                <View className="px-5 mt-6 mb-3">
                    <Text className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wider">Order Summary</Text>
                </View>
                <View className="mx-5 bg-white rounded-[20px] border border-gray-100 p-5 shadow-sm" style={{ zIndex: 10 }}>
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

                    {/* Phase 4 fix B1 (2026-06-09): Apply Coupon entry-point row.
                        Re-fixed 2026-06-09 evening: Remove button is now a SIBLING
                        of the navigate-to-Coupons TouchableOpacity, not nested
                        inside it (avoids both handlers firing on Remove tap). */}
                    <View className="border-t border-gray-100 mt-3 pt-3 mb-3">
                        <View className="flex-row items-center bg-[#FDF7F7] border border-[#FCDADA] rounded-xl p-3">
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Coupons' as any, {
                                    subtotal,
                                    storeId: restaurantId || '',
                                    appliedCouponId: appliedCoupon?.couponId,
                                    returnTo: 'DiningCheckout',
                                })}
                                className="flex-1 flex-row items-center"
                                activeOpacity={0.7}
                            >
                                <Ticket size={18} color="#B52725" />
                                <View className="flex-1 ml-3">
                                    <Text className="text-[13px] font-bold text-gray-900">
                                        {appliedCoupon ? `${appliedCoupon.code} applied` : 'Apply Coupon'}
                                    </Text>
                                    {appliedCoupon ? (
                                        <Text className="text-[11px] text-green-600 font-semibold mt-0.5">
                                            Saved ₹{appliedCoupon.discount.toFixed(2)} · Tap to change
                                        </Text>
                                    ) : (
                                        <Text className="text-[11px] text-gray-500 font-medium mt-0.5">
                                            Browse offers or enter a code
                                        </Text>
                                    )}
                                </View>
                                {!appliedCoupon && <ChevronRight size={16} color="#B52725" />}
                            </TouchableOpacity>
                            {appliedCoupon && (
                                <TouchableOpacity
                                    onPress={() => clearAppliedCoupon()}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    className="ml-2 px-2.5 py-1 rounded-full bg-gray-100"
                                >
                                    <Text className="text-[11px] font-bold text-gray-700">Remove</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Bill */}
                    <View className="border-t border-gray-100 mt-3 pt-3">
                        <View className="flex-row justify-between mb-1.5">
                            <Text className="text-[13px] text-gray-500 font-medium">Subtotal</Text>
                            <Text className="text-[13px] text-gray-900 font-bold">₹{subtotal}</Text>
                        </View>
                        <View className="flex-row justify-between mb-1.5">
                            <Text className="text-[13px] text-gray-500 font-medium">GST (5%)</Text>
                            <Text className="text-[13px] text-gray-900 font-bold">₹{exactGst.toFixed(2)}</Text>
                        </View>
                        {appliedCoupon && (
                            <View className="flex-row justify-between mb-1.5">
                                <Text className="text-[13px] text-green-600 font-bold">Discount</Text>
                                <Text className="text-[13px] text-green-600 font-bold">-₹{discount.toFixed(2)}</Text>
                            </View>
                        )}
                        <View className="border-t border-gray-100 my-2" />
                        <View className="flex-row justify-between items-center">
                            <Text className="text-[16px] text-gray-900 font-extrabold">Total Pay</Text>
                            <Text className="text-[18px] text-gray-900 font-extrabold">₹{total.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

            </ScrollView>

            {/* Bottom CTA — sits below ScrollView in flex layout, pb clears the absolute tab bar */}
            <View className="px-4 bg-white border-t border-gray-50 pt-4 pb-[100px]">
                <TouchableOpacity
                    onPress={handleRequestOrder}
                    className={`w-full bg-[#212121] rounded-[20px] items-center justify-center ${(showDatePicker || showTimePicker) ? 'opacity-50' : ''}`}
                    style={{ height: 60 }}
                    activeOpacity={0.9}
                    disabled={showDatePicker || showTimePicker}
                >
                    <Text className="text-[16px] font-bold text-white">Request Booking</Text>
                </TouchableOpacity>
            </View>

            <RazorpayCheckout
                visible={showPayment}
                onClose={() => setShowPayment(false)}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                /* Phase 4 fix A1 (2026-06-09): bind to finalTotalToPay (post re-validate)
                   so the charge matches what /payments/create-order received. */
                amount={finalTotalToPay}
                restaurantName={restaurantName}
                orderId={razorpayOrderId}
            />
        </SafeAreaView>
    );
}
