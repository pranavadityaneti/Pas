/**
 * StepAgreements — Step 4 of merchant signup (v2 NEW).
 *
 * 2026-06-04 (Phase 2.D): Three documents must be read and accepted before
 * the merchant can sign with Aadhaar eSign:
 *   1. Privacy Policy (constant URL)
 *   2. Terms & Conditions (constant URL)
 *   3. Partner Agreement (selected by vertical:
 *      restaurant / grocery / other)
 *
 * Per spec docs/merchant-signup-v2-spec.md (Step 4):
 *  - Each doc rendered in a viewer with "I have read" checkbox below
 *  - Spec calls for the checkbox to be DISABLED until scroll-to-bottom,
 *    but that requires react-native-webview which needs a native build.
 *    v0 ships with a trust-based checkbox + external-browser link via
 *    expo-linking.openURL — upgrade to scroll-tracked WebView in the
 *    next native build cycle.
 *  - All 3 checkboxes checked → "Sign with Aadhaar eSign" button enables
 *  - eSign uses Digio Aadhaar OTP batch flow (server endpoint TBD,
 *    blocked on Digio credentials per spec blocker B7). v0 stubs the
 *    eSign with a 1.5s success simulation so the rest of the flow
 *    end-to-end-tests; Phase 2.D2 wires real Digio.
 *
 * Per-vertical agreement selection follows spec:
 *   - vertical.requiresFssai || vertical.isDining → "For Restaurants"
 *   - (TODO when we have a clear grocery flag) → "For Groceries"
 *   - default → "For Other Stores"
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';

/**
 * 2026-06-04 (Phase 2.D): Document URLs. v0 hardcoded to public marketing
 * pages; Phase 2.D2 will swap to versioned PDFs in the merchant-agreements
 * bucket with per-merchant signatory blocks filled in.
 */
const DOC_URLS = {
    privacy: 'https://www.pickatstore.io/privacypolicy/merchant-app',
    terms: 'https://www.pickatstore.io/terms/merchant-app',
    partnerRestaurant: 'https://www.pickatstore.io/agreements/partner-restaurant',
    partnerGrocery: 'https://www.pickatstore.io/agreements/partner-grocery',
    partnerOther: 'https://www.pickatstore.io/agreements/partner-other',
};

export function StepAgreements() {
    const { agreements, setAgreements, selectedVertical, identity } = useSignupContext();
    const [signing, setSigning] = useState(false);

    const partnerDoc = useMemo(() => {
        if (selectedVertical?.requiresFssai || selectedVertical?.isDining) {
            return { title: 'Partner Agreement — For Restaurants', url: DOC_URLS.partnerRestaurant };
        }
        // TODO: when grocery vertical flag is defined, route to partnerGrocery
        return { title: 'Partner Agreement — For Other Stores', url: DOC_URLS.partnerOther };
    }, [selectedVertical]);

    const openDoc = async (url: string) => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Cannot Open', `Unable to open ${url}. Please check your browser.`);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to open the document. Try again.');
        }
    };

    const allAccepted =
        agreements.privacyAccepted &&
        agreements.termsAccepted &&
        agreements.partnerAccepted;

    /**
     * 2026-06-04 (Phase 2.D): eSign stub. Real Digio integration (Phase 2.D2)
     * will call POST /merchant-signup/esign-batch on the API, redirect to
     * Digio's webview for Aadhaar OTP, and webhook back with signed PDFs +
     * txn IDs.
     */
    const handleSign = async () => {
        if (!allAccepted) return;
        if (!identity.ownerName || !identity.designation) {
            Alert.alert(
                'Profile Incomplete',
                'Your owner name and designation must be filled at Step 1 before signing. Please go back and complete them.',
            );
            return;
        }
        setSigning(true);
        try {
            // ── Digio stub ─────────────────────────────────────────────────
            // Simulates a successful Aadhaar eSign after 1.5s. The real flow
            // opens Digio's webview, collects Aadhaar OTP, signs, webhooks back.
            await new Promise(resolve => setTimeout(resolve, 1500));
            const stubTxnIds = [
                `STUB-PRIV-${Date.now()}`,
                `STUB-TERM-${Date.now()}`,
                `STUB-PART-${Date.now()}`,
            ];
            setAgreements({
                ...agreements,
                signed: true,
                txnIds: stubTxnIds,
            });
            Alert.alert(
                'Signed (simulated)',
                'Documents signed via simulated Digio eSign. Real Aadhaar OTP integration is staged for Phase 2.D2.',
            );
        } catch (e: any) {
            Alert.alert('Sign Failed', e?.message || 'Could not complete eSign. Please try again.');
        } finally {
            setSigning(false);
        }
    };

    const renderDocCard = (
        title: string,
        description: string,
        url: string,
        accepted: boolean,
        toggle: () => void,
    ) => (
        <View style={[styles.card, accepted && { borderColor: Colors.primary, borderWidth: 1 }]}>
            <View style={styles.cardHeader}>
                <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
                <Text style={styles.cardTitle}>{title}</Text>
                {accepted && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
                {description}
            </Text>
            <TouchableOpacity
                style={[styles.locationButton, { marginBottom: 12 }]}
                onPress={() => openDoc(url)}
            >
                <Ionicons name="open-outline" size={18} color={Colors.primary} />
                <Text style={styles.locationButtonText}>Open document</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.checkboxRow}
                onPress={toggle}
            >
                <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                    {accepted && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.checkboxLabel}>I have read this document</Text>
                </View>
            </TouchableOpacity>
        </View>
    );

    return (
        <>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
                    <Text style={styles.cardTitle}>Agreements & Consent</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#6B7280' }}>
                    Read the three documents below, mark each as read, then sign all of them in
                    one Aadhaar OTP via Digio.
                </Text>
            </View>

            {renderDocCard(
                'Privacy Policy',
                'How Pick At Store handles personal data and merchant information.',
                DOC_URLS.privacy,
                agreements.privacyAccepted,
                () => setAgreements({ ...agreements, privacyAccepted: !agreements.privacyAccepted }),
            )}

            {renderDocCard(
                'Terms & Conditions',
                'Platform usage rules, dispute resolution, and your obligations as a partner.',
                DOC_URLS.terms,
                agreements.termsAccepted,
                () => setAgreements({ ...agreements, termsAccepted: !agreements.termsAccepted }),
            )}

            {renderDocCard(
                partnerDoc.title,
                'The category-specific partner agreement covering commission, settlements, and lifetime listing rights.',
                partnerDoc.url,
                agreements.partnerAccepted,
                () => setAgreements({ ...agreements, partnerAccepted: !agreements.partnerAccepted }),
            )}

            <TouchableOpacity
                onPress={handleSign}
                disabled={!allAccepted || signing || agreements.signed}
                style={[
                    {
                        height: 56,
                        backgroundColor: agreements.signed ? '#10B981' : Colors.primary,
                        borderRadius: 12,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginVertical: 16,
                    },
                    (!allAccepted || signing) && styles.buttonDisabled,
                ]}
            >
                {signing ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : agreements.signed ? (
                    <>
                        <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                            Signed
                        </Text>
                    </>
                ) : (
                    <>
                        <Ionicons name="finger-print-outline" size={22} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                            Sign with Aadhaar eSign
                        </Text>
                    </>
                )}
            </TouchableOpacity>

            {!agreements.signed && (
                <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 12 }}>
                    Once signed, the documents and your signature timestamps are stored permanently
                    in your account audit log.
                </Text>
            )}
        </>
    );
}
