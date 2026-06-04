/**
 * StepSubscription — Step 5 of merchant signup (v2 Lifetime Access purchase).
 *
 * 2026-06-04 (Phase 2.E): redesigned for per-store linear pricing + partner
 * coupon support. v1 charged ₹999 / ₹2999 flat regardless of store count;
 * v2 multiplies by stores.length and applies a flat ₹ discount from the
 * partner-coupon system.
 *
 * Pricing rules (per spec):
 *   - Standard tier (selectedVertical.isPremium === false) → ₹999 × N stores
 *   - Premium tier  (selectedVertical.isPremium === true)  → ₹2999 × N stores
 *   - Coupon: flat ₹ off (Phase 2.E2 will wire real validation; v0 simulates
 *     "LAUNCH100" → ₹100 off for testing)
 *
 * Wording: "LIFETIME ACCESS" / "Lifetime Access" — kept per the locked v2
 * spec (B1 decision). Pranav is redrafting vendor agreements to include
 * an explicit "Lifetime Listing Right" clause so the UI copy stands.
 *
 * Real backend wiring (Phase 2.E2, deferred):
 *   - POST /merchant-signup/validate-coupon (server-side check against the
 *     merchant_signup_coupons table)
 *   - Razorpay /payments/create-order picks up store_count + coupon_id from
 *     the existing PATCH /auth/merchant/draft payload
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';

export interface StepSubscriptionProps {
    /**
     * Triggered when the merchant taps "Pay & Unlock". Orchestrator computes
     * the final amount from stores.length + couponDiscount + tier, runs
     * Razorpay vs. Expo-Go-simulate, syncs, and routes to /pending.
     */
    onPayment: () => void;
}

