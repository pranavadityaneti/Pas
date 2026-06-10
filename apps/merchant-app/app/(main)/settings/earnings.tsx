import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { useEarnings } from '../../../src/hooks/useEarnings';
import { useSettlements, SettlementCycle } from '../../../src/hooks/useSettlements';

// Phase 7F — weekly settlement period label. periodEnd is exclusive (next
// Monday 00:00 IST), so display the inclusive Sunday.
function formatPeriod(start: string, end: string): string {
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const endInclusive = new Date(new Date(end).getTime() - 24 * 60 * 60 * 1000);
    return `${fmt(new Date(start))} – ${fmt(endInclusive)}`;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EarningsScreen() {
    const { stats, loading } = useEarnings();
    const { cycles, loading: settlementsLoading } = useSettlements();
    const [expandedCycle, setExpandedCycle] = useState<string | null>(null);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
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
                <Text style={styles.headerTitle}>Earnings & Reports</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Main Stats Card */}
                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>TOTAL REVENUE</Text>
                    <Text style={styles.totalAmount}>₹{stats.total.toLocaleString()}</Text>
                    <View style={styles.totalMeta}>
                        <View style={styles.metaItem}>
                            <Ionicons name="receipt-outline" size={16} color="#9CA3AF" />
                            <Text style={styles.metaText}>{stats.orderCount} Orders</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                            <Text style={styles.metaText}>Updated now</Text>
                        </View>
                    </View>
                </View>

                {/* Sub Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Today</Text>
                        <Text style={styles.statValue}>₹{stats.today.toLocaleString()}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>This Week</Text>
                        <Text style={styles.statValue}>₹{stats.weekly.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Phase 6 (2026-06-10) — coupon money lines. Shown only when a
                    coupon order has completed. Reimbursement = platform-funded
                    discounts the platform owes back; Absorbed = merchant-funded
                    discounts the merchant chose to fund. */}
                {(stats.couponReimbursement > 0 || stats.couponAbsorbed > 0) && (
                    <View style={styles.couponCard}>
                        <View style={styles.couponHeader}>
                            <MaterialCommunityIcons name="ticket-percent-outline" size={20} color="#047857" />
                            <Text style={styles.couponTitle}>Coupon Discounts</Text>
                        </View>
                        {stats.couponReimbursement > 0 && (
                            <View style={styles.couponRow}>
                                <Text style={styles.couponLabel}>Platform-funded (reimbursed to you)</Text>
                                <Text style={[styles.couponValue, { color: '#047857' }]}>+₹{stats.couponReimbursement.toLocaleString()}</Text>
                            </View>
                        )}
                        {stats.couponAbsorbed > 0 && (
                            <View style={styles.couponRow}>
                                {/* Audit fix #6: no minus prefix — this amount is already
                                    baked into every total on this screen; a "−" invited
                                    merchants to mentally subtract it twice. */}
                                <Text style={styles.couponLabel}>Merchant-funded (already reflected in your totals)</Text>
                                <Text style={[styles.couponValue, { color: '#92400E' }]}>₹{stats.couponAbsorbed.toLocaleString()}</Text>
                            </View>
                        )}
                        <Text style={styles.couponNote}>Reimbursements are settled by the platform. Exact settlement timing arrives with the payout system.</Text>
                    </View>
                )}

                <View style={styles.pendingCard}>
                    <View style={styles.pendingIcon}>
                        <Ionicons name="alert-circle-outline" size={24} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.pendingTitle}>{stats.pendingCount} Ongoing Orders</Text>
                        <Text style={styles.pendingDesc}>These orders are in progress and not yet added to revenue.</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/(main)/orders')}>
                        <Text style={styles.viewLink}>View</Text>
                    </TouchableOpacity>
                </View>

                {/* Phase 7F (2026-06-10) — weekly settlement history. Cycles are
                    merchant-level (all branches combined) and appear once a week
                    closes (Mon 02:00 IST). PAID = money transferred; PROCESSING
                    = calculated, payout on the way. */}
                <View style={styles.settlementSection}>
                    <View style={styles.settlementHeader}>
                        <MaterialCommunityIcons name="bank-outline" size={20} color={Colors.text} />
                        <Text style={styles.settlementTitle}>Weekly Settlements</Text>
                    </View>
                    <Text style={styles.settlementSub}>All branches combined · Mon–Sun weeks</Text>

                    {settlementsLoading ? (
                        <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
                    ) : cycles.length === 0 ? (
                        <View style={styles.settlementEmpty}>
                            <Text style={styles.settlementEmptyText}>
                                No settled weeks yet. Your first settlement appears after the current week closes.
                            </Text>
                        </View>
                    ) : (
                        cycles.map((c: SettlementCycle) => {
                            const expanded = expandedCycle === c.id;
                            const paid = c.status === 'PAID';
                            return (
                                <TouchableOpacity
                                    key={c.id}
                                    style={styles.cycleCard}
                                    activeOpacity={0.7}
                                    onPress={() => setExpandedCycle(expanded ? null : c.id)}
                                >
                                    <View style={styles.cycleRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cyclePeriod}>{formatPeriod(c.periodStart, c.periodEnd)}</Text>
                                            <View style={[styles.statusChip, paid ? styles.statusPaid : styles.statusClosed]}>
                                                <Text style={[styles.statusChipText, { color: paid ? '#047857' : '#92400E' }]}>
                                                    {paid ? 'PAID' : 'PROCESSING'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.cycleAmount}>{inr(c.netPayout)}</Text>
                                            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
                                        </View>
                                    </View>
                                    {expanded && (
                                        <View style={styles.cycleBreakdown}>
                                            <View style={styles.breakdownRow}>
                                                <Text style={styles.breakdownLabel}>Sales (items)</Text>
                                                <Text style={styles.breakdownValue}>{inr(c.grossSales)}</Text>
                                            </View>
                                            <View style={styles.breakdownRow}>
                                                <Text style={styles.breakdownLabel}>Platform commission</Text>
                                                <Text style={[styles.breakdownValue, { color: '#DC2626' }]}>− {inr(c.commissionAmount)}</Text>
                                            </View>
                                            {c.couponReimbursement > 0 && (
                                                <View style={styles.breakdownRow}>
                                                    <Text style={styles.breakdownLabel}>Coupon reimbursement</Text>
                                                    <Text style={[styles.breakdownValue, { color: '#047857' }]}>+ {inr(c.couponReimbursement)}</Text>
                                                </View>
                                            )}
                                            {c.clawbackAmount > 0 && (
                                                <View style={styles.breakdownRow}>
                                                    <Text style={styles.breakdownLabel}>Refund adjustments</Text>
                                                    <Text style={[styles.breakdownValue, { color: '#DC2626' }]}>− {inr(c.clawbackAmount)}</Text>
                                                </View>
                                            )}
                                            <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                                                <Text style={[styles.breakdownLabel, { fontWeight: 'bold', color: Colors.text }]}>Net payout</Text>
                                                <Text style={[styles.breakdownValue, { fontWeight: 'bold' }]}>{inr(c.netPayout)}</Text>
                                            </View>
                                            {paid && c.paidAt && (
                                                <Text style={styles.paidNote}>
                                                    Paid on {new Date(c.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
    content: { padding: 16 },

    totalCard: { backgroundColor: Colors.primary, borderRadius: 24, padding: 32, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    totalLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
    totalAmount: { color: Colors.white, fontSize: 40, fontWeight: 'bold' },
    totalMeta: { flexDirection: 'row', marginTop: 24, gap: 16 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },

    statsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
    statBox: { flex: 1, backgroundColor: Colors.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border },
    statLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4, fontWeight: '600' },
    statValue: { fontSize: 20, fontWeight: 'bold', color: Colors.text },

    // Phase 6 (2026-06-10) — coupon discounts card
    couponCard: { backgroundColor: '#F0FDF4', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 20 },
    couponHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    couponTitle: { fontSize: 15, fontWeight: 'bold', color: '#065F46' },
    couponRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    couponLabel: { fontSize: 13, color: '#374151', flex: 1, marginRight: 8 },
    couponValue: { fontSize: 15, fontWeight: 'bold' },
    couponNote: { fontSize: 11.5, color: '#6B7280', marginTop: 4, lineHeight: 15 },

    pendingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#FEF3C7', marginBottom: 20 },
    pendingIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    pendingTitle: { fontSize: 15, fontWeight: 'bold', color: '#92400E' },
    pendingDesc: { fontSize: 12, color: '#B45309', marginTop: 2, lineHeight: 16 },
    viewLink: { color: '#D97706', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },

    // Phase 7F (2026-06-10) — weekly settlement history
    settlementSection: { marginBottom: 32 },
    settlementHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    settlementTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.text },
    settlementSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
    settlementEmpty: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
    settlementEmptyText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
    cycleCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
    cycleRow: { flexDirection: 'row', alignItems: 'center' },
    cyclePeriod: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 6 },
    statusChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    statusPaid: { backgroundColor: '#D1FAE5' },
    statusClosed: { backgroundColor: '#FEF3C7' },
    statusChipText: { fontSize: 10.5, fontWeight: 'bold', letterSpacing: 0.5 },
    cycleAmount: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
    cycleBreakdown: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    breakdownLabel: { fontSize: 13, color: Colors.textSecondary },
    breakdownValue: { fontSize: 13, fontWeight: '600', color: Colors.text },
    breakdownTotal: { paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: 4 },
    paidNote: { fontSize: 11.5, color: '#047857', marginTop: 4 },
});
