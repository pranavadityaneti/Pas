/**
 * StepAgreements — Step 4 of merchant signup.
 *
 * 2026-06-14 (e-Sign V1): Replaces the v0 stub (external links + trust checkbox
 * + fake 1.5s Digio simulation). The merchant now:
 *   1. Reads the personalized Partner Agreement IN-APP (their own details merged
 *      into the header), gated by scroll-to-end.
 *   2. Accepts Privacy + Terms + Partner Agreement (checkboxes enable only after
 *      scrolling the agreement to the end).
 *   3. Draws their signature on screen (SignaturePad).
 *   4. A personalized, signed PDF is generated (expo-print), uploaded to the
 *      private merchant-docs bucket, and a consent record is persisted server-
 *      side (merchant_consents) with IP + audit trail.
 *
 * Routing: the correct agreement (grocery / other-stores / restaurant) is chosen
 * from the merchant's vertical via verticalToAgreement(). Aadhaar eSign is NOT
 * used — this is a drawn electronic signature under the IT Act, 2000.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  ScrollView,
  Modal,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../constants/Colors';
import { supabase } from '../../../lib/supabase';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';
import AgreementDocumentView from '../agreements/components/AgreementDocumentView';
import SignaturePad from '../agreements/components/SignaturePad';
import { verticalToAgreement } from '../agreements/content';
import type { MerchantAgreementData } from '../agreements/content/types';
import type { DrawnSignature } from '../agreements/buildAgreementHtml';
import { signAndPersistAgreement, formatAcceptanceDate } from '../agreements/services/signAgreement';

const DOC_URLS = {
  privacy: 'https://www.pickatstore.io/privacypolicy/merchant-app',
  terms: 'https://www.pickatstore.io/terms/merchant-app',
};

export function StepAgreements() {
  const { agreements, setAgreements, selectedVertical, identity, store, stores, kyc } = useSignupContext();

  const [userId, setUserId] = useState<string>('');
  const [scrolledEnd, setScrolledEnd] = useState(false);
  const [showPad, setShowPad] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data?.session?.user?.id) setUserId(data.session.user.id);
    });
    return () => {
      active = false;
    };
  }, []);

  const agreementType = useMemo(
    () => verticalToAgreement(selectedVertical?.name ?? store.categoryName),
    [selectedVertical, store.categoryName],
  );

  const merchant: MerchantAgreementData = useMemo(() => {
    const primary = stores?.[0];
    const merchantId = userId
      ? `PAS-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
      : '—';
    return {
      businessName: primary?.name || store.storeName || '—',
      storeCategory: selectedVertical?.name || store.categoryName || '—',
      signatoryName: identity.ownerName || '—',
      designation: identity.designation || '—',
      placeOfBusiness:
        [primary?.address || store.address, primary?.city || store.city].filter(Boolean).join(', ') || '—',
      pan: kyc.panNumber || '—',
      aadhaar: kyc.aadharNumber || undefined,
      gstin: kyc.gstNumber || undefined,
      fssai: kyc.fssaiNumber || undefined,
      phone: identity.phone || '—',
      email: identity.email || '—',
      merchantId,
      acceptanceDate: formatAcceptanceDate(new Date()),
    };
  }, [userId, identity, store, stores, kyc, selectedVertical]);

  const allAccepted = agreements.privacyAccepted && agreements.termsAccepted && agreements.partnerAccepted;
  const canSign = scrolledEnd && allAccepted && !signing && !agreements.signed;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (scrolledEnd) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 28) {
      setScrolledEnd(true);
    }
  };

  // If the rendered agreement is shorter than the box (unlikely), don't trap the user.
  const onContentSizeChange = (_w: number, h: number) => {
    if (!scrolledEnd && h <= 360) setScrolledEnd(true);
  };

  const openDoc = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Cannot open', 'Unable to open this document in your browser.');
    } catch {
      Alert.alert('Error', 'Failed to open the document. Try again.');
    }
  };

  const startSigning = () => {
    if (!identity.ownerName || !identity.designation) {
      Alert.alert(
        'Profile incomplete',
        'Your owner name and designation (Step 1) are required on the signed agreement. Please go back and complete them.',
      );
      return;
    }
    if (!kyc.panNumber) {
      Alert.alert('PAN required', 'Your PAN (Step 5) appears on the agreement. Please add it before signing.');
      return;
    }
    setShowPad(true);
  };

  const handleSignatureConfirm = async (signature: DrawnSignature) => {
    setShowPad(false);
    setSigning(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) throw new Error('Your session expired. Please restart signup and try again.');
      const now = new Date();
      const res = await signAndPersistAgreement({
        type: agreementType,
        merchant,
        userId: uid,
        signature,
        accepted: {
          privacy: agreements.privacyAccepted,
          terms: agreements.termsAccepted,
          partner: agreements.partnerAccepted,
        },
        signedAt: now,
      });
      setAgreements({ ...agreements, signed: true, txnIds: res.consentId ? [res.consentId] : [] });
    } catch (e: any) {
      Alert.alert('Could not sign', e?.message || 'Please try again.');
    } finally {
      setSigning(false);
    }
  };

  const renderCheckbox = (label: string, checked: boolean, toggle: () => void, openUrl?: string) => (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        style={[styles.checkboxRow, !scrolledEnd && styles.buttonDisabled]}
        onPress={scrolledEnd ? toggle : undefined}
        activeOpacity={scrolledEnd ? 0.7 : 1}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.checkboxLabel}>{label}</Text>
          {openUrl && (
            <TouchableOpacity onPress={() => openDoc(openUrl)}>
              <Text style={{ fontSize: 13, color: Colors.primary, marginTop: 2, fontWeight: '600' }}>
                Open document
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  // ── Signed success state ─────────────────────────────────────────────
  if (agreements.signed) {
    return (
      <View style={[styles.card, styles.successCard]}>
        <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        <Text style={styles.successTitle}>Agreement signed</Text>
        <Text style={styles.successText}>
          Signed by {identity.ownerName} ({identity.designation}) on {merchant.acceptanceDate}.{'\n'}
          A signed copy has been saved to your account.
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>Agreement & signature</Text>
        </View>
        <Text style={{ fontSize: 13, color: '#6B7280' }}>
          Please read the full Partner Agreement below — it carries your business details. Scroll to the
          end, accept all three, then sign on screen.
        </Text>
      </View>

      {/* In-app, scroll-gated agreement reader */}
      <View style={styles.card}>
        <ScrollView
          style={{
            height: 360,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 8,
            paddingHorizontal: 12,
            backgroundColor: '#FFFFFF',
          }}
          nestedScrollEnabled
          onScroll={onScroll}
          scrollEventThrottle={64}
          onContentSizeChange={onContentSizeChange}
          showsVerticalScrollIndicator
        >
          <AgreementDocumentView type={agreementType} merchant={merchant} />
        </ScrollView>
        <Text style={{ fontSize: 12, color: scrolledEnd ? '#10B981' : '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
          {scrolledEnd ? '✓ You have read the full agreement' : '↓ scroll to the end to continue'}
        </Text>
      </View>

      {/* Acceptance checkboxes (enabled only after scroll-to-end) */}
      <View style={styles.card}>
        {renderCheckbox(
          'I have read the Privacy Policy',
          agreements.privacyAccepted,
          () => setAgreements({ ...agreements, privacyAccepted: !agreements.privacyAccepted }),
          DOC_URLS.privacy,
        )}
        {renderCheckbox(
          'I accept the Terms of Service',
          agreements.termsAccepted,
          () => setAgreements({ ...agreements, termsAccepted: !agreements.termsAccepted }),
          DOC_URLS.terms,
        )}
        {renderCheckbox(
          'I accept the Partner Agreement above',
          agreements.partnerAccepted,
          () => setAgreements({ ...agreements, partnerAccepted: !agreements.partnerAccepted }),
        )}
      </View>

      <TouchableOpacity
        onPress={startSigning}
        disabled={!canSign}
        style={[
          {
            height: 56,
            backgroundColor: Colors.primary,
            borderRadius: 12,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginVertical: 16,
          },
          !canSign && styles.buttonDisabled,
        ]}
      >
        {signing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="create-outline" size={22} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Sign agreement</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 12 }}>
        Your drawn signature, the accepted documents, and a timestamped audit record are saved with your
        application.
      </Text>

      {/* Signature pad modal */}
      <Modal visible={showPad} transparent animationType="slide" onRequestClose={() => setShowPad(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: undefined }]}>
            <Text style={styles.modalTitle}>Sign here</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 12, textAlign: 'center' }}>
              Use your finger to sign inside the box.
            </Text>
            <SignaturePad
              onConfirm={handleSignatureConfirm}
              signatoryLabel={`${identity.ownerName} · ${identity.designation}`}
              height={200}
            />
            <TouchableOpacity onPress={() => setShowPad(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
