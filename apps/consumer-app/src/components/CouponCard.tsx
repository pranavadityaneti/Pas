// CouponCard — React Native render of the admin's coupon ticket.
//
// Mirrors `apps/admin-web/src/components/modules/marketing/CouponCard.tsx` at the
// theme/preset level so a coupon published in the admin builder renders 1:1 on the
// customer. Web-only CSS (`color-mix`, `WebkitMaskImage`, masked gradients) is
// replaced with RN-friendly equivalents:
//   - Pre-computed palette per theme (no color-mix).
//   - "Ticket perforation" via a column of small absolute-positioned dots overlaying
//     the tab/body boundary. Cheap, correct visual.
//
// API contract: takes the raw `Coupon` object from `GET /coupons/available` and
// renders it. No external transform required by callers.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

// ─── API-shape mirror (camelCase, matches apps/api Prisma output) ─────────────
export type DiscountType = 'PERCENTAGE' | 'FLAT' | 'BOGO';
export type CouponThemeId = 'classic' | 'bold' | 'modern' | 'festive';

export interface Coupon {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountCap: number | null;
  fundingSource: 'PLATFORM' | 'MERCHANT';
  targetAudience: 'ALL' | 'NEW_USERS' | 'INACTIVE_USERS';
  storeId: string | null;
  isActive: boolean;
  usageLimit: number | null;
  usedCount: number;
  startDate: string;
  endDate: string | null;
  minOrder: number | null;
  perCustomerLimit: number | null;
  bogoBuy: number | null;
  bogoGet: number | null;
  title: string | null;
  brandName: string | null;
  description: string | null;
  showLogo: boolean;
  logoUrl: string | null;
  autoCode: boolean;
  theme?: CouponThemeId;
}

// ─── Theme palettes (precomputed; no color-mix) ───────────────────────────────
// `hasTab` mirrors the admin-web mapping in
// apps/admin-web/src/components/modules/marketing/CouponCard.tsx (cardStyle 'modern'
// renders without the side-tab; classic/bold/festive do).
interface Palette {
  hasTab: boolean;
  bodyBg: string;
  tabBg: string;
  tabText: string;
  tabBorder: string;
  valueColor: string;
  textColor: string;
  divider: string;
  pillBg: string;
  pillText: string;
  codeLabel: string;
  codeColor: string;
  shadow: string;
}

const THEME_PALETTE: Record<CouponThemeId, Palette> = {
  // Classic — cream body, brand-red tab + value
  classic: {
    hasTab: true,
    bodyBg: '#f8efd8',
    tabBg: '#b42926',
    tabText: '#fbf3dc',
    tabBorder: 'rgba(251,243,220,0.7)',
    valueColor: '#b42926',
    textColor: '#8a6a55',
    divider: 'rgba(180,41,38,0.42)',
    pillBg: '#b42926',
    pillText: '#fbf3dc',
    codeLabel: '#8a6a55',
    codeColor: '#b42926',
    shadow: 'rgba(60,20,15,0.20)',
  },
  // Bold — brand-red body, darker-red tab, cream text
  bold: {
    hasTab: true,
    bodyBg: '#b42926',
    tabBg: '#7a1c1a',
    tabText: '#fdf5e6',
    tabBorder: 'rgba(253,245,230,0.55)',
    valueColor: '#fff7ec',
    textColor: 'rgba(255,247,236,0.82)',
    divider: 'rgba(255,247,236,0.42)',
    pillBg: '#fdf5e6',
    pillText: '#b42926',
    codeLabel: 'rgba(255,247,236,0.6)',
    codeColor: '#fff7ec',
    shadow: 'rgba(60,20,15,0.25)',
  },
  // Modern — white body, NO tab (matches admin-web cardStyle 'modern')
  modern: {
    hasTab: false,
    bodyBg: '#fffefb',
    tabBg: '#b42926',
    tabText: '#ffffff',
    tabBorder: 'rgba(255,255,255,0.5)',
    valueColor: '#b42926',
    textColor: '#73685c',
    divider: 'rgba(40,30,20,0.13)',
    pillBg: '#fbeae9',
    pillText: '#b42926',
    codeLabel: '#a99d8c',
    codeColor: '#2a2521',
    shadow: 'rgba(60,20,15,0.12)',
  },
  // Festive — saffron tones, comfy density (classic preset with saffron accent)
  festive: {
    hasTab: true,
    bodyBg: '#fff3d4',
    tabBg: '#d97706',
    tabText: '#fff7e6',
    tabBorder: 'rgba(255,247,230,0.7)',
    valueColor: '#d97706',
    textColor: '#8a6a35',
    divider: 'rgba(217,119,6,0.42)',
    pillBg: '#d97706',
    pillText: '#fff7e6',
    codeLabel: '#8a6a35',
    codeColor: '#d97706',
    shadow: 'rgba(60,40,10,0.20)',
  },
};

