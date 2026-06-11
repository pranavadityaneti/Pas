// CouponsSection — horizontal carousel of available coupons on the checkout screen.
//
// Behavior:
//   - On mount, GET /coupons/available (requires auth; filters: active + valid window +
//     audience-match + store-scope from prop).
//   - Renders each row as <CouponCard /> in a horizontal ScrollView.
//   - Tap on a card → POST /checkout/validate-coupon with current subtotal. On success,
//     callback to parent with { couponId, code, discount, bogo, message }. On failure,
//     surface the API's error in an Alert (e.g. "Add ₹50 more").
//   - Tapping the already-applied card invokes onRemove.
//
// Used by: CheckoutScreen, DiningCheckoutScreen.
// Lives outside the locked screen files so the lock-override scope stays minimal
// (each screen only imports + renders this; logic is here).

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { apiClient, validateCoupon, type ValidateCouponCartItem } from '../lib/api';
import { CouponCard, type Coupon } from './CouponCard';
import { useCart } from '../context/CartContext';

export interface AppliedCouponInfo {
  couponId: string;
  code: string;
  discount: number;
  discountType: Coupon['discountType'];
  bogo: { buy: number; get: number } | null;
  // Phase 4 (2026-06-09): callers receive the server-signed token + expiry so
  // they can persist these to CartContext (for forwarding into POST /orders).
  validationToken: string;
  expiresAt: number;
  fundingSource: 'PLATFORM' | 'MERCHANT' | null;
}

interface CouponsSectionProps {
  /** Current cart subtotal — drives validate-coupon's minOrder check + discount math. */
  subtotal: number;
  /** Current store/branch id; lets the API include store-bound coupons relevant here. */
  storeId?: string | null;
  /** id of the currently-applied coupon, if any — so we can highlight + "remove" on tap. */
  appliedCouponId?: string | null;
  /** Called on successful validate-coupon. Parent should update its discount state. */
  onApply: (info: AppliedCouponInfo) => void;
  /** Called when user taps the already-applied card to remove it. */
  onRemove?: () => void;
  /** Optional override for the header text (default: "Available offers"). */
  title?: string;
}

export function CouponsSection({
  subtotal,
  storeId,
  appliedCouponId,
  onApply,
  onRemove,
  title = 'Available offers',
}: CouponsSectionProps) {
  // Phase 4 (2026-06-09) — pull cart items for the Phase 2L strict payload.
  const { items: cartItems } = useCart();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<string | null>(null); // couponId currently being validated

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const qs = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
        const r = await apiClient.fetch(`/coupons/available${qs}`);
        if (!r.ok) {
          // 401 is handled inside apiClient (soft-refresh). For other failures, fail quietly —
          // don't block the checkout if coupons can't load.
          if (!cancelled) setCoupons([]);
          return;
        }
        const json = await r.json();
        if (!cancelled) setCoupons(Array.isArray(json?.data) ? json.data : []);
      } catch (e) {
        if (!cancelled) setCoupons([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const handlePress = useCallback(
    async (c: Coupon) => {
      // Tap the already-applied one → remove.
      if (appliedCouponId === c.id) {
        onRemove?.();
        return;
      }
      // Phase 4 — build the strict cartItems[] payload from CartContext.
      // Reject client-side if any item is missing storeProductId (clearer UX
      // than the server's 400 "refresh your cart" message).
      const validatePayload: ValidateCouponCartItem[] = [];
      for (const ci of cartItems) {
        if (!ci.storeProductId) {
          Alert.alert(
            "Couldn't apply",
            'Some items in your cart are out of date. Please refresh your cart and try again.'
          );
          return;
        }
        validatePayload.push({
          storeProductId: String(ci.storeProductId),
          quantity: ci.quantity,
          price: ci.price,
          id: ci.id,
          name: ci.name,
        });
      }
      const storeIds = Array.from(new Set(cartItems.map((ci) => String(ci.storeId))));
      const orderType: 'pickup' | 'dining' | undefined =
        cartItems.length > 0 ? (cartItems[0].isDining ? 'dining' : 'pickup') : undefined;
      setValidating(c.id);
      try {
        const result = await validateCoupon({
          code: c.code,
          cartItems: validatePayload,
          storeIds,
          orderType,
          storeId: storeId ?? undefined,
        });
        if (!result.valid) {
          Alert.alert("Couldn't apply", result.error);
          return;
        }
        onApply({
          couponId: result.couponId,
          code: result.code,
          discount: result.discount,
          discountType: c.discountType,
          bogo: result.bogo ?? null,
          validationToken: result.validationToken,
          expiresAt: result.expiresAt,
          fundingSource: result.fundingSource,
        });
      } catch (e: any) {
        Alert.alert("Couldn't apply", 'Please try again in a moment.');
      } finally {
        setValidating(null);
      }
    },
    [appliedCouponId, cartItems, onApply, onRemove, storeId]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>{title}</Text>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Finding offers for you…</Text>
        </View>
      </View>
    );
  }

  if (!coupons.length) {
    return null; // empty + quiet — no "no offers" noise on checkout
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {coupons.map((c) => {
          const isApplied = appliedCouponId === c.id;
          const isValidating = validating === c.id;
          return (
            <View key={c.id} style={styles.cardWrap}>
              <CouponCard
                coupon={c}
                width={300}
                faded={isValidating}
                onPress={() => handlePress(c)}
              />
              {isApplied && (
                <View style={styles.appliedBadge} pointerEvents="none">
                  <Text style={styles.appliedText}>✓ Applied — tap to remove</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f1f1f',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 12,
  },
  cardWrap: {
    marginHorizontal: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#666',
  },
  appliedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  appliedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default CouponsSection;
