// @lock — DO NOT EDIT WITHOUT EXPLICIT USER PERMISSION.
// Order Invoice Modal — V1 approved May 19, 2026.
// Covers: bottom-sheet tax-invoice display tapped from YourOrdersScreen order cards.
// Seller block (with merchant GSTIN from joined merchants.gst_number), buyer block,
// invoice meta (number/date/payment ref), items table for pickup OR booking-deposit
// row for dine-in, GST line (pickup only), totals, OTP PIN, legal disclaimer.
// PDF download is intentionally deferred until expo-print + expo-sharing are added in
// a future EAS Build (V1 ships via OTA without new native deps).
// Any change to invoice content, GSTIN display, branching by order_type, or layout
// REQUIRES explicit chat-confirmed approval. Hard lock — no edits, refactors, or
// "cleanups" without permission.
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { X, Ticket, MapPin } from 'lucide-react-native';
import { parseUtc } from '../utils/dateFormat';

interface InvoiceModalProps {
    visible: boolean;
    order: any | null;
    onClose: () => void;
}

const formatINR = (n: number) => `₹${(n || 0).toFixed(2)}`;

const formatDateTime = (ts: string | undefined) => {
    if (!ts) return '—';
    return parseUtc(ts).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const maskPaymentId = (id: string | undefined) => {
    if (!id) return null;
    if (id.length <= 8) return id;
    return `••••${id.slice(-8)}`;
};

const statusPill = (status: string | undefined) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'DELIVERED') return { label: 'COMPLETED', bg: 'bg-green-100', text: 'text-green-800' };
    if (s === 'CANCELLED') return { label: 'CANCELLED', bg: 'bg-red-100', text: 'text-red-800' };
    if (s === 'PENDING') return { label: 'CONFIRMED', bg: 'bg-gray-900', text: 'text-white' };
    if (s === 'ACCEPTED' || s === 'READY') return { label: s, bg: 'bg-yellow-100', text: 'text-yellow-900' };
    return { label: s || 'UNKNOWN', bg: 'bg-gray-100', text: 'text-gray-700' };
};