const fmtDateShort = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Digit-aware auto-shrink so wide values don't overflow the tight RN width.
// Matches the admin-web heuristic so the visual stays consistent.
const shrinkFor = (s: string) => Math.min(1, 3.6 / Math.max(s.length, 1));

interface CouponCardProps {
  coupon: Coupon;
  width?: number;
  faded?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function CouponCard({ coupon, width = 300, faded = false, onPress, disabled }: CouponCardProps) {
  const theme = THEME_PALETTE[coupon.theme ?? 'classic'] ?? THEME_PALETTE.classic;
  const s = width / 540;             // same scale ratio as the admin-web render
  const px = (n: number) => n * s;

  const title = (coupon.title ?? 'COUPON').toUpperCase();
  const brand = coupon.brandName ?? 'Pick At Store';
  const desc = coupon.description ?? 'Apply at checkout to save on your order.';
  const validLabel = coupon.endDate ? `Valid thru ${fmtDateShort(coupon.endDate)}` : 'Valid until cancelled';

  // Value-block content + auto-shrink
  let valueNode: React.ReactNode;
  if (coupon.discountType === 'PERCENTAGE') {
    const numStr = String(Math.round(coupon.discountValue));
    const k = shrinkFor(numStr);
    valueNode = (
      <View style={styles.valueRow}>
        <Text style={[styles.valueDigits, { fontSize: px(74) * k, color: theme.valueColor }]}>{numStr}</Text>
        <Text style={[styles.valuePercent, { fontSize: px(40) * k, color: theme.valueColor }]}>%</Text>
        <Text style={[styles.valueSuffix, { fontSize: px(26), color: theme.valueColor }]}>OFF</Text>
      </View>
    );
  } else if (coupon.discountType === 'BOGO') {
    const buy = coupon.bogoBuy ?? 1;
    const get = coupon.bogoGet ?? 1;
    valueNode = (
      <View>
        <Text style={[styles.valueBogo, { fontSize: px(48), color: theme.valueColor }]}>BOGO</Text>
        <Text style={[styles.valueBogoSub, { fontSize: px(13), color: theme.textColor }]}>
          Buy {buy}, get {get} free
        </Text>
      </View>
    );
  } else {
    // FLAT
    const amt = (coupon.discountValue || 0).toLocaleString('en-IN');
    const k = shrinkFor(amt);
    valueNode = (
      <View style={styles.valueRow}>
        <Text style={[styles.valueRupee, { fontSize: px(48) * k, color: theme.valueColor }]}>₹</Text>
        <Text style={[styles.valueDigits, { fontSize: px(78) * k, color: theme.valueColor }]}>{amt}</Text>
      </View>
    );
  }

  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { onPress, disabled, activeOpacity: 0.85 }
    : {};

  // Perforation dots running vertically between tab and body (ticket effect).
  // Layout-wise they sit absolute inside the tab column at its right edge.
  const dotsCount = Math.max(5, Math.round(px(180) / px(12)));
  const dots = Array.from({ length: dotsCount }, (_, i) => i);

  return (
    <Wrapper
      {...wrapperProps}
      style={[
        styles.shadow,
        {
          width,
          opacity: faded ? 0.55 : 1,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: theme.bodyBg, borderRadius: px(18) }]}>
        {/* Tab — rendered ONLY for themes that have one. Modern is no-tab. */}
        {theme.hasTab && (
          <View style={[styles.tab, { backgroundColor: theme.tabBg, width: px(70) }]}>
            <View
              style={[
                styles.tabInner,
                { borderColor: theme.tabBorder, borderRadius: px(7), margin: px(10) },
              ]}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: theme.tabText, fontSize: px(22), letterSpacing: px(6) },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {/* Perforation dots overlaying right edge of tab */}
            <View style={styles.dotsCol} pointerEvents="none">
              {dots.map((i) => (
                <View
                  key={i}
                  style={{
                    width: px(8),
                    height: px(8),
                    borderRadius: px(4),
                    backgroundColor: theme.bodyBg,
                    marginVertical: px(2),
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Body */}
        <View style={[styles.body, { padding: px(18) }]}>
          {/* Row 1: value + brand (image-when-logoUrl, fallback to text) */}
          <View style={styles.row1}>
            <View style={{ flex: 1, minWidth: 0 }}>{valueNode}</View>
            {coupon.showLogo && (
              <View style={[styles.brandCol, { marginLeft: px(12), maxWidth: px(120) }]}>
                {coupon.logoUrl ? (
                  <Image
                    source={{ uri: coupon.logoUrl }}
                    style={{ width: px(110), height: px(56), resizeMode: 'contain' }}
                    accessibilityLabel={`${brand} logo`}
                  />
                ) : (
                  <Text
                    style={[styles.brandText, { color: theme.valueColor, fontSize: px(15) }]}
                    numberOfLines={2}
                  >
                    {brand}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Row 2: dotted divider + description */}
          <View style={[styles.dividerDotted, { borderTopColor: theme.divider, marginTop: px(10), paddingTop: px(10) }]}>
            <Text style={[styles.description, { color: theme.textColor, fontSize: px(12) }]} numberOfLines={2}>
              {desc}
            </Text>
          </View>

          {/* Row 3: validity + code */}
          <View style={[styles.dividerDotted, styles.row3, { borderTopColor: theme.divider, marginTop: px(10), paddingTop: px(10) }]}>
            <View style={[styles.pill, { backgroundColor: theme.pillBg, paddingHorizontal: px(10), paddingVertical: px(5), borderRadius: px(5) }]}>
              <Text style={[styles.pillText, { color: theme.pillText, fontSize: px(11) }]} numberOfLines={1}>
                {validLabel}
              </Text>
            </View>
            {!!coupon.code && (
              <View style={styles.codeWrap}>
                <Text style={[styles.codeLabel, { color: theme.codeLabel, fontSize: px(9) }]}>REDEEM CODE</Text>
                <Text style={[styles.codeValue, { color: theme.codeColor, fontSize: px(18) }]}>{coupon.code}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Wrapper>
  );
}

// Convenience: small chip-style summary (used in OrderSummary or applied-state row).
// Not used in the carousel; reserved for "Applied: SUMMER20" inline display.
export function CouponSummaryChip({ coupon }: { coupon: Pick<Coupon, 'code' | 'theme' | 'discountType' | 'discountValue' | 'bogoBuy' | 'bogoGet'> }) {
  const theme = THEME_PALETTE[coupon.theme ?? 'classic'] ?? THEME_PALETTE.classic;
  const summary =
    coupon.discountType === 'PERCENTAGE'
      ? `${Math.round(coupon.discountValue)}% OFF`
      : coupon.discountType === 'BOGO'
      ? `BOGO ${coupon.bogoBuy ?? 1}+${coupon.bogoGet ?? 1}`
      : `₹${coupon.discountValue} OFF`;
  return (
    <View style={[styles.chip, { backgroundColor: theme.pillBg }]}>
      <Text style={[styles.chipCode, { color: theme.pillText }]} numberOfLines={1}>
        {coupon.code}
      </Text>
      <Text style={[styles.chipSummary, { color: theme.pillText }]} numberOfLines={1}>
        {summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  tabLabel: {
    fontWeight: '800',
    transform: [{ rotate: '-90deg' }],
    width: 200, // longer than will be needed; lets the rotated text not clip
    textAlign: 'center',
  },
  dotsCol: {
    position: 'absolute',
    right: -4,
    top: 0,
    bottom: 0,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  valueRupee: {
    fontWeight: '800',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  valueDigits: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  valuePercent: {
    fontWeight: '800',
  },
  valueSuffix: {
    fontWeight: '700',
    marginLeft: 4,
    marginBottom: 4,
    letterSpacing: 1,
  },
  valueBogo: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  valueBogoSub: {
    fontWeight: '600',
    marginTop: 2,
  },
  brandCol: {
    alignItems: 'flex-end',
  },
  brandText: {
    fontWeight: '800',
    textAlign: 'right',
  },
  dividerDotted: {
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
  },
  description: {
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  row3: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  pill: {
    alignSelf: 'flex-start',
  },
  pillText: {
    fontWeight: '700',
    fontStyle: 'italic',
  },
  codeWrap: {
    alignItems: 'flex-end',
  },
  codeLabel: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  codeValue: {
    fontFamily: 'Menlo', // iOS monospace; Android falls back to default monospace
    fontWeight: '700',
  },
  chip: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    gap: 8,
  },
  chipCode: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chipSummary: {
    fontWeight: '600',
  },
});

export default CouponCard;
