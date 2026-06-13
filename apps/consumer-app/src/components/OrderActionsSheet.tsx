/**
 * OrderActionsSheet — customer-side actions on a placed order.
 *
 * 2026-06-05 (WS2.E): Single bottom-sheet that branches into 4 flows.
 * Replaces having multiple modal screens for cancel/reschedule/return/
 * exchange — one component, branching by selected action keeps the
 * surface area small.
 *
 * Opened from YourOrdersScreen's per-order "Manage" button. The
 * locked InvoiceModal handles the invoice/details path; this component
 * handles the lifecycle actions. They coexist — separate Manage and tap-
 * to-view-invoice intents.
 *
 * Endpoints (WS2.C):
 *   - POST /orders/:id/cancel
 *   - POST /orders/:id/reschedule
 *   - POST /orders/:id/return
 *   - POST /orders/:id/exchange
 *
 * v0 scope: forms are functional minimums (text inputs + reason picker).
 * Photo upload for returns deferred to v0.1 — server already accepts an
 * empty photos[] array (the damaged-reason photoCount check is the only
 * hard gate). Customer can use the description field to compensate.
 */

import React, { useMemo, useState } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Modal, Pressable,
    TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { X, Ban, Calendar, RotateCcw, RefreshCw, ChevronLeft } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiClient } from '../lib/api';

type Action = 'menu' | 'cancel' | 'reschedule' | 'return' | 'exchange';

interface Props {
    visible: boolean;
    order: any | null;
    onClose: () => void;
    onSuccess?: (resultPayload: any) => void;
}

// Reason codes — mirror of WS2.B rules.ts.
//
// 2026-06-05: 'damaged' is intentionally omitted here. The server requires
// at least one photo for 'damaged' returns, but the customer-app doesn't
// have a photo upload picker yet (v0.1 work). Surfacing the chip would
// trap the customer in a dead-end where the server rejects every submit.
// Customers with damaged items should pick 'Quality issue' and describe
// the damage in the description field until photo upload ships.
const RETURN_REASONS = [
    { code: 'missing_item', label: 'Missing item' },
    { code: 'wrong_item', label: 'Wrong item' },
    { code: 'quality_issue', label: 'Quality issue' },
    { code: 'expired', label: 'Expired' },
    { code: 'changed_mind', label: 'Changed mind' },
] as const;

const EXCHANGE_REASONS = [
    { code: 'wrong_size', label: 'Wrong size' },
    { code: 'wrong_color', label: 'Wrong color' },
    { code: 'wrong_variant', label: 'Wrong variant' },
    { code: 'changed_mind', label: 'Changed mind' },
    { code: 'defective', label: 'Defective' },
] as const;

// What actions are even SHOWN for this order's current state. The server
// still validates; this is just to grey out actions the customer can't
// take from this state.
//
// 2026-06-05 updates:
//   - Added 'REJECTED' to the cancellable disallow list (Bug 6 — a
//     merchant-rejected order should not be cancellable).
//   - Dropped the `t === 'pickup'` qualifier on the READY block — any
//     READY order (pickup, takeaway, delivery) cannot be cancelled
//     because the merchant has already incurred full cost (Bug 7).
//   - Reschedule limited to slot-based orders (pickup/dine-in) — server
//     would reject takeaway/delivery anyway because they have no slot.
function availableActions(orderStatus: string, orderType: string | null): Record<Action, boolean> {
    const s = (orderStatus || '').toUpperCase();
    const t = (orderType || 'pickup').toLowerCase();

    const terminalStates = [
        'COMPLETED', 'CANCELLED', 'REJECTED', 'REFUNDED',
        'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED',
        'EXCHANGE_REQUESTED', 'EXCHANGE_APPROVED', 'EXCHANGE_REJECTED',
    ];
    const cancellable = !terminalStates.includes(s) && s !== 'READY';
    const reschedulable = ['PENDING', 'CONFIRMED'].includes(s) && (t === 'pickup' || t === 'dine-in');
    const returnable = s === 'COMPLETED';
    const exchangeable = s === 'COMPLETED';

    return { menu: true, cancel: cancellable, reschedule: reschedulable, return: returnable, exchange: exchangeable };
}

