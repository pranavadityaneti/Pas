// CouponsScreen — Swiggy-style "Apply Coupon" screen.
//
// Flow:
//   CheckoutScreen / DiningCheckoutScreen tap the "🎟️ Apply Coupon ›" row
//     → navigate('Coupons', { subtotal, storeId, appliedCouponId, returnTo })
//     → user taps a card OR enters a code + APPLY
//     → POST /checkout/validate-coupon
//     → on success: navigate(returnTo, { selectedCoupon: {...} }, { merge: true })
//
// Cards render via the same `CouponCard` component the admin builder uses
// (theme-faithful, logo-image-faithful — same brand ticket the admin designed).
//
// Sections:
//   - Code entry at top (manual override path).
//   - "Best coupon" — the single highest estimated-savings coupon for THIS cart.
//   - "More offers" — every other eligible coupon, sorted by estimated savings desc.
//
// Estimated savings are client-computed for the *display ranking only*.
// The actual discount applied to the cart is whatever the server's validate-coupon
// returns (single source of truth).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation, useRoute, CommonActions, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../lib/api';
import { CouponCard, type Coupon } from '../components/CouponCard';
import type { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Coupons'>;
type RtProp = RouteProp<RootStackParamList, 'Coupons'>;

/** Heuristic client-side savings for ranking. The server is the truth at apply-time. */
function estimatedSavings(c: Coupon, subtotal: number): number {
  if (c.discountType === 'FLAT') return Math.max(0, c.discountValue || 0);
  if (c.discountType === 'PERCENTAGE') {
    const raw = (subtotal * (c.discountValue || 0)) / 100;
    return c.maxDiscountCap ? Math.min(raw, c.maxDiscountCap) : raw;
  }
  // BOGO — without item-level info we can't compute precisely. Use discountValue as a proxy.
  return c.discountValue || 0;
}

export default function CouponsScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RtProp>();
  const { subtotal, storeId, appliedCouponId, returnTo } = route.params;

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [applying, setApplying] = useState<string | null>(null);    // couponId or 'manual'
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load eligible coupons on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const qs = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
        const r = await apiClient.fetch(`/coupons/available${qs}`);
        if (!r.ok) {
          if (!cancelled) setCoupons([]);
          return;
        }
        const j = await r.json();
        if (!cancelled) setCoupons(Array.isArray(j?.data) ? j.data : []);
      } catch {
        if (!cancelled) setCoupons([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  // Rank by estimated savings desc; carve out the best one.
  const { best, more } = useMemo(() => {
    const ranked = [...coupons].sort(
      (a, b) => estimatedSavings(b, subtotal) - estimatedSavings(a, subtotal)
    );
    if (!ranked.length) return { best: null as Coupon | null, more: [] as Coupon[] };
    return { best: ranked[0], more: ranked.slice(1) };
  }, [coupons, subtotal]);

  const applyCoupon = useCallback(
    async (code: string, sourceKey: string) => {
      setErrorMsg(null);
      setApplying(sourceKey);
      try {
        const r = await apiClient.fetch('/checkout/validate-coupon', {
          method: 'POST',
          body: JSON.stringify({ code: code.toUpperCase(), cartTotal: subtotal, storeId: storeId ?? undefined }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.valid) {
          setErrorMsg(j?.error || 'This coupon could not be applied.');
          return;
        }
        // Hand off to the returnTo checkout screen. Checkout lives 3 navigators deep
        // (Root → Main(tabs) → Cart(tab) → CartStack → Checkout), so a flat
        // navigate({name:'Checkout'}) from the root-level CouponsScreen fails
        // ("not handled by any navigator"). Use a nested target so React Navigation
        // walks the tree, finds the existing Checkout instance, and merges params
        // instead of pushing a duplicate.
        const selectedCoupon = {
          couponId: j.couponId,
          code: j.code,
          discount: Number(j.discount) || 0,
          discountType: j.discountType,
          bogo: j.bogo ?? null,
        };
        navigation.dispatch(
          CommonActions.navigate({
            name: 'Main',
            params: {
              screen: 'Cart',
              params: {
                screen: returnTo,
                params: { selectedCoupon },
                merge: true,
              },
              merge: true,
            },
            merge: true,
          })
        );
      } catch {
        setErrorMsg('Network hiccup. Please try again.');
      } finally {
        setApplying(null);
      }
    },
    [navigation, returnTo, storeId, subtotal]
  );

  const onApplyManual = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) {
      setErrorMsg('Enter a coupon code first.');
      return;
    }
    applyCoupon(trimmed, 'manual');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={styles.backBtn}
          >
            <ChevronLeft size={26} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Apply Coupon</Text>
            <Text style={styles.headerSub}>Your Cart: ₹{subtotal.toFixed(2)}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Code entry */}
          <View style={styles.codeRow}>
            <TextInput
              value={manualCode}
              onChangeText={(t) => setManualCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
              placeholder="Enter Coupon Code"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.codeInput}
              returnKeyType="done"
              onSubmitEditing={onApplyManual}
            />
            <TouchableOpacity
              onPress={onApplyManual}
              disabled={applying === 'manual' || !manualCode.trim()}
              style={[
                styles.applyBtn,
                (!manualCode.trim() || applying === 'manual') && styles.applyBtnDisabled,
              ]}
            >
              {applying === 'manual' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.applyBtnText}>APPLY</Text>
              )}
            </TouchableOpacity>
          </View>

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          {/* Loading state */}
          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#b42926" />
              <Text style={styles.loadingText}>Finding the best offers for you…</Text>
            </View>
          )}

          {/* Empty state — quiet but informative */}
          {!loading && !best && !more.length && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No offers available right now</Text>
              <Text style={styles.emptyBody}>
                Have a code? Type it above and tap Apply.
              </Text>
            </View>
          )}

          {/* Best coupon */}
          {best && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Best coupon</Text>
              <CouponCard
                coupon={best}
                width={cardWidth()}
                faded={applying === best.id}
                onPress={() => applyCoupon(best.code, best.id)}
              />
              {appliedCouponId === best.id && (
                <Text style={styles.appliedNote}>Currently applied — tap a different one to swap.</Text>
              )}
            </View>
          )}

          {/* More offers */}
          {more.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>More offers</Text>
              {more.map((c) => (
                <View key={c.id} style={{ marginBottom: 14 }}>
                  <CouponCard
                    coupon={c}
                    width={cardWidth()}
                    faded={applying === c.id}
                    onPress={() => applyCoupon(c.code, c.id)}
                  />
                  {appliedCouponId === c.id && (
                    <Text style={styles.appliedNote}>Currently applied — tap a different one to swap.</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { Dimensions } from 'react-native';
function cardWidth() {
  // Full-width minus screen padding. Matches admin preview density at this width.
  const w = Dimensions.get('window').width;
  return Math.min(w - 24, 540);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12.5, color: '#6B7280', marginTop: 1 },

  scroll: { paddingTop: 14, paddingBottom: 24, paddingHorizontal: 12 },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  codeInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#111827',
    paddingVertical: 10,
  },
  applyBtn: {
    backgroundColor: '#b42926',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    marginLeft: 8,
    minWidth: 76,
    alignItems: 'center',
  },
  applyBtnDisabled: { backgroundColor: '#D1D5DB' },
  applyBtnText: { color: '#fff', fontWeight: '800', letterSpacing: 0.6, fontSize: 13 },

  errorText: { color: '#DC2626', fontSize: 13, marginTop: 8, fontWeight: '600' },

  loadingBox: { marginTop: 28, alignItems: 'center' },
  loadingText: { color: '#6B7280', fontSize: 13, marginTop: 8 },

  emptyBox: { marginTop: 32, alignItems: 'center', paddingHorizontal: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyBody: { fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'center' },

  section: { marginTop: 22 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 10,
    marginLeft: 2,
  },
  appliedNote: {
    fontSize: 11.5,
    color: '#10B981',
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '700',
  },
});
