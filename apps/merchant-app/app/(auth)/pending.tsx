/**
 * PendingScreen — dynamic, persistent post-submit landing.
 *
 * 2026-06-04 (Phase 2.H): Rewritten per spec docs/merchant-signup-v2-spec.md
 * (Step 7 — Pending Screen). Escape hatches removed: no "Back to login",
 * no "Sign out", no "Continue Application". The merchant lives on this
 * screen until their `kyc_status` changes server-side.
 *
 * Status-driven UI:
 *   pending     → "Under review. We'll respond within 24-48 hours."
 *   needs_info  → "More information needed: <reason>." + Update CTA
 *                 (admin sets reason via the admin queue; the v0 UI
 *                  routes the merchant back into signup so they can
 *                  re-sync. Per-field gating lands in Phase 2.H2 once
 *                  admin has UI for selecting the field.)
 *   approved    → 🎉 "Welcome to PickAtStore!" + "Enter App" CTA
 *   rejected    → "Application not approved. Reason: <reason>." +
 *                 Contact support CTA
 *
 * Updates fire from two sources:
 *   1. Supabase realtime channel on `merchants` row matching this user
 *   2. 30-second foreground polling fallback (covers cases where the
 *      websocket drops)
 *
 * SLA: if status === 'pending' and time-since-submission > 48h, an
 * escalation note appears with a Contact Support button.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../constants/Colors';

type StatusKind = 'pending' | 'needs_info' | 'approved' | 'rejected' | 'unknown';

interface MerchantStatusRow {
    kyc_status: string | null;
    kyc_rejection_reason: string | null;
    created_at: string | null;
    status: string | null;
}

function resolveStatusKind(row: MerchantStatusRow | null): StatusKind {
    if (!row) return 'unknown';
    const k = (row.kyc_status || '').toLowerCase();
    if (k === 'approved' || k === 'verified') return 'approved';
    if (k === 'rejected' || k === 'denied') return 'rejected';
    if (k === 'needs_info') return 'needs_info';
    return 'pending';
}

const HRS_48_MS = 48 * 60 * 60 * 1000;

export default function PendingScreen() {
    const [row, setRow] = useState<MerchantStatusRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const status = resolveStatusKind(row);

    const fetchStatus = async () => {
        try {
            const { data: sess } = await supabase.auth.getSession();
            const userId = sess?.session?.user?.id;
            if (!userId) return;
            setMerchantId(userId);
            const { data } = await supabase
                .from('merchants')
                .select('kyc_status, kyc_rejection_reason, created_at, status')
                .eq('id', userId)
                .maybeSingle();
            if (data) setRow(data as MerchantStatusRow);
        } catch (e) {
            console.warn('[Pending] fetchStatus failed:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    // Realtime channel — fires on any UPDATE to this merchant's row.
    useEffect(() => {
        if (!merchantId) return;
        const channel = supabase
            .channel(`merchant_pending_${merchantId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'merchants', filter: `id=eq.${merchantId}` },
                payload => {
                    if (payload.new) setRow(payload.new as MerchantStatusRow);
                },
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [merchantId]);

    // 30s polling fallback while screen is foregrounded.
    useEffect(() => {
        const start = () => {
            if (pollRef.current) return;
            pollRef.current = setInterval(fetchStatus, 30_000);
        };
        const stop = () => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        };
        start();
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') { fetchStatus(); start(); }
            else stop();
        });
        return () => { stop(); sub.remove(); };
    }, []);

    const submittedAt = row?.created_at ? new Date(row.created_at).getTime() : null;
    const slaBreached =
        status === 'pending' && submittedAt !== null && (Date.now() - submittedAt) > HRS_48_MS;

    const handleEnterApp = () => router.replace('/');

    const handleResumeEdit = () => router.replace('/(auth)/signup');

    const handleContactSupport = () => {
        Linking.openURL('mailto:support@pickatstore.io?subject=Merchant%20Application%20Inquiry');
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ color: '#6B7280', marginTop: 12 }}>Loading your application status…</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* ── APPROVED ──────────────────────────────────────────── */}
                {status === 'approved' && (
                    <>
                        <View style={[styles.iconOuter, { backgroundColor: '#D1FAE5' }]}>
                            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                        </View>
                        <Text style={styles.title}>🎉 Welcome to Pick At Store!</Text>
                        <Text style={styles.description}>
                            Your merchant account is approved. Tap below to start managing your stores.
                        </Text>
                        <TouchableOpacity style={styles.primaryButton} onPress={handleEnterApp}>
                            <Text style={styles.primaryButtonText}>Enter App</Text>
                            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </>
                )}

                {/* ── REJECTED ──────────────────────────────────────────── */}
                {status === 'rejected' && (
                    <>
                        <View style={[styles.iconOuter, { backgroundColor: '#FEE2E2' }]}>
                            <Ionicons name="close-circle" size={64} color="#EF4444" />
                        </View>
                        <Text style={styles.title}>Application Not Approved</Text>
                        <Text style={styles.description}>
                            {row?.kyc_rejection_reason
                                ? `Reason: ${row.kyc_rejection_reason}`
                                : 'Our team reviewed your application and was unable to approve it at this time.'}
                        </Text>
                        <TouchableOpacity style={styles.primaryButton} onPress={handleContactSupport}>
                            <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.primaryButtonText}>Contact Support</Text>
                        </TouchableOpacity>
                    </>
                )}

                {/* ── NEEDS_INFO ────────────────────────────────────────── */}
                {status === 'needs_info' && (
                    <>
                        <View style={[styles.iconOuter, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="alert-circle" size={64} color="#F59E0B" />
                        </View>
                        <Text style={styles.title}>More Information Needed</Text>
                        <Text style={styles.description}>
                            {row?.kyc_rejection_reason || 'Our review team requested additional info. Please update your application and resubmit.'}
                        </Text>
                        <TouchableOpacity style={styles.primaryButton} onPress={handleResumeEdit}>
                            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.primaryButtonText}>Update Application</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryButton} onPress={handleContactSupport}>
                            <Ionicons name="mail-outline" size={18} color={Colors.primary} />
                            <Text style={styles.secondaryButtonText}>Contact Support</Text>
                        </TouchableOpacity>
                    </>
                )}

                {/* ── PENDING (default) + UNKNOWN ───────────────────────── */}
                {(status === 'pending' || status === 'unknown') && (
                    <>
                        <View style={styles.iconOuter}>
                            <View style={styles.iconInner}>
                                <Ionicons name="hourglass-outline" size={48} color="#F59E0B" />
                            </View>
                        </View>

                        <Text style={styles.title}>Application Under Review</Text>
                        <Text style={styles.description}>
                            Thank you for applying to become a Pick At Store merchant partner.
                            Our team is currently reviewing your application.
                        </Text>

                        <View style={styles.statusCard}>
                            <View style={styles.statusRow}>
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                <Text style={styles.statusText}>Application Submitted</Text>
                            </View>
                            <View style={styles.statusRow}>
                                <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
                                <Text style={styles.statusText}>Verification in Progress</Text>
                            </View>
                            <View style={[styles.statusRow, { borderBottomWidth: 0 }]}>
                                <Ionicons name="ellipse-outline" size={20} color="#D1D5DB" />
                                <Text style={styles.statusTextPending}>Approval Pending</Text>
                            </View>
                        </View>

                        <View style={styles.infoCard}>
                            <Ionicons name="time-outline" size={20} color="#6B7280" />
                            <Text style={styles.infoText}>
                                This usually takes 24-48 hours. We'll notify you via email
                                once your account is approved.
                            </Text>
                        </View>

                        {slaBreached && (
                            <View style={[styles.infoCard, { backgroundColor: '#FEF3C7' }]}>
                                <Ionicons name="alert-circle" size={20} color="#D97706" />
                                <Text style={[styles.infoText, { color: '#92400E' }]}>
                                    Sorry for the wait — we're escalating your review. Tap below
                                    if you'd like to chat with support.
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity style={styles.secondaryButton} onPress={handleContactSupport}>
                            <Ionicons name="mail-outline" size={18} color={Colors.primary} />
                            <Text style={styles.secondaryButtonText}>Contact Support</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* 2026-06-04 (Phase 2.H): "Back to Login" and "Continue Application"
                CTAs intentionally removed per spec. The merchant lives here
                until kyc_status changes server-side. */}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    iconOuter: {
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 20,
    },
    iconInner: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: '#FDE68A',
        justifyContent: 'center', alignItems: 'center',
    },
    title: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 12 },
    description: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    statusCard: {
        width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    statusText: { fontSize: 15, color: '#111827', marginLeft: 12, fontWeight: '500' },
    statusTextPending: { fontSize: 15, color: '#9CA3AF', marginLeft: 12 },
    infoCard: {
        width: '100%', flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, marginBottom: 16,
    },
    infoText: { flex: 1, fontSize: 13, color: '#6B7280', marginLeft: 12, lineHeight: 20 },
    primaryButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        width: '100%', paddingVertical: 16, borderRadius: 12,
        backgroundColor: Colors.primary, marginBottom: 12,
    },
    primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginHorizontal: 8 },
    secondaryButton: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24,
        borderWidth: 1, borderColor: Colors.primary + '30', borderRadius: 12,
        backgroundColor: Colors.primary + '08',
    },
    secondaryButtonText: { fontSize: 15, fontWeight: '600', color: Colors.primary, marginLeft: 8 },
});
