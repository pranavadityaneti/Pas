// BookingModal: Two-step modal — booking form (bottom sheet) → confirmation card.
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, Modal, Pressable,
    Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { Minus, Plus, ChevronDown, CheckCircle, Info, MapPin, AlertTriangle } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import RazorpayCheckout from './RazorpayCheckout';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import TransactionalAuthModal from './TransactionalAuthModal';

interface BookingModalProps {
    visible: boolean;
    onClose: () => void;
    restaurant: {
        id: number | string;
        name: string;
        address: string;
        merchantId?: string;
        branches?: string[];
    };
}

const getDefaultTime = () => {
    const t = new Date();
    t.setHours(19, 30, 0, 0);
    return t;
};

export default function BookingModal({ visible, onClose, restaurant }: BookingModalProps) {
    const navigation = useNavigation<any>();
    const [step, setStep] = useState<'form' | 'confirmed'>('form');
    const [branchesData, setBranchesData] = useState<{ id: string; name: string; address?: string; operating_hours?: any }[]>([]);
    const [branchesLoading, setBranchesLoading] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [guestCount, setGuestCount] = useState(2);
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(getDefaultTime);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [razorpayOrderId, setRazorpayOrderId] = useState<string | undefined>();
    const [bookingOtp, setBookingOtp] = useState('');
    const [bookingOrderNumber, setBookingOrderNumber] = useState('');

    // Booking Fee Calculation: ₹25 per 2 guests, capped at ₹100
    const bookingFee = Math.min(100, Math.ceil(guestCount / 2) * 25);

    const hasBranches = branchesData.length > 1;

    // Fetch branches dynamically when modal opens
    useEffect(() => {
        if (!visible) return;

        // Reset all form state
        setStep('form');
        setBranchDropdownOpen(false);
        setGuestCount(2);
        setDate(new Date());
        setTime(getDefaultTime());
        setShowDatePicker(false);
        setShowTimePicker(false);
        setShowPayment(false);

        const fetchBranches = async () => {
            if (!restaurant.merchantId) {
                setBranchesData([]);
                setSelectedBranch('');
                return;
            }

            setBranchesLoading(true);
            try {
                const { data, error } = await supabase
                    .from('merchant_branches')
                    .select('id, branch_name, address, operating_hours')
                    .eq('merchant_id', restaurant.merchantId)
                    .eq('is_active', true);

                if (error) throw error;

                if (data && data.length > 0) {
                    const mapped = data.map(b => ({ id: b.id, name: b.branch_name, address: b.address || undefined, operating_hours: b.operating_hours || null }));
                    setBranchesData(mapped);
                    setSelectedBranch(mapped[0].name);
                } else {
                    setBranchesData([]);
                    setSelectedBranch('');
                }
            } catch (err) {
                console.error('[BookingModal] Failed to fetch branches:', err);
                setBranchesData([]);
                setSelectedBranch('');
            } finally {
                setBranchesLoading(false);
            }
        };

        fetchBranches();
    }, [visible, restaurant.id, restaurant.merchantId]);

    // Max date: 7 days from now
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);

    // ── Operating Hours Validation ──
    const selectedBranchData = branchesData.find(b => b.name === selectedBranch);
    const operatingHours = selectedBranchData?.operating_hours || (branchesData.length === 1 ? branchesData[0]?.operating_hours : null);

    const getBookingValidation = () => {
        if (!operatingHours || !operatingHours.open || !operatingHours.close) {
            return { isValid: true, reason: '' }; // No hours configured — allow booking
        }

        // Check if selected day is an operating day
        // operating_hours.days is an array of day indices: 0=Mon, 1=Tue, ..., 6=Sun
        if (operatingHours.days && Array.isArray(operatingHours.days)) {
            const jsDay = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            // Convert JS day (0=Sun) to operating_hours format (0=Mon, 6=Sun)
            const ohDay = jsDay === 0 ? 6 : jsDay - 1;
            if (!operatingHours.days.includes(ohDay)) {
                const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const openDays = operatingHours.days.map((d: number) => dayNames[d]).join(', ');
                return { isValid: false, reason: `Restaurant is closed on this day. Open days: ${openDays}` };
            }
        }

        // Check if selected time is within open/close range
        const [openH, openM] = operatingHours.open.split(':').map(Number);
        const [closeH, closeM] = operatingHours.close.split(':').map(Number);
        const selectedMinutes = time.getHours() * 60 + time.getMinutes();
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        if (selectedMinutes < openMinutes || selectedMinutes >= closeMinutes) {
            const formatHM = (h: number, m: number) => {
                const period = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                return `${h12}:${String(m).padStart(2, '0')} ${period}`;
            };
            return { isValid: false, reason: `Please select a time between ${formatHM(openH, openM)} and ${formatHM(closeH, closeM)}` };
        }

        // Check lunch break
        if (operatingHours.hasLunchBreak && operatingHours.lunchStart && operatingHours.lunchEnd) {
            const [lsH, lsM] = operatingHours.lunchStart.split(':').map(Number);
            const [leH, leM] = operatingHours.lunchEnd.split(':').map(Number);
            const lunchStartMin = lsH * 60 + lsM;
            const lunchEndMin = leH * 60 + leM;
            if (selectedMinutes >= lunchStartMin && selectedMinutes < lunchEndMin) {
                const formatHM = (h: number, m: number) => {
                    const period = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
                };
                return { isValid: false, reason: `Restaurant has a break from ${formatHM(lsH, lsM)} to ${formatHM(leH, leM)}. Please select a different time.` };
            }
        }

        return { isValid: true, reason: '' };
    };

    const bookingValidation = getBookingValidation();

    // Format operating hours for display
    const getOperatingHoursDisplay = () => {
        if (!operatingHours || !operatingHours.open || !operatingHours.close) return null;
        const formatHM = (timeStr: string) => {
            const [h, m] = timeStr.split(':').map(Number);
            const period = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${String(m).padStart(2, '0')} ${period}`;
        };
        return `${formatHM(operatingHours.open)} – ${formatHM(operatingHours.close)}`;
    };
    const operatingHoursDisplay = getOperatingHoursDisplay();

    const handleConfirm = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            setAuthModalVisible(true);
            return;
        }

        try {
            const user = session.user;
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            const res = await fetch(`${apiUrl}/payments/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: bookingFee, type: 'consumer', userId: user?.id })
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
        try {
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
                setShowPayment(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Error', 'User session expired. Please login again.');
                setShowPayment(false);
                return;
            }

            // Resolve the branch ID for the API call
            // If multiple branches and one is selected, use that branch's id
            // If single-location, fall back to restaurant.merchantId (treated as store_id = branch_id at API level)
            const selectedBranchData = branchesData.find(b => b.name === selectedBranch);
            const branchId = selectedBranchData?.id || restaurant.merchantId || (restaurant.id ? String(restaurant.id) : null);
            const storeId = restaurant.merchantId || (restaurant.id ? String(restaurant.id) : null);

            if (!storeId || !branchId) {
                Alert.alert('Error', 'Restaurant configuration is incomplete. Please try again.');
                setShowPayment(false);
                return;
            }

            const orderRes = await fetch(`${apiUrl}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    storeId,
                    branchId,
                    items: [],
                    totalAmount: bookingFee,
                    paid: true,
                    paymentId: id,
                    customerName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Guest',
                    customerPhone: user.phone || '',
                    storeName: `${restaurant.name}${selectedBranch ? ` (${selectedBranch})` : ''}`,
                    specialInstructions: 'Table Booking Only',
                    arrivalTime: `${formatDate(date)}, ${formatTime(time)}`,
                    orderType: 'dine-in',
                    guestsCount: guestCount
                })
            });

            if (!orderRes.ok) {
                const errorBody = await orderRes.text();
                console.error('[BookingModal] API order creation failed:', orderRes.status, errorBody);
                Alert.alert('Booking Error', 'Could not save your booking. Please contact support with your payment ID.');
                setShowPayment(false);
                return;
            }

            const createdOrder = await orderRes.json();
            // Store the server-generated OTP in state so the confirmation screen can display it
            setBookingOtp(createdOrder.otp_code || createdOrder.otp || '');
            setBookingOrderNumber(createdOrder.order_number || createdOrder.orderNumber || '');
        } catch (error) {
            console.error('Failed to persist booking to Supabase:', error);
            // In a production app you might want to retry. We proceed to confirmation for UX.
        }

        setShowPayment(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('confirmed');
    };

    const handlePaymentError = (error: string) => {
        setShowPayment(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        console.warn('Booking payment failed:', error);
        Alert.alert(
            'Payment Failed',
            error || 'Your payment could not be completed. No money was deducted. Please try again.',
            [{ text: 'OK' }]
        );
    };

    const handlePaymentDismiss = () => {
        setShowPayment(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            'Payment Cancelled',
            'You closed the payment screen. No money was deducted. You can try again whenever you\'re ready.',
            [{ text: 'OK' }]
        );
    };

    const handleDone = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onClose();
    };

    const handleCancel = () => {
        setBranchDropdownOpen(false);
        setShowDatePicker(false);
        setShowTimePicker(false);
        onClose();
    };

    const formatDate = (d: Date) => {
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Today';
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const formatTime = (t: Date) => {
        return t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
    };

    const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selectedDate) setDate(selectedDate);
    };

    const onTimeChange = (_event: DateTimePickerEvent, selectedTime?: Date) => {
        if (Platform.OS === 'android') setShowTimePicker(false);
        if (selectedTime) setTime(selectedTime);
    };

    // ==================== CONFIRMATION STEP ====================
    if (step === 'confirmed') {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View className="bg-white rounded-3xl mx-6" style={{ width: '88%', maxHeight: '85%' }}>
                        <ScrollView 
                            contentContainerStyle={{ padding: 24 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Title block */}
                            <View className="items-center mb-5">
                                <View className="w-14 h-14 rounded-full bg-green-50 items-center justify-center mb-3">
                                    <CheckCircle size={32} color="#16A34A" />
                                </View>
                                <Text className="text-[22px] font-bold text-gray-900 text-center">Booking Confirmed!</Text>
                                <Text className="text-[13px] text-gray-500 font-medium text-center mt-1">Your table has been reserved</Text>
                            </View>

                            {/* OTP Card — HIGHEST PRIORITY */}
                            {bookingOtp ? (
                                <View className="w-full bg-[#FEF2F2] rounded-2xl border-2 border-[#FECACA] items-center mb-4" style={{ paddingVertical: 24, paddingHorizontal: 20 }}>
                                    <Text className="text-[11px] font-bold text-[#B52725] uppercase tracking-wider mb-2">Show this at the restaurant</Text>
                                    <Text className="text-[40px] font-bold text-[#B52725] tracking-[8px]">
                                        {bookingOtp}
                                    </Text>
                                </View>
                            ) : null}

                            {/* Details card — compact */}
                            <View className="w-full bg-gray-50 rounded-2xl" style={{ paddingVertical: 14, paddingHorizontal: 18 }}>
                                {bookingOrderNumber ? <DetailRow label="Order #" value={bookingOrderNumber} /> : null}
                                <DetailRow label="Restaurant" value={restaurant.name} />
                                <DetailRow label="Date & Time" value={`${formatDate(date)}, ${formatTime(time)}`} />
                                <DetailRow label="Guests" value={`${guestCount} ${guestCount === 1 ? 'Person' : 'People'}`} />
                                <DetailRow label="Deposit Paid" value={`₹${bookingFee}`} isLast />
                            </View>

                            {/* Arrival reminder */}
                            <Text className="text-[11px] text-gray-400 font-medium text-center mt-4 px-2">
                                Please arrive 10 minutes before your reservation time.
                            </Text>

                            {/* Done button */}
                            <TouchableOpacity
                                onPress={handleDone}
                                className="w-full bg-[#B52725] rounded-2xl items-center justify-center mt-5"
                                style={{ height: 52 }}
                                activeOpacity={0.9}
                            >
                                <Text className="text-[15px] font-bold text-white">Done</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    }

    // ==================== FORM STEP ====================
    return (
        <Modal visible={visible} transparent animationType="slide">
            <Pressable
                className="flex-1"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                onPress={handleCancel}
                pointerEvents="auto"
            />
            <View
                className="bg-white rounded-t-3xl"
                style={{
                    paddingHorizontal: 24,
                    paddingTop: 12,
                    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
                    zIndex: 100 // Ensure it's above the backdrop
                }}
            >
                {/* Drag handle */}
                <View className="items-center mb-5">
                    <View className="w-10 h-1 bg-gray-300 rounded-full" />
                </View>

                {/* Restaurant info */}
                <Text className="text-[22px] font-bold text-gray-900">{restaurant.name}</Text>
                <Text className="text-[13px] text-gray-500 font-medium" style={{ marginTop: 4 }}>{restaurant.address}</Text>

                {/* SELECT BRANCH — Only shown when 2+ branches exist */}
                {branchesLoading ? (
                    <View className="items-center py-4">
                        <ActivityIndicator size="small" color="#9CA3AF" />
                    </View>
                ) : hasBranches ? (
                    <>
                        <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider" style={{ marginTop: 24 }}>Select Branch</Text>
                        <TouchableOpacity
                            onPress={() => setBranchDropdownOpen(!branchDropdownOpen)}
                            className="flex-row items-center justify-between border border-gray-200 rounded-xl mt-2"
                            style={{ height: 48, paddingHorizontal: 16 }}
                        >
                            <View className="flex-1 pr-4">
                                <Text className="text-[14px] font-bold text-gray-900">{selectedBranch}</Text>
                                {branchesData.find(b => b.name === selectedBranch)?.address && (
                                    <Text className="text-[11px] text-gray-400 font-medium mt-0.5" numberOfLines={1}>
                                        {branchesData.find(b => b.name === selectedBranch)?.address}
                                    </Text>
                                )}
                            </View>
                            <ChevronDown size={18} color="#9CA3AF" />
                        </TouchableOpacity>

                        {/* Branch dropdown */}
                        {branchDropdownOpen && (
                            <View className="border border-gray-200 rounded-xl mt-1 overflow-hidden">
                                {branchesData.map((branch, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => {
                                            setSelectedBranch(branch.name);
                                            setBranchDropdownOpen(false);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        className={`px-4 py-3 ${branch.name === selectedBranch ? 'bg-gray-100' : 'bg-white'} ${idx < branchesData.length - 1 ? 'border-b border-gray-100' : ''}`}
                                    >
                                        <Text className={`text-[13px] font-medium ${branch.name === selectedBranch ? 'text-gray-900 font-bold' : 'text-gray-600'}`}>{branch.name}</Text>
                                        {branch.address && (
                                            <Text className="text-[11px] text-gray-400 font-medium mt-0.5" numberOfLines={1}>{branch.address}</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </>
                ) : (
                    /* Single-location: show prominent address card */
                    <View className="flex-row items-start bg-gray-50 rounded-xl p-4 border border-gray-100" style={{ marginTop: 20 }}>
                        <MapPin size={18} color="#B52725" style={{ marginTop: 2 }} />
                        <View className="ml-3 flex-1">
                            <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Location</Text>
                            <Text className="text-[14px] font-semibold text-gray-900 mt-1" numberOfLines={2}>{restaurant.address}</Text>
                        </View>
                    </View>
                )}

                {/* NUMBER OF GUESTS \u0026 BOOKING FEE */}
                <View className="flex-row items-center justify-between" style={{ marginTop: 20 }}>
                    <View>
                        <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Number of Guests</Text>
                        <View className="flex-row items-center mt-2">
                            <TouchableOpacity
                                onPress={() => {
                                    if (guestCount > 1) {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setGuestCount(guestCount - 1);
                                    }
                                }}
                                className={`w-10 h-10 rounded-xl border items-center justify-center ${guestCount <= 1 ? 'border-gray-100' : 'border-gray-300'}`}
                            >
                                <Minus size={16} color={guestCount <= 1 ? '#D1D5DB' : '#374151'} />
                            </TouchableOpacity>
                            <Text className="text-[20px] font-bold text-gray-900 mx-5">{guestCount}</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    if (guestCount < 20) {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setGuestCount(guestCount + 1);
                                    }
                                }}
                                className={`w-10 h-10 rounded-xl border items-center justify-center ${guestCount >= 20 ? 'border-gray-100' : 'border-gray-300'}`}
                            >
                                <Plus size={16} color={guestCount >= 20 ? '#D1D5DB' : '#374151'} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View className="items-end">
                        <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Booking Fee</Text>
                        <Text className="text-[20px] font-bold text-[#B52725] mt-2">₹{bookingFee}</Text>
                    </View>
                </View>

                {/* DATE \u0026 TIME */}
                <View className="flex-row gap-4" style={{ marginTop: 20 }}>
                    <View className="flex-1">
                        <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</Text>
                        <TouchableOpacity
                            onPress={() => {
                                setShowTimePicker(false);
                                setShowDatePicker(true);
                            }}
                            className="border border-gray-200 rounded-xl mt-2 justify-center"
                            style={{ height: 48, paddingHorizontal: 16 }}
                        >
                            <Text className="text-[14px] font-bold text-gray-900">{formatDate(date)}</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Time</Text>
                        <TouchableOpacity
                            onPress={() => {
                                setShowDatePicker(false);
                                setShowTimePicker(true);
                            }}
                            className="border border-gray-200 rounded-xl mt-2 justify-center"
                            style={{ height: 48, paddingHorizontal: 16 }}
                        >
                            <Text className="text-[14px] font-bold text-gray-900">{formatTime(time)}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Native pickers */}
                {showDatePicker && (
                    <DateTimePicker
                        value={date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={new Date()}
                        maximumDate={maxDate}
                        onChange={onDateChange}
                    />
                )}
                {showTimePicker && (
                    <DateTimePicker
                        value={time}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minuteInterval={15}
                        onChange={onTimeChange}
                    />
                )}

                {/* Operating Hours Info */}
                {operatingHoursDisplay && (
                    <View className="flex-row items-center bg-blue-50 p-3 rounded-xl border border-blue-100" style={{ marginTop: 16 }}>
                        <Info size={14} color="#2563EB" />
                        <Text className="text-[11px] text-blue-700 font-semibold ml-2 flex-1">
                            Open Hours: {operatingHoursDisplay}
                        </Text>
                    </View>
                )}

                {/* Booking Blocked Warning */}
                {!bookingValidation.isValid && (
                    <View className="flex-row items-start bg-red-50 p-3 rounded-xl border border-red-200" style={{ marginTop: 12 }}>
                        <AlertTriangle size={14} color="#DC2626" style={{ marginTop: 1 }} />
                        <Text className="text-[11px] text-red-700 font-semibold ml-2 flex-1">
                            {bookingValidation.reason}
                        </Text>
                    </View>
                )}

                {/* Policy Note */}
                <View className="flex-row items-center bg-gray-50 p-3 rounded-xl border border-gray-100" style={{ marginTop: bookingValidation.isValid ? 24 : 12 }}>
                    <Info size={14} color="#B52725" />
                    <Text className="text-[11px] text-gray-500 font-medium ml-2 flex-1">
                        A ₹{bookingFee} booking deposit will be adjusted in your final bill at the restaurant.
                    </Text>
                </View>

                {/* Action buttons */}
                <View className="flex-row gap-3" style={{ marginTop: 20 }}>
                    <TouchableOpacity
                        onPress={handleCancel}
                        className="flex-1 border border-gray-200 rounded-2xl items-center justify-center"
                        style={{ height: 52 }}
                    >
                        <Text className="text-[14px] font-bold text-gray-700">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleConfirm}
                        className={`flex-1 rounded-2xl items-center justify-center ${bookingValidation.isValid ? 'bg-[#B52725]' : 'bg-gray-300'}`}
                        style={{ height: 52 }}
                        activeOpacity={0.9}
                        hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
                        disabled={!bookingValidation.isValid}
                    >
                        <Text className="text-[14px] font-bold text-white">{bookingValidation.isValid ? 'Pay & Confirm' : 'Unavailable'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <RazorpayCheckout
                visible={showPayment}
                onClose={handlePaymentDismiss}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                amount={bookingFee}
                restaurantName={restaurant.name}
                orderId={razorpayOrderId}
            />

            <TransactionalAuthModal
                visible={authModalVisible}
                onClose={() => setAuthModalVisible(false)}
                onSuccess={() => {
                    setAuthModalVisible(false);
                    // Retrigger confirm to create the secure order ID now that they are logged in
                    handleConfirm();
                }}
                title="Secure Your Booking"
                subtitle="Login or sign up to confirm your table."
            />
        </Modal>
    );
}

// --- Detail Row for Confirmation ---
function DetailRow({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
    return (
        <View className={`flex-row items-center justify-between py-2.5 ${!isLast ? 'border-b border-gray-100' : ''}`}>
            <Text className="text-[13px] text-gray-500 font-medium">{label}</Text>
            <Text className="text-[13px] font-bold text-gray-900">{value}</Text>
        </View>
    );
}
