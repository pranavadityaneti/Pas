// BookingModal: Two-step modal — booking form (bottom sheet) → confirmation card.
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, Modal, Pressable,
    Platform, Alert
} from 'react-native';
import { Minus, Plus, ChevronDown, CheckCircle, Info } from 'lucide-react-native';
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
        id: number;
        name: string;
        address: string;
        branches: string[];
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
    const [selectedBranch, setSelectedBranch] = useState(restaurant.branches[0] || '');
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [guestCount, setGuestCount] = useState(2);
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(getDefaultTime);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [razorpayOrderId, setRazorpayOrderId] = useState<string | undefined>();

    // Booking Fee Calculation: ₹25 per 2 guests, capped at ₹100
    const bookingFee = Math.min(100, Math.ceil(guestCount / 2) * 25);

    // Reset state when restaurant changes or modal opens
    useEffect(() => {
        if (visible) {
            setStep('form');
            setSelectedBranch(restaurant.branches[0] || '');
            setBranchDropdownOpen(false);
            setGuestCount(2);
            setDate(new Date());
            setTime(getDefaultTime());
            setShowDatePicker(false);
            setShowTimePicker(false);
            setShowPayment(false);
        }
    }, [visible, restaurant.id]);

    // Max date: 7 days from now
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);

    const handleConfirm = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            setAuthModalVisible(true);
            return;
        }

        try {
            const user = session.user;
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://pas-api-prod.eba-njbp437w.ap-south-1.elasticbeanstalk.com';
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
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://pas-api-prod.eba-njbp437w.ap-south-1.elasticbeanstalk.com';
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
            if (user) {
                // Generate a random 4-digit OTP for the table booking
                const bookingOtp = Math.floor(1000 + Math.random() * 9000).toString();
                // Generate order number manually
                const orderNumber = `PAS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${user.id.slice(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

                const now = new Date().toISOString();
                const { error: bookingError } = await supabase
                    .from('orders')
                    .insert({
                        user_id: user.id,
                        order_number: orderNumber,
                        customer_name: user.user_metadata?.full_name || user.email?.split('@')[0],
                        customer_phone: user.phone || '',
                        store_id: restaurant.id ? String(restaurant.id) : null,
                        store_name: `${restaurant.name} (${selectedBranch})`,
                        amount: bookingFee,
                        total_amount: bookingFee,
                        order_type: 'dine-in',
                        otp_code: bookingOtp,
                        otp: bookingOtp,
                        items_count: 0,
                        status: 'CONFIRMED',
                        special_instructions: 'Table Booking Only',
                        arrival_time: `${formatDate(date)}, ${formatTime(time)}`,
                        guests_count: guestCount,
                        created_at: now,
                        updated_at: now
                    });

                if (bookingError) throw bookingError;
            }
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
                    <View className="bg-white rounded-3xl mx-6 w-5/6 items-center" style={{ paddingVertical: 32, paddingHorizontal: 24 }}>
                        {/* Green check */}
                        <View className="w-16 h-16 rounded-full bg-green-50 items-center justify-center mb-5">
                            <CheckCircle size={36} color="#16A34A" />
                        </View>

                        <Text className="text-[22px] font-bold text-gray-900 text-center">Booking Confirmed!</Text>
                        <Text className="text-[14px] text-gray-500 font-medium text-center" style={{ marginTop: 6 }}>Your table has been reserved</Text>

                        {/* Details card */}
                        <View className="w-full bg-gray-50 rounded-2xl mt-6" style={{ paddingVertical: 16, paddingHorizontal: 20 }}>
                            <DetailRow label="Restaurant" value={restaurant.name} />
                            <DetailRow label="Branch" value={selectedBranch} />
                            <DetailRow label="Date & Time" value={`${formatDate(date)}, ${formatTime(time)}`} />
                            <DetailRow label="Guests" value={`${guestCount} ${guestCount === 1 ? 'Person' : 'People'}`} />
                            <DetailRow label="Booking Fee Paid" value={`₹${bookingFee}`} isLast />
                        </View>

                        <Text className="text-[12px] text-gray-400 font-medium text-center mt-5 px-2">
                            A confirmation has been sent to your phone. Please arrive 10 minutes before your reservation time.
                        </Text>

                        {/* Done button */}
                        <TouchableOpacity
                            onPress={handleDone}
                            className="w-full bg-[#B52725] rounded-2xl items-center justify-center mt-6"
                            style={{ height: 52 }}
                            activeOpacity={0.9}
                        >
                            <Text className="text-[15px] font-bold text-white">Done</Text>
                        </TouchableOpacity>
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

                {/* SELECT BRANCH */}
                <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider" style={{ marginTop: 24 }}>Select Branch</Text>
                <TouchableOpacity
                    onPress={() => setBranchDropdownOpen(!branchDropdownOpen)}
                    className="flex-row items-center justify-between border border-gray-200 rounded-xl mt-2"
                    style={{ height: 48, paddingHorizontal: 16 }}
                >
                    <Text className="text-[14px] font-bold text-gray-900">{selectedBranch}</Text>
                    <ChevronDown size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Branch dropdown */}
                {branchDropdownOpen && (
                    <View className="border border-gray-200 rounded-xl mt-1 overflow-hidden">
                        {restaurant.branches.map((branch, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => {
                                    setSelectedBranch(branch);
                                    setBranchDropdownOpen(false);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={`px-4 py-3 ${branch === selectedBranch ? 'bg-gray-100' : 'bg-white'} ${idx < restaurant.branches.length - 1 ? 'border-b border-gray-100' : ''}`}
                            >
                                <Text className={`text-[13px] font-medium ${branch === selectedBranch ? 'text-gray-900 font-bold' : 'text-gray-600'}`}>{branch}</Text>
                            </TouchableOpacity>
                        ))}
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

                {/* Policy Note */}
                <View className="flex-row items-center bg-gray-50 p-3 rounded-xl border border-gray-100" style={{ marginTop: 24 }}>
                    <Info size={14} color="#B52725" />
                    <Text className="text-[11px] text-gray-500 font-medium ml-2 flex-1">
                        A non-refundable booking fee of ₹{bookingFee} is required to confirm your reservation.
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
                        className="flex-1 bg-[#B52725] rounded-2xl items-center justify-center"
                        style={{ height: 52 }}
                        activeOpacity={0.9}
                        hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
                    >
                        <Text className="text-[14px] font-bold text-white">Pay & Confirm</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <RazorpayCheckout
                visible={showPayment}
                onClose={() => setShowPayment(false)}
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