export default function OrderActionsSheet({ visible, order, onClose, onSuccess }: Props) {
    const [action, setAction] = useState<Action>('menu');
    const [submitting, setSubmitting] = useState(false);

    // Form state — reset whenever sheet closes.
    const [cancelReason, setCancelReason] = useState('');
    const [newSlot, setNewSlot] = useState<Date>(() => new Date(Date.now() + 60 * 60_000)); // +1h default
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [returnReason, setReturnReason] = useState<string>(RETURN_REASONS[0].code);
    const [returnDescription, setReturnDescription] = useState('');
    const [returnRefundInr, setReturnRefundInr] = useState('');
    const [exchangeReason, setExchangeReason] = useState<string>(EXCHANGE_REASONS[0].code);
    const [exchangeDescription, setExchangeDescription] = useState('');

    const orderId = order?.id;
    const orderStatus = order?.status || '';
    const orderType = order?.order_type || 'pickup';
    const orderTotal = Number(order?.totalAmount ?? order?.total_amount ?? order?.amount ?? 0);

    const can = useMemo(() => availableActions(orderStatus, orderType), [orderStatus, orderType]);

    const resetAndClose = () => {
        setAction('menu');
        setCancelReason('');
        setReturnReason(RETURN_REASONS[0].code);
        setReturnDescription('');
        setReturnRefundInr('');
        setExchangeReason(EXCHANGE_REASONS[0].code);
        setExchangeDescription('');
        onClose();
    };

    const handleSubmit = async () => {
        if (!orderId) return;
        setSubmitting(true);
        try {
            let path = '';
            let body: any = {};
            if (action === 'cancel') {
                path = `/orders/${orderId}/cancel`;
                body = cancelReason ? { reason: cancelReason } : {};
            } else if (action === 'reschedule') {
                path = `/orders/${orderId}/reschedule`;
                body = { newSlotAt: newSlot.toISOString() };
            } else if (action === 'return') {
                const refund = Number(returnRefundInr);
                if (!Number.isFinite(refund) || refund <= 0) {
                    Alert.alert('Enter a refund amount', 'Please enter the amount you\'re requesting.');
                    setSubmitting(false);
                    return;
                }
                path = `/orders/${orderId}/return`;
                body = {
                    reason: returnReason,
                    description: returnDescription || undefined,
                    photos: [],
                    refundInr: Math.floor(refund),
                };
            } else if (action === 'exchange') {
                path = `/orders/${orderId}/exchange`;
                body = { reason: exchangeReason, description: exchangeDescription || undefined };
            }

            const res = await apiClient.fetch(path, { method: 'POST', body: JSON.stringify(body) });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.error || 'Request failed.');
            }
            // Build a friendly success message per action
            let msg = 'Request submitted.';
            if (action === 'cancel') {
                msg = json?.cancellation?.autoRefundEligible
                    ? `Cancelled. Full refund of ₹${json.cancellation.refundInr} on the way.`
                    : `Cancelled. Refund ₹${json.cancellation?.refundInr ?? 0} (fee ₹${json.cancellation?.feeInr ?? 0}).`;
            } else if (action === 'reschedule') {
                msg = 'Slot updated. The store has been notified.';
            } else if (action === 'return') {
                msg = json?.return?.refundWithoutReturn
                    ? 'Return approved provisionally. No need to bring the item back — refund pending merchant review (24h SLA).'
                    : 'Return request sent. Drop the item back at the store; refund processes after merchant approves.';
            } else if (action === 'exchange') {
                msg = 'Exchange request sent. Visit the store within 24 hours.';
            }
            Alert.alert('Done', msg);
            onSuccess?.(json);
            resetAndClose();
        } catch (err: any) {
            Alert.alert('Could not complete', err?.message || 'Try again in a moment.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!order) return null;

    // ── Menu (4 buttons) ────────────────────────────────────────────
    const renderMenu = () => (
        <View className="px-6 pb-6 pt-2">
            <Text className="text-[15px] text-gray-500 mb-5">
                Order #{order.order_number || order.orderNumber || '—'} · ₹{orderTotal}
            </Text>
            <ActionRow
                icon={<Ban size={20} color={can.cancel ? '#DC2626' : '#9CA3AF'} />}
                label="Cancel order"
                subtitle={can.cancel ? 'Pre-pickup; fee may apply on paid orders' : 'Not available for this order'}
                disabled={!can.cancel}
                onPress={() => setAction('cancel')}
            />
            <ActionRow
                icon={<Calendar size={20} color={can.reschedule ? '#2563EB' : '#9CA3AF'} />}
                label="Reschedule slot"
                subtitle={can.reschedule ? 'Move to a new time' : 'Not available for this order'}
                disabled={!can.reschedule}
                onPress={() => setAction('reschedule')}
            />
            <ActionRow
                icon={<RotateCcw size={20} color={can.return ? '#B45309' : '#9CA3AF'} />}
                label="Return"
                subtitle={can.return ? 'Within 24 hours of completion' : 'Order must be completed first'}
                disabled={!can.return}
                onPress={() => setAction('return')}
            />
            <ActionRow
                icon={<RefreshCw size={20} color={can.exchange ? '#7C3AED' : '#9CA3AF'} />}
                label="Exchange"
                subtitle={can.exchange ? 'Single-step at the store within 24h' : 'Order must be completed first'}
                disabled={!can.exchange}
                onPress={() => setAction('exchange')}
            />
        </View>
    );

    // ── Cancel form ─────────────────────────────────────────────────
    const renderCancel = () => (
        <View className="px-6 pb-6">
            <Text className="text-[14px] text-gray-700 mb-3">Tell us why (optional)</Text>
            <TextInput
                className="border border-gray-300 rounded-2xl p-4 text-[14px] mb-4"
                multiline
                numberOfLines={3}
                placeholder="e.g. Plans changed"
                value={cancelReason}
                onChangeText={setCancelReason}
            />
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                <Text className="text-[13px] text-amber-900">
                    {orderType === 'dine-in'
                        ? 'Dining bookings are non-refundable per our policy.'
                        : 'Pickup orders: 5%/max ₹50 late-cancel fee. Cancel within 5 minutes of placing for full refund.'}
                </Text>
            </View>
            {submitButton('Confirm cancellation', '#DC2626')}
        </View>
    );

    // ── Reschedule form ─────────────────────────────────────────────
    const renderReschedule = () => (
        <View className="px-6 pb-6">
            <Text className="text-[14px] text-gray-700 mb-3">Pick a new slot</Text>
            <TouchableOpacity
                className="border border-gray-300 rounded-2xl p-4 mb-4"
                onPress={() => setShowDatePicker(true)}
            >
                <Text className="text-[15px] text-gray-900 font-medium">
                    {newSlot.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
                <Text className="text-[12px] text-gray-500 mt-1">Tap to change</Text>
            </TouchableOpacity>
            {showDatePicker && (
                <DateTimePicker
                    value={newSlot}
                    mode="datetime"
                    minimumDate={new Date(Date.now() + 30 * 60_000)} // at least 30 min in the future
                    onChange={(event, selected) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (selected) setNewSlot(selected);
                    }}
                />
            )}
            {orderType === 'dine-in' && (
                <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                    <Text className="text-[13px] text-amber-900">
                        Dining slots can't be moved within 45 minutes of the current reservation.
                    </Text>
                </View>
            )}
            {submitButton('Reschedule', '#2563EB')}
        </View>
    );

    // ── Return form ─────────────────────────────────────────────────
    const renderReturn = () => (
        <View className="px-6 pb-6">
            <Text className="text-[14px] text-gray-700 mb-2">Reason</Text>
            <ReasonChips
                value={returnReason}
                options={RETURN_REASONS}
                onChange={setReturnReason}
            />
            <View className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mt-3">
                <Text className="text-[12px] text-blue-900">
                    Damaged item? Pick "Quality issue" and describe what's wrong — photo upload is coming in the next release.
                </Text>
            </View>
            <Text className="text-[14px] text-gray-700 mt-4 mb-2">Add details (optional)</Text>
            <TextInput
                className="border border-gray-300 rounded-2xl p-4 text-[14px] mb-4"
                multiline
                numberOfLines={3}
                placeholder="Describe the issue"
                value={returnDescription}
                onChangeText={setReturnDescription}
            />
            <Text className="text-[14px] text-gray-700 mb-2">Refund amount (₹)</Text>
            <TextInput
                className="border border-gray-300 rounded-2xl p-4 text-[14px] mb-4"
                keyboardType="numeric"
                placeholder={`Up to ${orderTotal}`}
                value={returnRefundInr}
                onChangeText={setReturnRefundInr}
            />
            <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
                <Text className="text-[13px] text-emerald-900">
                    For missing items, wrong items, damaged, or quality issues — refund is processed without you needing to return anything. Other reasons: drop the item back at the store.
                </Text>
                <Text className="text-[12px] text-emerald-800 mt-1">
                    Merchant has 24h to respond — auto-approved after that.
                </Text>
            </View>
            {submitButton('Submit return request', '#B45309')}
        </View>
    );

    // ── Exchange form ───────────────────────────────────────────────
    const renderExchange = () => (
        <View className="px-6 pb-6">
            <Text className="text-[14px] text-gray-700 mb-2">Reason</Text>
            <ReasonChips
                value={exchangeReason}
                options={EXCHANGE_REASONS}
                onChange={setExchangeReason}
            />
            <Text className="text-[14px] text-gray-700 mt-4 mb-2">Add details (optional)</Text>
            <TextInput
                className="border border-gray-300 rounded-2xl p-4 text-[14px] mb-4"
                multiline
                numberOfLines={3}
                placeholder="e.g. Need size M instead of L"
                value={exchangeDescription}
                onChangeText={setExchangeDescription}
            />
            <View className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-4">
                <Text className="text-[13px] text-violet-900">
                    Visit the store within 24 hours to complete the exchange. Single-step, no fee.
                </Text>
            </View>
            {submitButton('Submit exchange request', '#7C3AED')}
        </View>
    );

    const submitButton = (label: string, color: string) => (
        <TouchableOpacity
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: color, opacity: submitting ? 0.7 : 1 }}
            onPress={handleSubmit}
            disabled={submitting}
        >
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text className="text-[15px] font-bold text-white">{label}</Text>}
        </TouchableOpacity>
    );

    const headerTitle = action === 'menu' ? 'Manage order' :
        action === 'cancel' ? 'Cancel order' :
        action === 'reschedule' ? 'Reschedule slot' :
        action === 'return' ? 'Return' : 'Exchange';

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Pressable className="flex-1 bg-black/50" onPress={resetAndClose} />
                <View className="bg-white rounded-t-[32px]" style={{ maxHeight: '90%' }}>
                    <View className="px-6 pt-6 pb-4">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center flex-1">
                                {action !== 'menu' && (
                                    <TouchableOpacity onPress={() => setAction('menu')} className="p-2 -ml-2 mr-2 bg-gray-100 rounded-full">
                                        <ChevronLeft size={20} color="#374151" />
                                    </TouchableOpacity>
                                )}
                                <Text className="text-[22px] font-bold text-gray-900">{headerTitle}</Text>
                            </View>
                            <TouchableOpacity onPress={resetAndClose} className="p-2 bg-gray-100 rounded-full">
                                <X size={20} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {action === 'menu' && renderMenu()}
                        {action === 'cancel' && renderCancel()}
                        {action === 'reschedule' && renderReschedule()}
                        {action === 'return' && renderReturn()}
                        {action === 'exchange' && renderExchange()}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────

