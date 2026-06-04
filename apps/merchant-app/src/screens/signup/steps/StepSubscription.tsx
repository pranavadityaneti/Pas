/**
 * StepSubscription — Step 6 of merchant signup (Lifetime Access purchase).
 *
 * 2026-06-04 (Phase 1.7.D): Context consumer for selectedVertical /
 * paymentStatus / paymentDetails. The actual payment handler stays in
 * SignupScreenInner because it orchestrates: Razorpay open OR
 * Expo-Go-simulate fallback → syncDraftState(true, paymentOverrides) →
 * AsyncStorage.removeItem → router.replace('/pending'). Passed in as
 * the `onPayment` prop.
 *
 * Pricing rules preserved verbatim:
 *   - selectedVertical.isPremium === true  → strike ₹4999, current ₹2999
 *   - selectedVertical.isPremium === false → strike ₹2499, current ₹999
 *
 * Wording: "LIFETIME ACCESS" / "Lifetime Access" — kept per the locked v2
 * spec (B1 decision). Pranav is redrafting vendor agreements to include
 * an explicit "Lifetime Listing Right" clause so the UI copy stands.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';

export interface StepSubscriptionProps {
    /**
     * Triggered when the merchant taps "Pay & Unlock". Orchestrator handles
     * Razorpay vs. Expo-Go-simulate, sync, and routing.
     */
    onPayment: () => void;
}

export function StepSubscription({ onPayment }: StepSubscriptionProps) {
    const { selectedVertical, paymentStatus, paymentDetails } = useSignupContext();

    return (
        <View style={styles.card}>
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>Partner Subscription</Text>
                <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>Unlock generic analytics, premium support, and unlimited listings with lifetime access.</Text>

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

                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 }}>
                        <Text style={{ fontSize: 20, color: '#9CA3AF', textDecorationLine: 'line-through', marginRight: 12 }}>
                            {selectedVertical?.isPremium ? '₹4999' : '₹2499'}
                        </Text>
                        <Text style={{ fontSize: 40, fontWeight: '800', color: '#10B981' }}>
                            {selectedVertical?.isPremium ? '₹2999' : '₹999'}
                        </Text>
                    </View>

                    <View style={{ width: '100%', paddingHorizontal: 10 }}>
                        {['Unlimited Listings', 'Premium Support', 'Store Analytics'].map((feat, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 10 }} />
                                <Text style={{ fontSize: 16, color: '#374151' }}>{feat}</Text>
                            </View>
                        ))}
                    </View>
                </View>

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
                            marginTop: 32,
                            flexDirection: 'row',
                            justifyContent: 'center'
                        }}
                        onPress={onPayment}
                    >
                        <Ionicons name="lock-closed" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>Pay & Unlock</Text>
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
