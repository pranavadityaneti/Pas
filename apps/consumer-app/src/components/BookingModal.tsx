// BookingModal: Two-step modal — booking form (bottom sheet) → confirmation card.
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, Modal, Pressable,
    Platform
} from 'react-native';
import { Minus, Plus, ChevronDown, CheckCircle } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

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
    const [step, setStep] = useState<'form' | 'confirmed'>('form');
    const [selectedBranch, setSelectedBranch] = useState(restaurant.branches[0] || '');
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [guestCount, setGuestCount] = useState(2);
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(getDefaultTime);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

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
        }
    }, [visible, restaurant.id]);

    // Max date: 7 days from now
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);

    const handleConfirm = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowDatePicker(false);
        setShowTimePicker(false);
        setStep('confirmed');
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
                            <DetailRow label="Guests" value={`${guestCount} ${guestCount === 1 ? 'Person' : 'People'}`} isLast />
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
            <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={handleCancel} />
            <View className="bg-white rounded-t-3xl" style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
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

                {/* NUMBER OF GUESTS */}
                <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider" style={{ marginTop: 20 }}>Number of Guests</Text>
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

                {/* DATE & TIME */}
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

                {/* Action buttons */}
                <View className="flex-row gap-3" style={{ marginTop: 24 }}>
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
                    >
                        <Text className="text-[14px] font-bold text-white">Confirm Booking</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
