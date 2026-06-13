import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStoreContext } from '../../../src/context/StoreContext';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface Booking {
    id: string;
    slotDate: string;
    slotTime: string;
    guestsCount: number;
    bookingFee: number;
    status: string;
    customerName: string | null;
    customerPhone: string | null;
    otp: string;
    createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    CONFIRMED: { bg: '#DBEAFE', text: '#1E40AF' },
    COMPLETED: { bg: '#D1FAE5', text: '#065F46' },
    CANCELLED: { bg: '#FEE2E2', text: '#991B1B' },
    NO_SHOW: { bg: '#FEF3C7', text: '#92400E' },
};

export default function BookingsScreen() {
    const { store, activeStoreId } = useStoreContext();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [summary, setSummary] = useState({ total: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [otpInput, setOtpInput] = useState<string>('');
    const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

    const fetchBookings = useCallback(async () => {
        if (!activeStoreId) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_URL}/bookings/merchant?branchId=${activeStoreId}&date=${selectedDate}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setBookings(data.bookings || []);
                setSummary(data.summary || { total: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 });
            }
        } catch (err) {
            console.error('Failed to fetch bookings:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeStoreId, selectedDate]);

    useEffect(() => {
        setLoading(true);
        fetchBookings();
    }, [fetchBookings]);

    // Realtime subscription
    useEffect(() => {
        if (!activeStoreId) return;

        const channel = supabase
            .channel('table_bookings_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'table_bookings',
                filter: `branch_id=eq.${activeStoreId}`
            }, () => {
                fetchBookings();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeStoreId, fetchBookings]);

    const updateStatus = async (bookingId: string, status: string, otp?: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const body: any = { status };
            if (otp) body.otp = otp;

            const res = await fetch(`${API_URL}/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!res.ok) {
                Alert.alert('Error', data.error || 'Failed to update status');
                return;
            }

            setActiveBookingId(null);
            setOtpInput('');
            fetchBookings();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    const handleMarkArrived = (booking: Booking) => {
        setActiveBookingId(booking.id);
        setOtpInput('');
    };

    const confirmOtp = () => {
        if (!activeBookingId || otpInput.length !== 4) return;
        updateStatus(activeBookingId, 'COMPLETED', otpInput);
    };

    const handleNoShow = (booking: Booking) => {
        Alert.alert('Mark No Show?', `Mark ${booking.customerName || 'Customer'} as no-show?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', style: 'destructive', onPress: () => updateStatus(booking.id, 'NO_SHOW') }
        ]);
    };

    const handleCancel = (booking: Booking) => {
        Alert.alert('Cancel Booking?', `This will refund ₹${booking.bookingFee} to the customer.`, [
            { text: 'Keep', style: 'cancel' },
            { text: 'Cancel Booking', style: 'destructive', onPress: () => updateStatus(booking.id, 'CANCELLED') }
        ]);
    };

    const formatTime12h = (time24: string) => {
        const [h, m] = time24.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    // Date navigation
    const shiftDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().slice(0, 10));
    };

    const isToday = selectedDate === new Date().toISOString().slice(0, 10);

    if (!store?.service_table_booking) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Bookings</Text>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                    <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 16, textAlign: 'center' }}>
                        Table Booking is disabled
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
                        Enable "Table Booking" in Store Timings to start receiving reservations.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Bookings</Text>
            </View>

            {/* Date Selector */}
            <View style={styles.dateRow}>
                <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateArrow}>
                    <Ionicons name="chevron-back" size={20} color={Colors.text} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.dateText}>
                        {isToday ? 'Today' : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{selectedDate}</Text>
                </View>
                <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateArrow}>
                    <Ionicons name="chevron-forward" size={20} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {/* Summary */}
            <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: '#DBEAFE' }]}>
                    <Text style={[styles.summaryCount, { color: '#1E40AF' }]}>{summary.confirmed}</Text>
                    <Text style={styles.summaryLabel}>Upcoming</Text>
                </View>
                <View style={[styles.summaryChip, { backgroundColor: '#D1FAE5' }]}>
                    <Text style={[styles.summaryCount, { color: '#065F46' }]}>{summary.completed}</Text>
                    <Text style={styles.summaryLabel}>Completed</Text>
                </View>
                <View style={[styles.summaryChip, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.summaryCount, { color: '#92400E' }]}>{summary.noShow}</Text>
                    <Text style={styles.summaryLabel}>No Show</Text>
                </View>
                <View style={[styles.summaryChip, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.summaryCount, { color: '#991B1B' }]}>{summary.cancelled}</Text>
                    <Text style={styles.summaryLabel}>Cancelled</Text>
                </View>
            </View>

            {/* Bookings List */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
            <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} />}
            >
                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
                ) : bookings.length === 0 ? (
                    <View style={{ alignItems: 'center', marginTop: 60 }}>
                        <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
                        <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 12 }}>No bookings for this date</Text>
                    </View>
                ) : (
                    bookings.map((booking) => (
                        <View key={booking.id} style={styles.bookingCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                                    <Text style={styles.bookingTime}>{formatTime12h(booking.slotTime)}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[booking.status]?.bg || '#F3F4F6' }]}>
                                    <Text style={[styles.statusText, { color: STATUS_COLORS[booking.status]?.text || '#374151' }]}>
                                        {booking.status}
                                    </Text>
                                </View>
                            </View>

                            <View style={{ marginTop: 12, gap: 4 }}>
                                <Text style={styles.customerName}>{booking.customerName || 'Guest'}</Text>
                                <Text style={styles.customerDetail}>
                                    {booking.customerPhone || 'No phone'} • {booking.guestsCount} guests • ₹{booking.bookingFee}
                                </Text>
                            </View>

                            {/* OTP Input (for completing) */}
                            {activeBookingId === booking.id && (
                                <View style={styles.otpRow}>
                                    <TextInput
                                        style={styles.otpInput}
                                        placeholder="Enter 4-digit OTP"
                                        placeholderTextColor="#9CA3AF"
                                        value={otpInput}
                                        onChangeText={setOtpInput}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        autoFocus
                                    />
                                    <TouchableOpacity
                                        style={[styles.otpConfirm, otpInput.length !== 4 && { opacity: 0.5 }]}
                                        onPress={confirmOtp}
                                        disabled={otpInput.length !== 4}
                                    >
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.otpCancel}
                                        onPress={() => { setActiveBookingId(null); setOtpInput(''); }}
                                    >
                                        <Ionicons name="close" size={20} color="#666" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Actions */}
                            {booking.status === 'CONFIRMED' && activeBookingId !== booking.id && (
                                <View style={styles.actionRow}>
                                    <TouchableOpacity style={styles.actionButton} onPress={() => handleMarkArrived(booking)}>
                                        <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
                                        <Text style={[styles.actionText, { color: '#059669' }]}>Arrived</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.actionButton} onPress={() => handleNoShow(booking)}>
                                        <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
                                        <Text style={[styles.actionText, { color: '#D97706' }]}>No Show</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.actionButton} onPress={() => handleCancel(booking)}>
                                        <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                                        <Text style={[styles.actionText, { color: '#DC2626' }]}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },

    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    dateArrow: { padding: 8 },
    dateText: { fontSize: 16, fontWeight: '700', color: Colors.text },

    summaryRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    summaryChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    summaryCount: { fontSize: 18, fontWeight: '700' },
    summaryLabel: { fontSize: 10, fontWeight: '600', color: '#6B7280', marginTop: 2 },

    bookingCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
    bookingTime: { fontSize: 15, fontWeight: '700', color: Colors.text },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: '700' },
    customerName: { fontSize: 15, fontWeight: '600', color: Colors.text },
    customerDetail: { fontSize: 13, color: Colors.textSecondary },

    actionRow: { flexDirection: 'row', marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
    actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F9FAFB' },
    actionText: { fontSize: 12, fontWeight: '600' },

    otpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
    otpInput: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, fontSize: 18, fontWeight: '700', letterSpacing: 4, borderWidth: 1, borderColor: Colors.border },
    otpConfirm: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' },
    otpCancel: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
});
