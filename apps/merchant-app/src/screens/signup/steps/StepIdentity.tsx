/**
 * StepIdentity — Step 1 of merchant signup (Owner Details + OTP verification).
 *
 * 2026-06-04 (Phase 1.7.A): Extracted verbatim from app/(auth)/signup.tsx
 * JSX blocks at lines ~528–630 (post-Phase-1.7.0). Identity state +
 * setIdentity come from useSignupContext. The OTP hook (useSignupOtpVerify)
 * is created in the SignupScreenInner orchestrator and passed in as a prop —
 * because Step 1's JSX references otp.send / otp.verify / otp.values etc.,
 * and the hook needs to live above the step component for the phone field
 * to remain the source-of-truth for OTP send/verify.
 *
 * Renders TWO sibling blocks: (1) the logo + tagline header, (2) the
 * Owner Details card containing Name + WhatsApp + OTP UI + Email. The
 * original Step 1 JSX rendered these as two adjacent `{step === 1 && ...}`
 * conditionals; here they sit as siblings inside a fragment.
 *
 * Behavior preservation: every prop on every TextInput, every onPress
 * handler, every inline style, and every conditional — preserved
 * verbatim from the pre-extraction JSX.
 */

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';
import type { UseSignupOtpVerifyResult } from '../shared/useSignupOtpVerify';

export interface StepIdentityProps {
    /**
     * OTP hook instance. Created in SignupScreenInner because the orchestrator
     * needs to coordinate setLoading and the onVerified → fetchRemoteMerchantState
     * call; passed down here so the Step 1 JSX can read otp.verified /
     * otp.sent / otp.values etc.
     */
    otp: UseSignupOtpVerifyResult;
}

export function StepIdentity({ otp }: StepIdentityProps) {
    const { identity, setIdentity, loading } = useSignupContext();

    return (
        <>
            <View style={styles.authLogoContainer}>
                <Image source={require('../../../../assets/logo.png')} style={styles.authLogo} resizeMode="contain" />
                <Text style={styles.authTitle}>Join Pick At Store</Text>
                <Text style={styles.authSubtitle}>Grow your business with our partner network</Text>
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="person-outline" size={20} color={Colors.primary} />
                    <Text style={styles.cardTitle}>Owner Details</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Owner Name <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="John Doe"
                        placeholderTextColor="#9CA3AF"
                        value={identity.ownerName}
                        onChangeText={(t) => setIdentity({ ...identity, ownerName: t })}
                    />
                </View>

                {/* 2026-06-04 (Phase 2.A, spec blocker B2): Designation populates the
                    signatory block on the partner-agreement PDF at Step 4. */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Designation <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Proprietor / Director / Partner"
                        placeholderTextColor="#9CA3AF"
                        value={identity.designation}
                        onChangeText={(t) => setIdentity({ ...identity, designation: t })}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>WhatsApp Number <Text style={styles.required}>*</Text></Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16 }}>
                        <Text style={{ fontSize: 16, color: '#6B7280', fontWeight: '600', marginRight: 8 }}>+91</Text>
                        <View style={{ width: 1, height: 24, backgroundColor: '#E5E7EB', marginRight: 8 }} />
                        <TextInput
                            style={{ flex: 1, height: 48, fontSize: 16, color: '#111827', fontWeight: 'bold' }}
                            placeholder="98765 43210"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="phone-pad"
                            maxLength={10}
                            value={identity.phone}
                            onChangeText={(t) => setIdentity({ ...identity, phone: t })}
                            editable={!otp.verified}
                        />
                        {otp.verified ? (
                            <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                        ) : (
                            <TouchableOpacity
                                onPress={otp.send}
                                disabled={loading || identity.phone.length !== 10}
                                style={{ backgroundColor: Colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, opacity: (loading || identity.phone.length !== 10) ? 0.5 : 1 }}
                            >
                                <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>{otp.sent ? 'Resend' : 'Verify'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {otp.sent && !otp.verified && (
                    <View style={styles.inputGroup}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={styles.label}>Enter 6-digit OTP</Text>
                            {otp.resendTimer > 0 ? (
                                <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Resend in {otp.resendTimer}s</Text>
                            ) : null}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                            {otp.values.map((val, i) => (
                                <TextInput
                                    key={i}
                                    ref={ref => { otp.refs.current[i] = ref; }}
                                    style={{ width: 44, height: 52, borderWidth: 1, borderColor: val ? Colors.primary : '#E5E7EB', borderRadius: 12, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#111827', backgroundColor: val ? '#FFFFFF' : '#F9FAFB' }}
                                    maxLength={1}
                                    keyboardType="number-pad"
                                    value={val}
                                    onChangeText={(text) => otp.onChange(text, i)}
                                    onKeyPress={(e) => otp.onKeyPress(e, i)}
                                />
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[{ height: 52, backgroundColor: Colors.primary, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 }, (loading || otp.getValue().length !== 6) && { opacity: 0.6 }]}
                            onPress={otp.verify}
                            disabled={loading || otp.getValue().length !== 6}
                        >
                            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Verify OTP</Text>}
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="owner@store.com"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={identity.email}
                        onChangeText={(t) => setIdentity({ ...identity, email: t })}
                    />
                </View>
            </View>
        </>
    );
}
