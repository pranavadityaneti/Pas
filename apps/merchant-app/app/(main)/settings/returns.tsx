/**
 * Returns & Exchanges inbox — merchant review surface for WS2.
 *
 * 2026-06-05 (WS2.F): Rewritten from a stub that filtered orders by
 * RETURN_REQUESTED status (no OrderIssue tracking) to a proper merchant
 * inbox driven by the new /orders/issues/inbox endpoint. Returns AND
 * exchanges land here; merchant approves/rejects via PATCH
 * /orders/:id/issue/:issueId.
 *
 * SLA timer is shown per card — the WS2.D cron auto-approves any PENDING
 * issue whose sla_due_at elapses (24h from creation).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
    ActivityIndicator, ScrollView, Modal, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../src/lib/supabase';
import { parseUtc } from '../../../src/utils/dateFormat';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// ─────────────────────────── Types ────────────────────────────────────

type IssueType = 'return' | 'exchange' | 'cancel_dispute';
type IssueStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';
type TabKey = 'PENDING' | 'RESOLVED';

interface InboxIssue {
    id: string;
    orderId: string;
    type: IssueType;
    reason: string;
    description: string | null;
    photos: string[];
    status: IssueStatus;
    refundAmountInr: number | null;
    refundRazorpayId: string | null;
    merchantDecisionReason: string | null;
    resolvedAt: string | null;
    slaDueAt: string;
    createdAt: string;
    order: {
        id: string;
        orderNumber: string;
        status: string;
        totalAmount: number;
        customer_name: string | null;
        customer_phone: string | null;
        store_name: string | null;
        order_type: string | null;
        createdAt: string;
        isPaid: boolean;
        user: { name: string | null; phone: string | null; email: string | null } | null;
        items: Array<{
            id: string;
            quantity: number;
            price: number;
            product_name: string | null;
            storeProduct?: { product?: { name: string; returnable: boolean } | null } | null;
        }>;
    };
}

// ─────────────────────── Reason labels (frontend picklist mirror) ─────

const RETURN_REASON_LABEL: Record<string, string> = {
    missing_item: 'Missing item',
    wrong_item: 'Wrong item',
    damaged: 'Damaged',
    quality_issue: 'Quality issue',
    expired: 'Expired',
    changed_mind: 'Changed mind',
};
const EXCHANGE_REASON_LABEL: Record<string, string> = {
    wrong_size: 'Wrong size',
    wrong_color: 'Wrong color',
    wrong_variant: 'Wrong variant',
    changed_mind: 'Changed mind',
    defective: 'Defective',
};
function reasonLabel(type: IssueType, code: string): string {
    if (type === 'return') return RETURN_REASON_LABEL[code] || code;
    if (type === 'exchange') return EXCHANGE_REASON_LABEL[code] || code;
    return code;
}

function formatSlaRemaining(slaIso: string): string {
    const diffMs = new Date(slaIso).getTime() - Date.now();
    if (diffMs <= 0) return 'SLA elapsed';
    const hours = Math.floor(diffMs / 3600_000);
    const minutes = Math.floor((diffMs % 3600_000) / 60_000);
    if (hours >= 1) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
}

// ─────────────────────────── Screen ───────────────────────────────────

export default function ReturnsScreen() {
    const [issues, setIssues] = useState<InboxIssue[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<TabKey>('PENDING');
    const [activeType, setActiveType] = useState<'ALL' | 'return' | 'exchange'>('ALL');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const fetchInbox = useCallback(async () => {
        try {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess?.session?.access_token;
            if (!token) {
                Alert.alert('Sign in required', 'Please log in again to view returns.');
                return;
            }
            const statusParam = activeTab === 'PENDING' ? 'PENDING' : 'ALL';
            const typeParam = activeType;
            const res = await fetch(
                `${API_URL}/orders/issues/inbox?status=${statusParam}&type=${typeParam}&limit=100`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || `Inbox load failed (${res.status})`);
            }
            const rows = (await res.json()) as InboxIssue[];
            // For "RESOLVED" tab, exclude PENDING.
            const filtered = activeTab === 'RESOLVED'
                ? rows.filter(r => r.status !== 'PENDING')
                : rows;
            setIssues(filtered);
        } catch (err: any) {
            console.error('[returns inbox] fetch failed:', err);
            Alert.alert('Error', err?.message || 'Failed to load issues.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab, activeType]);

    useEffect(() => { fetchInbox(); }, [fetchInbox]);

    const onRefresh = () => { setRefreshing(true); fetchInbox(); };

    const handleDecision = async (issue: InboxIssue, decision: 'APPROVED' | 'REJECTED') => {
        if (issue.type === 'return' && decision === 'APPROVED' && (issue.refundAmountInr ?? 0) > 0) {
            const confirmed = await new Promise<boolean>(resolve => {
                Alert.alert(
                    'Approve return + refund?',
                    `This will issue a Razorpay refund of ₹${issue.refundAmountInr} to the customer.`,
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Approve', style: 'default', onPress: () => resolve(true) },
                    ],
                );
            });
            if (!confirmed) return;
        }
        let rejectionReason: string | undefined;
        if (decision === 'REJECTED') {
            rejectionReason = await new Promise<string>(resolve => {
                // RN Alert doesn't ship with text input on iOS by default — for v0, just
                // approve/reject with a generic reason. Inline form is a v0.1 follow-up.
                Alert.alert(
                    'Reject this request?',
                    'The customer will be notified. Optionally edit the reason in v0.1.',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve('') },
                        { text: 'Reject', style: 'destructive', onPress: () => resolve('Not eligible per merchant policy.') },
                    ],
                );
            });
            if (!rejectionReason) return;
        }

        setProcessingId(issue.id);
        try {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess?.session?.access_token;
            if (!token) throw new Error('Not authenticated.');
            const res = await fetch(
                `${API_URL}/orders/${issue.orderId}/issue/${issue.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        decision,
                        merchantDecisionReason: rejectionReason ?? undefined,
                    }),
                },
            );
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Decision failed.');

            // Remove from pending list immediately; refetch in background to also load resolved.
            setIssues(prev => prev.filter(i => i.id !== issue.id));
            const decisionVerb = decision === 'APPROVED' ? 'approved' : 'rejected';
            const refundMsg = body?.refund?.razorpayRefundId
                ? `\nRefund ID: ${body.refund.razorpayRefundId}${body.refund.simulated ? ' (simulated)' : ''}`
                : '';
            Alert.alert(`${issue.type} ${decisionVerb}`, `Customer has been notified.${refundMsg}`);
        } catch (err: any) {
            console.error('[returns inbox] decision failed:', err);
            Alert.alert('Could not save decision', err?.message || 'Unknown error.');
        } finally {
            setProcessingId(null);
        }
    };

    const filteredIssues = useMemo(() => {
        if (activeType === 'ALL') return issues;
        return issues.filter(i => i.type === activeType);
    }, [issues, activeType]);

    const renderItem = ({ item }: { item: InboxIssue }) => {
        const slaText = item.status === 'PENDING' ? formatSlaRemaining(item.slaDueAt) : null;
        const slaUrgent = slaText && (slaText.includes('elapsed') || (slaText.includes('m left') && !slaText.includes('h')));
        const isPaid = item.order.isPaid;

        return (
            <View style={styles.card}>
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={[styles.typePill, item.type === 'return' ? styles.returnPill : styles.exchangePill]}>
                                <Text style={styles.typePillText}>{item.type.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.orderId}>#{item.order.orderNumber}</Text>
                        </View>
                        <Text style={styles.date}>
                            {parseUtc(item.createdAt).toLocaleDateString()} · {parseUtc(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    {item.status === 'PENDING' ? (
                        <View style={[styles.slaBadge, slaUrgent && styles.slaBadgeUrgent]}>
                            <Ionicons name="time-outline" size={12} color={slaUrgent ? '#DC2626' : '#6B7280'} />
                            <Text style={[styles.slaText, slaUrgent && styles.slaTextUrgent]}>{slaText}</Text>
                        </View>
                    ) : (
                        <View style={[styles.statusBadge, item.status === 'APPROVED' || item.status === 'AUTO_APPROVED' ? styles.approvedBadge : styles.rejectedBadge]}>
                            <Text style={styles.statusBadgeText}>{item.status.replace('_', ' ')}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Customer</Text>
                        <Text style={styles.detailValue}>{item.order.customer_name || item.order.user?.name || '—'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Phone</Text>
                        <Text style={styles.detailValue}>{item.order.customer_phone || item.order.user?.phone || '—'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Order total</Text>
                        <Text style={styles.amount}>
                            ₹{item.order.totalAmount}
                            {!isPaid && <Text style={{ fontSize: 11, color: '#9CA3AF' }}> (unpaid)</Text>}
                        </Text>
                    </View>
                    {item.refundAmountInr !== null && item.refundAmountInr > 0 && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Refund requested</Text>
                            <Text style={[styles.amount, { color: '#DC2626' }]}>₹{item.refundAmountInr}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.reasonContainer}>
                    <View style={styles.reasonHeader}>
                        <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
                        <Text style={styles.reasonTitle}>Reason: {reasonLabel(item.type, item.reason)}</Text>
                    </View>
                    {item.description ? (
                        <Text style={styles.reasonText}>{item.description}</Text>
                    ) : null}
                    {item.photos.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                            {item.photos.map((img, index) => (
                                <TouchableOpacity key={index} onPress={() => setSelectedImage(img)}>
                                    <Image
                                        source={img}
                                        style={styles.evidenceImage}
                                        contentFit="cover"
                                        transition={200}
                                    />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>

                {item.merchantDecisionReason && (
                    <View style={styles.decisionContainer}>
                        <Text style={styles.decisionLabel}>Decision note</Text>
                        <Text style={styles.decisionText}>{item.merchantDecisionReason}</Text>
                    </View>
                )}

                {item.status === 'PENDING' && (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.rejectBtn]}
                            onPress={() => handleDecision(item, 'REJECTED')}
                            disabled={!!processingId}
                        >
                            {processingId === item.id ? <ActivityIndicator color="#EF4444" /> : <Text style={styles.rejectText}>Reject</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, styles.approveBtn]}
                            onPress={() => handleDecision(item, 'APPROVED')}
                            disabled={!!processingId}
                        >
                            {processingId === item.id ? <ActivityIndicator color="#FFFFFF" /> : (
                                <Text style={styles.approveText}>
                                    {item.type === 'return' && (item.refundAmountInr ?? 0) > 0
                                        ? `Approve + refund ₹${item.refundAmountInr}`
                                        : 'Approve'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Returns & Exchanges</Text>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'PENDING' && styles.activeTab]}
                    onPress={() => setActiveTab('PENDING')}
                >
                    <Text style={[styles.tabText, activeTab === 'PENDING' && styles.activeTabText]}>Pending</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'RESOLVED' && styles.activeTab]}
                    onPress={() => setActiveTab('RESOLVED')}
                >
                    <Text style={[styles.tabText, activeTab === 'RESOLVED' && styles.activeTabText]}>Resolved</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.typeFilterRow}>
                {(['ALL', 'return', 'exchange'] as const).map(t => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.typeFilter, activeType === t && styles.typeFilterActive]}
                        onPress={() => setActiveType(t)}
                    >
                        <Text style={[styles.typeFilterText, activeType === t && styles.typeFilterTextActive]}>
                            {t === 'ALL' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.empty}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredIssues}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="checkmark-circle-outline" size={64} color="#D1D5DB" />
                            <Text style={styles.emptyText}>
                                {activeTab === 'PENDING' ? 'No pending issues. You\'re all caught up.' : 'No resolved issues yet.'}
                            </Text>
                        </View>
                    }
                />
            )}

            <Modal visible={!!selectedImage} transparent={true} onRequestClose={() => setSelectedImage(null)}>
                <View style={styles.modalContainer}>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedImage(null)}>
                        <Ionicons name="close" size={30} color="#FFF" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image source={selectedImage} style={styles.fullImage} contentFit="contain" transition={200} />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ─────────────────────────── Styles ───────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    navBar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backBtn: { marginRight: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },

    tabContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#FFF' },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: Colors.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    activeTabText: { color: Colors.primary },

    typeFilterRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    typeFilter: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6' },
    typeFilterActive: { backgroundColor: Colors.primary },
    typeFilterText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
    typeFilterTextActive: { color: '#FFF' },

    list: { paddingBottom: 32 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyText: { fontSize: 15, color: '#6B7280', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },

    card: { backgroundColor: '#FFF', margin: 16, marginBottom: 8, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    orderId: { fontSize: 16, fontWeight: '700', color: '#111827' },
    date: { fontSize: 12, color: '#6B7280', marginTop: 2 },

    typePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    returnPill: { backgroundColor: '#FEE2E2' },
    exchangePill: { backgroundColor: '#DBEAFE' },
    typePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: '#111827' },

    slaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6' },
    slaBadgeUrgent: { backgroundColor: '#FEE2E2' },
    slaText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
    slaTextUrgent: { color: '#DC2626' },

    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    approvedBadge: { backgroundColor: '#D1FAE5' },
    rejectedBadge: { backgroundColor: '#FEE2E2' },
    statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#111827' },

    detailsContainer: { paddingVertical: 8, borderTopWidth: 1, borderColor: '#F3F4F6' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    detailLabel: { fontSize: 12, color: '#6B7280' },
    detailValue: { fontSize: 12, fontWeight: '600', color: '#111827' },
    amount: { fontSize: 12, fontWeight: '700', color: '#111827' },

    reasonContainer: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginTop: 8 },
    reasonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    reasonTitle: { fontSize: 13, fontWeight: '700', color: '#7F1D1D' },
    reasonText: { fontSize: 13, color: '#1F2937', marginTop: 2 },
    imageScroll: { marginTop: 10 },
    evidenceImage: { width: 64, height: 64, borderRadius: 8, marginRight: 8 },

    decisionContainer: { marginTop: 8, backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8 },
    decisionLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 2 },
    decisionText: { fontSize: 13, color: '#111827' },

    actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    rejectBtn: { backgroundColor: '#FEE2E2' },
    rejectText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
    approveBtn: { backgroundColor: Colors.primary },
    approveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
    closeBtn: { position: 'absolute', top: 48, right: 24, zIndex: 1 },
    fullImage: { width: '100%', height: '100%' },
});