function ActionRow({
    icon, label, subtitle, disabled, onPress,
}: { icon: React.ReactNode; label: string; subtitle: string; disabled?: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={disabled ? undefined : onPress}
            className="flex-row items-center py-4 border-b border-gray-100"
            activeOpacity={0.6}
            disabled={disabled}
            style={{ opacity: disabled ? 0.5 : 1 }}
        >
            <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-3">
                {icon}
            </View>
            <View className="flex-1">
                <Text className="text-[15px] font-semibold text-gray-900">{label}</Text>
                <Text className="text-[12px] text-gray-500 mt-0.5">{subtitle}</Text>
            </View>
        </TouchableOpacity>
    );
}

function ReasonChips({
    value, options, onChange,
}: { value: string; options: readonly { code: string; label: string }[]; onChange: (code: string) => void }) {
    return (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {options.map(opt => (
                <TouchableOpacity
                    key={opt.code}
                    onPress={() => onChange(opt.code)}
                    className="px-3 py-2 rounded-full border"
                    style={{
                        backgroundColor: value === opt.code ? '#111827' : '#FFF',
                        borderColor: value === opt.code ? '#111827' : '#E5E7EB',
                    }}
                >
                    <Text className="text-[13px] font-medium" style={{ color: value === opt.code ? '#FFF' : '#374151' }}>
                        {opt.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}