export default function InvoiceModal({ visible, order, onClose }: InvoiceModalProps) {
    if (!order) return null;

    const isDining = order.order_type === 'dine-in';
    const items: any[] = Array.isArray(order.order_items) ? order.order_items : [];
    const subtotal = isDining
        ? Number(order.amount) || 0
        : items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    const gst = isDining ? 0 : subtotal * 0.05;
    const total = isDining ? subtotal : subtotal + gst;
    const status = statusPill(order.status);
    const gstin = order.branch?.merchant?.gst_number;
    const paymentId = order.metadata?.razorpayPaymentId;
    const maskedPaymentId = maskPaymentId(paymentId);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1">
                <Pressable className="flex-1 bg-black/50" onPress={onClose} />
                <View className="bg-white rounded-t-[32px]" style={{ maxHeight: '90%' }}>
                    {/* Pinned header */}
                    <View className="px-6 pt-6 pb-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <View className="flex-1">
                                <Text className="text-[22px] font-bold text-gray-900">Tax Invoice</Text>
                                <Text className="text-[13px] text-gray-500 font-medium mt-0.5">Order #{order.order_number || '—'}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <View className={`px-3 py-1 rounded-full mr-3 ${status.bg}`}>
                                    <Text className={`text-[11px] font-extrabold uppercase ${status.text}`}>{status.label}</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
                                    <X size={20} color="#6B7280" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="border-b border-gray-100" />
                    </View>

                    {/* Scrollable body */}
                    <ScrollView className="px-6" contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
                        {/* Seller (Store) block */}
                        <View className="mb-5">
                            <Text className="text-[12px] text-gray-400 font-bold uppercase tracking-wider mb-2">Sold by</Text>
                            <Text className="text-[16px] font-bold text-gray-900">{order.store_name || '—'}</Text>
                            {order.branch?.address ? (
                                <Text className="text-[13px] text-gray-600 mt-1" numberOfLines={3}>
                                    {order.branch.address}{order.branch.city ? `, ${order.branch.city}` : ''}
                                </Text>
                            ) : null}
                            {order.branch?.manager_name ? (
                                <Text className="text-[12px] text-gray-500 mt-1">Manager: {order.branch.manager_name}</Text>
                            ) : null}
                            {order.branch?.phone ? (
                                <Text className="text-[12px] text-gray-500">Phone: {order.branch.phone}</Text>
                            ) : null}
                            <Text className="text-[12px] text-gray-500 mt-1">GSTIN: <Text className="font-mono font-bold text-gray-700">{gstin || '—'}</Text></Text>
                        </View>

                        <View className="border-b border-gray-100 mb-5" />

                        {/* Buyer block */}
                        <View className="mb-5">
                            <Text className="text-[12px] text-gray-400 font-bold uppercase tracking-wider mb-2">Billed to</Text>
                            <Text className="text-[15px] font-bold text-gray-900">{order.customer_name || '—'}</Text>
                            {order.customer_phone ? (
                                <Text className="text-[12px] text-gray-500 mt-0.5">{order.customer_phone}</Text>
                            ) : null}
                        </View>

                        <View className="border-b border-gray-100 mb-5" />

                        {/* Invoice meta */}
                        <View className="mb-5">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-[13px] text-gray-500 font-medium">Invoice Date</Text>
                                <Text className="text-[13px] text-gray-900 font-semibold">{formatDateTime(order.created_at)}</Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-[13px] text-gray-500 font-medium">Order Type</Text>
                                <Text className="text-[13px] text-gray-900 font-semibold">{isDining ? 'Dine-in' : 'Pickup'}</Text>
                            </View>
                            {isDining ? (
                                <>
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-[13px] text-gray-500 font-medium">Reservation Time</Text>
                                        <Text className="text-[13px] text-gray-900 font-semibold">{order.arrival_time || '—'}</Text>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-[13px] text-gray-500 font-medium">Guests</Text>
                                        <Text className="text-[13px] text-gray-900 font-semibold">{order.guests_count || 1}</Text>
                                    </View>
                                </>
                            ) : (
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-[13px] text-gray-500 font-medium">Arrival Time</Text>
                                    <Text className="text-[13px] text-gray-900 font-semibold">{order.arrival_time || 'ASAP'}</Text>
                                </View>
                            )}
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-[13px] text-gray-500 font-medium">Payment Method</Text>
                                <Text className="text-[13px] text-gray-900 font-semibold">{paymentId ? 'Razorpay' : 'Unpaid'}</Text>
                            </View>
                            {maskedPaymentId ? (
                                <View className="flex-row justify-between">
                                    <Text className="text-[13px] text-gray-500 font-medium">Payment Ref</Text>
                                    <Text className="text-[13px] text-gray-900 font-mono">{maskedPaymentId}</Text>
                                </View>
                            ) : null}
                            {order.special_instructions ? (
                                <View className="mt-3 bg-gray-50 rounded-xl p-3">
                                    <Text className="text-[11px] text-gray-400 font-bold uppercase mb-1">Special Instructions</Text>
                                    <Text className="text-[13px] text-gray-700">{order.special_instructions}</Text>
                                </View>
                            ) : null}
                        </View>

                        <View className="border-b border-gray-100 mb-5" />

                        {/* Items / Booking Deposit */}
                        <View className="mb-5">
                            <Text className="text-[12px] text-gray-400 font-bold uppercase tracking-wider mb-3">
                                {isDining ? 'Booking' : 'Items'}
                            </Text>
                            {isDining ? (
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-1 pr-3">
                                        <Text className="text-[14px] text-gray-900 font-semibold">Booking Deposit</Text>
                                        <Text className="text-[12px] text-gray-500 mt-0.5">
                                            Reservation for {order.guests_count || 1} {(order.guests_count || 1) === 1 ? 'guest' : 'guests'}
                                        </Text>
                                    </View>
                                    <Text className="text-[14px] text-gray-900 font-semibold">{formatINR(subtotal)}</Text>
                                </View>
                            ) : items.length === 0 ? (
                                <Text className="text-[13px] text-gray-400 italic">No items recorded.</Text>
                            ) : (
                                items.map((it: any, idx: number) => {
                                    const qty = Number(it.quantity) || 0;
                                    const unit = Number(it.price) || 0;
                                    const line = qty * unit;
                                    return (
                                        <View key={it.id || idx} className="flex-row justify-between items-start mb-2.5">
                                            <View className="flex-1 pr-3">
                                                <Text className="text-[14px] text-gray-900 font-semibold" numberOfLines={2}>{it.product_name || 'Item'}</Text>
                                                <Text className="text-[12px] text-gray-500 mt-0.5">{qty} × {formatINR(unit)}</Text>
                                            </View>
                                            <Text className="text-[14px] text-gray-900 font-semibold">{formatINR(line)}</Text>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        <View className="border-b border-gray-100 mb-5" />

                        {/* Charges */}
                        <View className="mb-5">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-[13px] text-gray-500 font-medium">Subtotal</Text>
                                <Text className="text-[13px] text-gray-900 font-semibold">{formatINR(subtotal)}</Text>
                            </View>
                            {!isDining && (
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-[13px] text-gray-500 font-medium">GST (5%)</Text>
                                    <Text className="text-[13px] text-gray-900 font-semibold">{formatINR(gst)}</Text>
                                </View>
                            )}
                            <View className="border-b border-gray-200 my-2" />
                            <View className="flex-row justify-between items-center">
                                <Text className="text-[16px] font-bold text-gray-900">
                                    {isDining ? 'Booking Deposit' : 'Total'}
                                </Text>
                                <Text className="text-[20px] font-bold text-[#B52725]">{formatINR(total)}</Text>
                            </View>
                        </View>

                        {/* OTP PIN */}
                        {order.otp_code ? (
                            <View className="bg-gray-50 rounded-2xl p-4 flex-row items-center justify-between border border-gray-100 mb-5">
                                <View className="flex-row items-center">
                                    <View className="w-9 h-9 rounded-full bg-white items-center justify-center border border-gray-200">
                                        <Ticket size={16} color="#B52725" />
                                    </View>
                                    <View className="ml-3">
                                        <Text className="text-[10px] font-bold text-gray-400 uppercase">OTP PIN</Text>
                                        <Text className="text-[18px] font-bold text-gray-900 tracking-[2px]">{order.otp_code}</Text>
                                    </View>
                                </View>
                                <Text className="text-[11px] text-gray-400 font-medium">Share at counter</Text>
                            </View>
                        ) : null}

                        {/* Disclaimer */}
                        <Text className="text-[11px] text-gray-400 text-center font-medium leading-relaxed mb-2">
                            This is a computer-generated invoice. No signature required.
                        </Text>
                        <Text className="text-[11px] text-gray-400 text-center font-medium leading-relaxed mb-6">
                            For queries, contact the store directly using the details above.
                        </Text>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
