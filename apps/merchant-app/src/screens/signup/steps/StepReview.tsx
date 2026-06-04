/**
 * StepReview — Step 7 of merchant signup (read-only summary before submit).
 *
 * 2026-06-04 (Phase 1.7.C): Pure context-consumer. No handlers. No local
 * state. Renders a complete read-only summary of identity, store, branches,
 * KYC, documents, and payment status. The Submit action lives in the
 * orchestrator footer (handleFinalSubmit).
 *
 * Behavior preservation: every label, every conditional render
 * (kyc.gstNumber gated GST cert row, kyc.msmeNumber gated MSME cert row,
 * kyc.fssaiNumber gated FSSAI cert row, hasBranches gated branch count
 * row), every color-by-status (#10B981 green / #EF4444 red), and every
 * bank-account masking pattern (`XXXX${last4}`) — preserved verbatim.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';

export function StepReview() {
    const {
        identity, store, hasBranches, branches, kyc, docFiles,
        storePhotos, selectedVertical, paymentStatus, paymentDetails,
    } = useSignupContext();

    return (
        <>
            <View style={[styles.card, styles.successCard]}>
                <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                <Text style={styles.successTitle}>Ready to Submit!</Text>
                <Text style={styles.successText}>
                    Your application will be reviewed within 24-48 hours.
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.reviewTitle}>Complete Summary</Text>

                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4 }}>Identity & Store</Text>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Owner</Text><Text style={styles.reviewValue}>{identity.ownerName}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Phone</Text><Text style={styles.reviewValue}>{identity.phone || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Email</Text><Text style={styles.reviewValue}>{identity.email || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Store Name</Text><Text style={styles.reviewValue}>{store.storeName}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Category</Text><Text style={styles.reviewValue}>{store.categoryName}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>City</Text><Text style={styles.reviewValue}>{store.city}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Address</Text><Text style={[styles.reviewValue, {flex: 2, textAlign: 'right'}]} numberOfLines={2}>{store.address || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Location Pin</Text><Text style={styles.reviewValue}>{store.latitude && store.longitude ? 'Captured' : 'Missing'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Has Branches</Text><Text style={styles.reviewValue}>{hasBranches ? 'Yes' : 'No'}</Text></View>
                {hasBranches && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Branches Added</Text><Text style={styles.reviewValue}>{branches.length}</Text></View>}

                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4 }}>KYC & Financials</Text>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>PAN Number</Text><Text style={styles.reviewValue}>{kyc.panNumber || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Aadhar Number</Text><Text style={styles.reviewValue}>{kyc.aadharNumber || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>GSTIN</Text><Text style={styles.reviewValue}>{kyc.gstNumber || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>MSME Number</Text><Text style={styles.reviewValue}>{kyc.msmeNumber || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>FSSAI Number</Text><Text style={styles.reviewValue}>{kyc.fssaiNumber || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Bank Account</Text><Text style={styles.reviewValue}>{kyc.bankAccount ? `XXXX${kyc.bankAccount.slice(-4)}` : '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>IFSC Code</Text><Text style={styles.reviewValue}>{kyc.ifsc || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Beneficiary Name</Text><Text style={styles.reviewValue}>{kyc.beneficiaryName || '-'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Turnover Range</Text><Text style={styles.reviewValue}>{kyc.turnoverRange || '-'}</Text></View>

                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4 }}>Document Verification</Text>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Store Photos</Text><Text style={{...styles.reviewValue, color: storePhotos.length > 0 ? '#10B981' : '#EF4444'}}>{storePhotos.length > 0 ? `${storePhotos.length} Uploaded` : 'Missing'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>PAN Document</Text><Text style={{...styles.reviewValue, color: docFiles.pan ? '#10B981' : '#EF4444'}}>{docFiles.pan ? 'Uploaded' : 'Missing'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Aadhar Documents</Text><Text style={{...styles.reviewValue, color: (docFiles.aadharFront && docFiles.aadharBack) ? '#10B981' : '#EF4444'}}>{docFiles.aadharFront && docFiles.aadharBack ? 'Front & Back Uploaded' : 'Missing'}</Text></View>
                {kyc.gstNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>GST Certificate</Text><Text style={{...styles.reviewValue, color: docFiles.gst ? '#10B981' : '#EF4444'}}>{docFiles.gst ? 'Uploaded' : 'Missing'}</Text></View>}
                {kyc.msmeNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>MSME Certificate</Text><Text style={{...styles.reviewValue, color: docFiles.msme ? '#10B981' : '#EF4444'}}>{docFiles.msme ? 'Uploaded' : 'Missing'}</Text></View>}
                {kyc.fssaiNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>FSSAI Certificate</Text><Text style={{...styles.reviewValue, color: docFiles.fssai ? '#10B981' : '#EF4444'}}>{docFiles.fssai ? 'Uploaded' : 'Missing'}</Text></View>}

                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4 }}>Subscription & Payment</Text>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Category Tier</Text><Text style={styles.reviewValue}>{selectedVertical?.isPremium ? 'Premium' : 'Standard'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Lifetime Access</Text><Text style={styles.reviewValue}>{selectedVertical?.isPremium ? '₹2999' : '₹999'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Payment Status</Text><Text style={{...styles.reviewValue, color: '#10B981'}}>{paymentStatus === 'success' ? 'Successful' : 'Simulated'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Transaction ID</Text><Text style={styles.reviewValue}>{paymentDetails?.paymentId || 'Verified'}</Text></View>
            </View>
        </>
    );
}