export function StepSubscription({ onPayment }: StepSubscriptionProps) {
    const {
        selectedVertical,
        paymentStatus,
        paymentDetails,
        stores,
        couponCode, setCouponCode,
        couponDiscount, setCouponDiscount,
        couponError, setCouponError,
    } = useSignupContext();
    const [validating, setValidating] = useState(false);

    const isPremium = !!selectedVertical?.isPremium;
    const perStorePrice = isPremium ? 2999 : 999;
    const perStoreStrike = isPremium ? 4999 : 2499;
    const storeCount = Math.max(1, stores.length);
    const subtotal = storeCount * perStorePrice;
    const total = Math.max(0, subtotal - (couponDiscount || 0));
    const couponApplied = couponDiscount > 0;

    /**
     * v0 stub validator. Phase 2.E2 will replace with POST /merchant-signup/
     * validate-coupon. For now: code 'LAUNCH100' → ₹100 off; 'LAUNCH500' →
     * ₹500 off; everything else returns an error after a 600ms simulated
     * network round-trip.
     */
    const applyCoupon = async () => {
        const code = couponCode.trim().toUpperCase();
        if (!code) {
            setCouponError('Enter a coupon code first.');
            return;
        }
        setValidating(true);
        setCouponError(null);
        try {
            await new Promise(r => setTimeout(r, 600));
            if (code === 'LAUNCH100') {
                setCouponDiscount(100);
                setCouponError(null);
            } else if (code === 'LAUNCH500') {
                setCouponDiscount(500);
                setCouponError(null);
            } else {
                setCouponDiscount(0);
                setCouponError('Invalid or expired coupon code.');
            }
        } finally {
            setValidating(false);
        }
    };

    const clearCoupon = () => {
        setCouponCode('');
        setCouponDiscount(0);
        setCouponError(null);
    };

    return (
        <View style={styles.card}>
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>Partner Subscription</Text>
                <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
                    Unlock analytics, premium support, and unlimited listings with lifetime access — priced per store.
                </Text>

                <View style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 24,
                    width: '100%',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2
                }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.primary, marginBottom: 12 }}>LIFETIME ACCESS</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
                        <Text style={{ fontSize: 18, color: '#9CA3AF', textDecorationLine: 'line-through', marginRight: 12 }}>
                            ₹{perStoreStrike.toLocaleString('en-IN')}
                        </Text>
                        <Text style={{ fontSize: 32, fontWeight: '800', color: '#10B981' }}>
                            ₹{perStorePrice.toLocaleString('en-IN')}
                        </Text>
                        <Text style={{ fontSize: 14, color: '#6B7280', marginLeft: 6 }}>/ store</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                        {isPremium ? 'Premium tier' : 'Standard tier'} · {storeCount} {storeCount === 1 ? 'store' : 'stores'}
                    </Text>

                    {/* Per-store + coupon breakdown */}
                    <View style={{ width: '100%', paddingHorizontal: 4, marginBottom: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16 }}>
                        <View style={styles.reviewRow}>
                            <Text style={styles.reviewLabel}>{storeCount} × ₹{perStorePrice.toLocaleString('en-IN')}</Text>
                            <Text style={styles.reviewValue}>₹{subtotal.toLocaleString('en-IN')}</Text>
                        </View>
                        {couponApplied && (
                            <View style={styles.reviewRow}>
                                <Text style={[styles.reviewLabel, { color: '#10B981' }]}>Coupon ({couponCode.toUpperCase()})</Text>
                                <Text style={[styles.reviewValue, { color: '#10B981' }]}>− ₹{couponDiscount.toLocaleString('en-IN')}</Text>
                            </View>
                        )}
                        <View style={[styles.reviewRow, { borderBottomWidth: 0, paddingTop: 12 }]}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Total</Text>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827' }}>₹{total.toLocaleString('en-IN')}</Text>
                        </View>
                    </View>

                    <View style={{ width: '100%', paddingHorizontal: 10 }}>
                        {['Unlimited Listings', 'Premium Support', 'Store Analytics'].map((feat, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
                                <Text style={{ fontSize: 14, color: '#374151' }}>{feat}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Coupon input */}
                {paymentStatus !== 'success' && (
                    <View style={{ width: '100%', marginTop: 20 }}>
                        <Text style={styles.label}>Have a partner coupon code?</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Enter code"
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="characters"
                                value={couponCode}
                                onChangeText={t => { setCouponCode(t); setCouponError(null); }}
                                editable={!couponApplied}
                            />
                            {couponApplied ? (
                                <TouchableOpacity
                                    onPress={clearCoupon}
                                    style={{ paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, backgroundColor: '#FEE2E2' }}
                                >
                                    <Text style={{ color: '#DC2626', fontWeight: '600' }}>Remove</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={applyCoupon}
                                    disabled={validating || !couponCode.trim()}
                                    style={{ paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, backgroundColor: Colors.primary, opacity: (validating || !couponCode.trim()) ? 0.5 : 1 }}
                                >
                                    {validating ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Apply</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                        {couponError && (
                            <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 6 }}>{couponError}</Text>
                        )}
                        {couponApplied && (
                            <Text style={{ color: '#10B981', fontSize: 12, marginTop: 6 }}>
                                ✓ Coupon applied — ₹{couponDiscount} off
                            </Text>
                        )}
                    </View>
                )}

                {paymentStatus === 'success' ? (
                    <View style={{ marginTop: 24, alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                        <Text style={{ fontSize: 18, fontWeight: '600', color: '#10B981', marginTop: 12 }}>Payment Successful!</Text>
                        <Text style={{ color: '#6B7280', marginTop: 4 }}>Transaction ID: {paymentDetails?.paymentId}</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={{
                            backgroundColor: Colors.primary,
                            width: '100%',
                            paddingVertical: 16,
                            borderRadius: 12,
                            alignItems: 'center',
                            marginTop: 24,
                            flexDirection: 'row',
                            justifyContent: 'center'
                        }}
                        onPress={onPayment}
                    >
                        <Ionicons name="lock-closed" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>Pay ₹{total.toLocaleString('en-IN')} & Unlock</Text>
                    </TouchableOpacity>
                )}

                <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ height: 1, backgroundColor: '#E5E7EB', flex: 1 }} />
                    <Text style={{ marginHorizontal: 10, color: '#9CA3AF', fontSize: 12 }}>Secure Payment via Razorpay</Text>
                    <View style={{ height: 1, backgroundColor: '#E5E7EB', flex: 1 }} />
                </View>
            </View>
        </View>
    );
}
