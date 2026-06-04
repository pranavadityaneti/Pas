/**
 * StepReview — Step 6 of merchant signup (v2 redesigned read-only summary).
 *
 * 2026-06-04 (Phase 2.F): rewritten for v2:
 *  - Iterates stores[] (v2 consolidated) instead of single store + branches
 *  - Adds Designation (Phase 2.A) row
 *  - Adds Agreements section showing eSign status + per-doc consent
 *  - Adds Coupon row to Subscription section
 *  - Each section has an "Edit" button that jumps back to that step
 *  - "I confirm everything is correct" checkbox at top — gates the
 *    orchestrator's handleFinalSubmit
 *
 * Bank account is masked to last-4. Aadhaar shown last-4 only per spec.
 * PAN shown verbatim (not masked — per existing v1 behavior).
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';

const mask = (s: string, keep = 4) =>
    !s ? '-' : s.length <= keep ? s : `${'X'.repeat(Math.max(0, s.length - keep))}${s.slice(-keep)}`;

export function StepReview() {
    const {
        identity, store, stores,
        kyc, docFiles, selectedVertical,
        agreements, couponCode, couponDiscount,
        paymentStatus, paymentDetails,
        reviewConfirmed, setReviewConfirmed,
        setStep,
    } = useSignupContext();

    const SectionHeader = ({ title, gotoStep }: { title: string; gotoStep: number }) => (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827' }}>{title}</Text>
            <TouchableOpacity onPress={() => setStep(gotoStep)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Edit</Text>
            </TouchableOpacity>
        </View>
    );

    const isPremium = !!selectedVertical?.isPremium;
    const perStorePrice = isPremium ? 2999 : 999;
    const storeCount = Math.max(1, stores.length);
    const subtotal = storeCount * perStorePrice;
    const total = Math.max(0, subtotal - (couponDiscount || 0));

    return (
        <>
            {/* Confirmation block at top */}
            <View style={[styles.card, styles.successCard]}>
                <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                <Text style={styles.successTitle}>Ready to Submit!</Text>
                <Text style={styles.successText}>
                    Your application will be reviewed within 24-48 hours.
                </Text>
                <TouchableOpacity
                    onPress={() => setReviewConfirmed(!reviewConfirmed)}
                    style={[styles.checkboxRow, { marginTop: 16, alignItems: 'center' }]}
                >
                    <View style={[styles.checkbox, reviewConfirmed && styles.checkboxChecked]}>
                        {reviewConfirmed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.checkboxLabel, { flex: 1 }]}>I confirm everything is correct</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.card}>
                <Text style={styles.reviewTitle}>Complete Summary</Text>

                {/* Identity */}
                <SectionHeader title="Identity" gotoStep={1} />
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Owner</Text><Text style={styles.reviewValue}>{identity.ownerName || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Designation</Text><Text style={styles.reviewValue}>{identity.designation || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Phone</Text><Text style={styles.reviewValue}>{identity.phone || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Email</Text><Text style={styles.reviewValue}>{identity.email || '-'}</Text></View>

                {/* Stores */}
                <SectionHeader title={`Stores (${storeCount})`} gotoStep={2} />
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Category</Text><Text style={styles.reviewValue}>{store.categoryName || '-'}</Text></View>
                {stores.map((s, i) => (
                    <View key={s.id} style={{ marginTop: 12, paddingTop: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#F3F4F6' }}>
                        <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.primary, marginBottom: 4 }}>Store {i + 1}: {s.name || '(unnamed)'}</Text>
                        <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Address</Text><Text style={[styles.reviewValue, { flex: 2, textAlign: 'right' }]} numberOfLines={2}>{s.address || '-'}</Text></View>
                        <View style={styles.reviewRow}><Text style={styles.reviewLabel}>City</Text><Text style={styles.reviewValue}>{s.city || '-'}</Text></View>
                        <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Coords</Text><Text style={styles.reviewValue}>{s.latitude !== null && s.longitude !== null ? '✓ Captured' : 'Missing'}</Text></View>
                        <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Manager</Text><Text style={styles.reviewValue}>{s.managerName || '-'}</Text></View>
                        <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Manager Phone</Text><Text style={styles.reviewValue}>{s.managerPhone || '-'}</Text></View>
                        <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Photos</Text><Text style={{ ...styles.reviewValue, color: s.photos.length >= 2 ? '#10B981' : '#EF4444' }}>{s.photos.length} uploaded</Text></View>
                    </View>
                ))}

                {/* KYC */}
                <SectionHeader title="KYC & Financials" gotoStep={3} />
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>PAN Number</Text><Text style={styles.reviewValue}>{kyc.panNumber || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Aadhaar (last 4)</Text><Text style={styles.reviewValue}>{kyc.aadharNumber ? mask(kyc.aadharNumber) : '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>GSTIN</Text><Text style={styles.reviewValue}>{kyc.gstNumber || '-'}</Text></View>
                {kyc.fssaiNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>FSSAI Number</Text><Text style={styles.reviewValue}>{kyc.fssaiNumber}</Text></View>}
                {kyc.msmeNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>MSME Number</Text><Text style={styles.reviewValue}>{kyc.msmeNumber}</Text></View>}
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Bank Account</Text><Text style={styles.reviewValue}>{kyc.bankAccount ? mask(kyc.bankAccount) : '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>IFSC Code</Text><Text style={styles.reviewValue}>{kyc.ifsc || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Beneficiary</Text><Text style={styles.reviewValue}>{kyc.beneficiaryName || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Turnover Range</Text><Text style={styles.reviewValue}>{kyc.turnoverRange || '-'}</Text></View>

                {/* Documents (still under KYC step) */}
                <SectionHeader title="Documents" gotoStep={3} />
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>PAN Document</Text><Text style={{ ...styles.reviewValue, color: docFiles.pan ? '#10B981' : '#EF4444' }}>{docFiles.pan ? 'Uploaded' : 'Missing'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Aadhaar Documents</Text><Text style={{ ...styles.reviewValue, color: (docFiles.aadharFront && docFiles.aadharBack) ? '#10B981' : '#EF4444' }}>{docFiles.aadharFront && docFiles.aadharBack ? 'Front & Back Uploaded' : 'Missing'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>GST Certificate</Text><Text style={{ ...styles.reviewValue, color: docFiles.gst ? '#10B981' : '#EF4444' }}>{docFiles.gst ? 'Uploaded' : 'Missing'}</Text></View>
                {kyc.msmeNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>MSME Certificate</Text><Text style={{ ...styles.reviewValue, color: docFiles.msme ? '#10B981' : '#EF4444' }}>{docFiles.msme ? 'Uploaded' : 'Missing'}</Text></View>}
                {kyc.fssaiNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>FSSAI Certificate</Text><Text style={{ ...styles.reviewValue, color: docFiles.fssai ? '#10B981' : '#EF4444' }}>{docFiles.fssai ? 'Uploaded' : 'Missing'}</Text></View>}

                {/* Agreements */}
                <SectionHeader title="Agreements" gotoStep={4} />
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Privacy Policy</Text><Text style={{ ...styles.reviewValue, color: agreements.privacyAccepted ? '#10B981' : '#EF4444' }}>{agreements.privacyAccepted ? 'Accepted' : 'Not accepted'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Terms & Conditions</Text><Text style={{ ...styles.reviewValue, color: agreements.termsAccepted ? '#10B981' : '#EF4444' }}>{agreements.termsAccepted ? 'Accepted' : 'Not accepted'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Partner Agreement</Text><Text style={{ ...styles.reviewValue, color: agreements.partnerAccepted ? '#10B981' : '#EF4444' }}>{agreements.partnerAccepted ? 'Accepted' : 'Not accepted'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Aadhaar eSign</Text><Text style={{ ...styles.reviewValue, color: agreements.signed ? '#10B981' : '#EF4444' }}>{agreements.signed ? 'Signed' : 'Pending'}</Text></View>
                {agreements.signed && agreements.txnIds.length > 0 && (
                    <View style={styles.reviewRow}><Text style={styles.reviewLabel}>eSign Txn Ids</Text><Text style={[styles.reviewValue, { flex: 2, fontSize: 11, textAlign: 'right' }]} numberOfLines={3}>{agreements.txnIds.join('\n')}</Text></View>
                )}

                {/* Subscription */}
                <SectionHeader title="Subscription & Payment" gotoStep={5} />
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Category Tier</Text><Text style={styles.reviewValue}>{isPremium ? 'Premium' : 'Standard'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Per-store price</Text><Text style={styles.reviewValue}>₹{perStorePrice.toLocaleString('en-IN')}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>{storeCount} × ₹{perStorePrice}</Text><Text style={styles.reviewValue}>₹{subtotal.toLocaleString('en-IN')}</Text></View>
                {couponDiscount > 0 && (
                    <View style={styles.reviewRow}><Text style={[styles.reviewLabel, { color: '#10B981' }]}>Coupon ({couponCode.toUpperCase()})</Text><Text style={[styles.reviewValue, { color: '#10B981' }]}>− ₹{couponDiscount.toLocaleString('en-IN')}</Text></View>
                )}
                <View style={styles.reviewRow}><Text style={{ ...styles.reviewLabel, fontWeight: '700' }}>Total Paid</Text><Text style={{ ...styles.reviewValue, fontWeight: '700' }}>₹{total.toLocaleString('en-IN')}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Payment Status</Text><Text style={{ ...styles.reviewValue, color: paymentStatus === 'success' ? '#10B981' : '#9CA3AF' }}>{paymentStatus === 'success' ? 'Successful' : 'Pending'}</Text></View>
                {paymentDetails?.paymentId && (
                    <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Transaction ID</Text><Text style={styles.reviewValue} numberOfLines={1}>{paymentDetails.paymentId}</Text></View>
                )}
            </View>
        </>
    );
}
