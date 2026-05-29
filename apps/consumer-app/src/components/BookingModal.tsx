// @lock — Do NOT overwrite. Layout fix approved May 19, 2026. Pinned header (title + restaurant) and footer (note + CTAs), scrollable middle content.
import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, Modal, Pressable,
    Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { Minus, Plus, ChevronDown, CheckCircle, Info, MapPin, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import RazorpayCheckout from './RazorpayCheckout';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import TransactionalAuthModal from './TransactionalAuthModal';
import { useSlotAvailability, Slot } from '../hooks/useSlotAvailability';

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

export default function BookingModal({ visible, onClose, restaurant }: BookingModalProps) {
    const navigation = useNavigation<any>();
    const [step, setStep] = useState<'form' | 'confirmed'>('form');
    const [branchesData, setBranchesData] = useState<{ id: string; name: string; address?: string; operating_hours?: any; service_table_booking?: boolean }[]>([]);
    const [branchesLoading, setBranchesLoading] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [guestCount, setGuestCount] = useState(2);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [razorpayOrderId, setRazorpayOrderId] = useState<string | undefined>();
    const [bookingOtp, setBookingOtp] = useState('');
    const [bookingId, setBookingId] = useState('');

    // Resolve selected branch ID
    const selectedBranchData = branchesData.find(b => b.name === selectedBranch);
    const activeBranchId = selectedBranchData?.id || (branchesData.length === 1 ? branchesData[0]?.id : null);

    // Slot availability hook
    const { slots, loading: slotsLoading, available: slotsAvailable } = useSlotAvailability(
        visible ? activeBranchId : null,
        visible ? selectedDate : null
    );

    // Booking Fee Calculation: ₹25 per 2 guests, capped at ₹100
    const bookingFee = Math.min(100, Math.ceil(guestCount / 2) * 25);

    const hasBranches = branchesData.length > 1;

    // Date options: 7 days from today
    const dateOptions = useMemo(() => {
        const options: { date: string; label: string; dayLabel: string }[] = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            const iso = d.toISOString().slice(0, 10);
            const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
            options.push({ date: iso, label, dayLabel });
        }
        return options;
    }, []);

    // Fetch branches dynamically when modal opens
    useEffect(() => {
        if (!visible) return;

        // Reset all form state
        setStep('form');
        setBranchDropdownOpen(false);
        setGuestCount(2);
        setSelectedDate(new Date().toISOString().slice(0, 10));
        setSelectedSlot(null);
        setShowPayment(false);
        setBookingOtp('');
        setBookingId('');

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
                    .select('id, branch_name, address, operating_hours, service_table_booking')
                    .eq('merchant_id', restaurant.merchantId)
                    .eq('is_active', true)
                    .eq('service_table_booking', true);

                if (error) throw error;

                if (data && data.length > 0) {
                    const mapped = data.map(b => ({
                        id: b.id,
                        name: b.branch_name,
                        address: b.address || undefined,
                        operating_hours: b.operating_hours || null,
                        service_table_booking: b.service_table_booking
                    }));
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

    // Reset selected slot when date changes
    useEffect(() => {
        setSelectedSlot(null);
    }, [selectedDate]);

    const formatTime12h = (time24: string) => {
        const [h, m] = time24.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    // Check if a slot is in the past (for today only)
    const isSlotPast = (slotTime: string) => {
        const today = new Date().toISOString().slice(0, 10);
        if (selectedDate !== today) return false;
        const now = new Date();
        const [h, m] = slotTime.split(':').map(Number);
        return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
    };

    const handleConfirm = async () => {
        if (!selectedSlot || !activeBranchId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        let { data: { session } } = await supabase.auth.getSession();

        const tokenExpired = session?.expires_at
            ? (session.expires_at * 1000) - Date.now() < 60_000
            : true;

        if (!session || tokenExpired) {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData.session) {
                setAuthModalVisible(true);
                return;
            }
            session = refreshData.session;
        }

        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            const res = await fetch(`${apiUrl}/payments/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: bookingFee, type: 'consumer', userId: session.user?.id })
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

    const handlePaymentSuccess = async (paymentId: string, orderId?: string, signature?: string) => {
        try {
            let { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                const { data: refreshData } = await supabase.auth.refreshSession();
                session = refreshData.session;
            }
            if (!session) {
                Alert.alert('Error', 'Session expired. Please try again.');
                setShowPayment(false);
                return;
            }

            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            const user = session.user;

            // Call the new /bookings/reserve endpoint
            const reserveRes = await fetch(`${apiUrl}/bookings/reserve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    branchId: activeBranchId,
                    slotDate: selectedDate,
                    slotTime: selectedSlot,
                    guestsCount: guestCount,
                    bookingFee,
                    razorpayOrderId: orderId,
                    razorpayPaymentId: paymentId,
                    razorpaySignature: signature,
                    customerName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Guest',
                    customerPhone: user.phone || ''
                })
            });

            const reserveData = await reserveRes.json();

            if (!reserveRes.ok || !reserveData.success) {
                // Slot was full — auto-refunded
                if (reserveData.refunded) {
                    Alert.alert(
                        'Slot Unavailable',
                        'This slot was just booked by someone else. Your payment of ₹' + bookingFee + ' will be refunded within 5-7 business days.',
                        [{ text: 'Choose Another Slot' }]
                    );
                } else {
                    Alert.alert('Booking Error', reserveData.error || 'Failed to reserve table.');
                }
                setShowPayment(false);
                return;
            }

            setBookingOtp(reserveData.otp || '');
            setBookingId(reserveData.bookingId || '');
        } catch (error) {
            console.error('Reserve booking error:', error);
            Alert.alert('Error', 'Booking could not be completed. If payment was deducted, it will be refunded.');
        }

        setShowPayment(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('confirmed');
    };

    const handlePaymentError = (error: string) => {
        setShowPayment(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Payment Failed', error || 'No money was deducted. Please try again.', [{ text: 'OK' }]);
    };

    const handlePaymentDismiss = () => {
        setShowPayment(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Payment Cancelled', 'No money was deducted.', [{ text: 'OK' }]);
    };

    const handleDone = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onClose();
    };

    const handleCancel = () => {
        setBranchDropdownOpen(false);
        onClose();
    };

    // ==================== CONFIRMATION STEP ====================
    if (step === 'confirmed') {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View className="bg-white rounded-3xl mx-6" style={{ width: '88%', maxHeight: '85%' }}>
                        <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
                            <View className="items-center mb-5">
                                <View className="w-14 h-14 rounded-full bg-green-50 items-center justify-center mb-3">
                                    <CheckCircle size={32} color="#16A34A" />
                                </View>
                                <Text className="text-[22px] font-bold text-gray-900 text-center">Booking Confirmed!</Text>
                                <Text className="text-[13px] text-gray-500 font-medium text-center mt-1">Your table has been reserved</Text>
                            </View>

                            {/* OTP Card */}
                            {bookingOtp ? (
                                <View className="w-full bg-[#FEF2F2] rounded-2xl border-2 border-[#FECACA] items-center mb-4" style={{ paddingVertical: 24, paddingHorizontal: 20 }}>
                                    <Text className="text-[11px] font-bold text-[#B52725] uppercase tracking-wider mb-2">Show this at the restaurant</Text>
                                    <Text className="text-[40px] font-bold text-[#B52725] tracking-[8px]">{bookingOtp}</Text>
                                </View>
                            ) : null}

                            {/* Details */}
                            <View className="w-full bg-gray-50 rounded-2xl" style={{ paddingVertical: 14, paddingHorizontal: 18 }}>
                                <DetailRow label="Restaurant" value={restaurant.name} />
                                <DetailRow label="Date" value={dateOptions.find(d => d.date === selectedDate)?.label || selectedDate} />
                                <DetailRow label="Time" value={selectedSlot ? formatTime12h(selectedSlot) : ''} />
                                <DetailRow label="Guests" value={`${guestCount} ${guestCount === 1 ? 'Person' : 'People'}`} />
                                <DetailRow label="Deposit Paid" value={`₹${bookingFee}`} isLast />
                            </View>

                            <Text className="text-[11px] text-gray-400 font-medium text-center mt-4 px-2">
                                Please arrive 10 minutes before your reservation time.
                            </Text>

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
            />
            <View
                className="bg-white rounded-t-3xl"
                style={{
                    paddingTop: 12,
                    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
                    maxHeight: '85%',
                }}
            >
                {/* ===== PINNED HEADER ===== */}
                <View style={{ paddingHorizontal: 24 }}>
                    {/* Drag handle */}
                    <View className="items-center mb-4">
                        <View className="w-10 h-1 bg-gray-300 rounded-full" />
                    </View>

                    {/* Modal title */}
                    <Text className="text-[20px] font-bold text-gray-900">Book a Table</Text>

                    {/* Restaurant info — compact */}
                    <Text className="text-[14px] font-semibold text-gray-700" style={{ marginTop: 6 }}>{restaurant.name}</Text>
                    <Text className="text-[12px] text-gray-400 font-medium" style={{ marginTop: 2, marginBottom: 16 }}>{restaurant.address}</Text>

                    <View className="h-[1px] bg-gray-100" />
                </View>

                {/* ===== SCROLLABLE CONTENT ===== */}
                <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 24 }}>

                    {/* SELECT BRANCH */}
                    {branchesLoading ? (
                        <View className="items-center py-4">
                            <ActivityIndicator size="small" color="#9CA3AF" />
                        </View>
                    ) : hasBranches ? (
                        <>
                            <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider" style={{ marginTop: 20 }}>Select Branch</Text>
                            <TouchableOpacity
                                onPress={() => setBranchDropdownOpen(!branchDropdownOpen)}
                                className="flex-row items-center justify-between border border-gray-200 rounded-xl mt-2"
                                style={{ height: 48, paddingHorizontal: 16 }}
                            >
                                <Text className="text-[14px] font-bold text-gray-900">{selectedBranch}</Text>
                                <ChevronDown size={18} color="#9CA3AF" />
                            </TouchableOpacity>

                            {branchDropdownOpen && (
                                <View className="border border-gray-200 rounded-xl mt-1 overflow-hidden">
                                    {branchesData.map((branch, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            onPress={() => {
                                                setSelectedBranch(branch.name);
                                                setBranchDropdownOpen(false);
                                                setSelectedSlot(null);
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }}
                                            className={`px-4 py-3 ${branch.name === selectedBranch ? 'bg-gray-100' : 'bg-white'} ${idx < branchesData.length - 1 ? 'border-b border-gray-100' : ''}`}
                                        >
                                            <Text className={`text-[13px] font-medium ${branch.name === selectedBranch ? 'text-gray-900 font-bold' : 'text-gray-600'}`}>{branch.name}</Text>
                                            {branch.address && (
                                                <Text className="text-[11px] text-gray-400 mt-0.5" numberOfLines={1}>{branch.address}</Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </>
                    ) : branchesData.length === 1 ? (
                        <View className="flex-row items-start bg-gray-50 rounded-xl p-4 border border-gray-100" style={{ marginTop: 16 }}>
                            <MapPin size={18} color="#B52725" style={{ marginTop: 2 }} />
                            <View className="ml-3 flex-1">
                                <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Location</Text>
                                <Text className="text-[14px] font-semibold text-gray-900 mt-1" numberOfLines={2}>{branchesData[0]?.address || restaurant.address}</Text>
                            </View>
                        </View>
                    ) : null}

                    {/* GUESTS & FEE */}
                    <View className="flex-row items-center justify-between" style={{ marginTop: 20 }}>
                        <View>
                            <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Guests</Text>
                            <View className="flex-row items-center mt-2">
                                <TouchableOpacity
                                    onPress={() => { if (guestCount > 1) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGuestCount(guestCount - 1); } }}
                                    className={`w-9 h-9 rounded-xl border items-center justify-center ${guestCount <= 1 ? 'border-gray-100' : 'border-gray-300'}`}
                                >
                                    <Minus size={14} color={guestCount <= 1 ? '#D1D5DB' : '#374151'} />
                                </TouchableOpacity>
                                <Text className="text-[18px] font-bold text-gray-900 mx-4">{guestCount}</Text>
                                <TouchableOpacity
                                    onPress={() => { if (guestCount < 20) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGuestCount(guestCount + 1); } }}
                                    className={`w-9 h-9 rounded-xl border items-center justify-center ${guestCount >= 20 ? 'border-gray-100' : 'border-gray-300'}`}
                                >
                                    <Plus size={14} color={guestCount >= 20 ? '#D1D5DB' : '#374151'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Booking Fee</Text>
                            <Text className="text-[20px] font-bold text-[#B52725] mt-2">₹{bookingFee}</Text>
                        </View>
                    </View>

                    {/* DATE SELECTOR — horizontal scroll chips */}
                    <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider" style={{ marginTop: 20 }}>Select Date</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {dateOptions.map((opt) => {
                                const isActive = opt.date === selectedDate;
                                return (
                                    <TouchableOpacity
                                        key={opt.date}
                                        onPress={() => { setSelectedDate(opt.date); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 10,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: isActive ? '#B52725' : '#E5E7EB',
                                            backgroundColor: isActive ? '#FEF2F2' : '#fff',
                                            alignItems: 'center',
                                            minWidth: 60,
                                        }}
                                    >
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: isActive ? '#B52725' : '#9CA3AF' }}>{opt.dayLabel}</Text>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#B52725' : '#374151', marginTop: 2 }}>{opt.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* SLOT GRID */}
                    <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider" style={{ marginTop: 20 }}>Select Time Slot</Text>
                    {slotsLoading ? (
                        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#B52725" />
                            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Loading slots...</Text>
                        </View>
                    ) : !slotsAvailable || slots.length === 0 ? (
                        <View className="bg-gray-50 rounded-xl p-4 items-center" style={{ marginTop: 8 }}>
                            <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                                No booking slots available for this date.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                            {slots.map((slot) => {
                                const isFull = slot.remaining <= 0;
                                const isPast = isSlotPast(slot.time);
                                const isSelected = selectedSlot === slot.time;
                                const isDisabled = isFull || isPast;

                                return (
                                    <TouchableOpacity
                                        key={slot.time}
                                        onPress={() => {
                                            if (!isDisabled) {
                                                setSelectedSlot(slot.time);
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }
                                        }}
                                        disabled={isDisabled}
                                        style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 10,
                                            borderRadius: 10,
                                            borderWidth: 1.5,
                                            borderColor: isSelected ? '#B52725' : isDisabled ? '#F3F4F6' : '#E5E7EB',
                                            backgroundColor: isSelected ? '#FEF2F2' : isDisabled ? '#F9FAFB' : '#fff',
                                            opacity: isDisabled ? 0.5 : 1,
                                            alignItems: 'center',
                                            minWidth: 80,
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 13,
                                            fontWeight: '700',
                                            color: isSelected ? '#B52725' : isDisabled ? '#9CA3AF' : '#374151'
                                        }}>
                                            {formatTime12h(slot.time)}
                                        </Text>
                                        <Text style={{
                                            fontSize: 10,
                                            fontWeight: '600',
                                            color: isFull ? '#DC2626' : slot.remaining <= 1 ? '#D97706' : '#059669',
                                            marginTop: 2
                                        }}>
                                            {isFull ? 'Full' : `${slot.remaining} left`}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <View style={{ height: 16 }} />
                </ScrollView>

                {/* ===== PINNED FOOTER ===== */}
                <View style={{ paddingHorizontal: 24, paddingTop: 12 }} className="border-t border-gray-100">
                    {/* Policy Note */}
                    <View className="flex-row items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <Info size={14} color="#B52725" />
                        <Text className="text-[11px] text-gray-500 font-medium ml-2 flex-1">
                            A ₹{bookingFee} booking deposit will be adjusted in your final bill at the restaurant.
                        </Text>
                    </View>

                    {/* Action buttons */}
                    <View className="flex-row gap-3" style={{ marginTop: 12 }}>
                        <TouchableOpacity
                            onPress={handleCancel}
                            className="flex-1 border border-gray-200 rounded-2xl items-center justify-center"
                            style={{ height: 52 }}
                        >
                            <Text className="text-[14px] font-bold text-gray-700">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleConfirm}
                            className={`flex-1 rounded-2xl items-center justify-center ${selectedSlot ? 'bg-[#B52725]' : 'bg-gray-300'}`}
                            style={{ height: 52 }}
                            activeOpacity={0.9}
                            disabled={!selectedSlot}
                        >
                            <Text className="text-[14px] font-bold text-white">{selectedSlot ? 'Pay & Confirm' : 'Select a Slot'}</Text>
                        </TouchableOpacity>
                    </View>
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
