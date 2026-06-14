/**
 * Agreement registry + vertical→agreement routing — Phase 0.4 (2026-06-14).
 *
 * Single place that (a) returns the fixed legal body for an agreement type and
 * (b) routes a merchant's chosen vertical (Step 3 category) to the right
 * agreement. Routing decisions locked 2026-06-14 (see forlater.md "Merchant
 * e-Sign V1" items A + B):
 *   - Grocery & Kirana             → grocery (standard body, 2%)
 *   - Restaurants & Cafes          → restaurant
 *   - Bakeries & Desserts          → restaurant (food + dining; fee/commission
 *                                     reconciliation deferred)
 *   - Meat & Seafood + all other   → otherStores (standard body, 5%)
 */

import type { AgreementBody, AgreementType } from './types';
import { standardBody } from './standardBody';
import { restaurantBody } from './restaurantBody';

export type { AgreementBody, AgreementType, Clause, Section, MerchantAgreementData } from './types';

/** Version label stamped onto the document + audit record. */
export const AGREEMENT_VERSION = 'v1.0';

/** Human label for the agreement variant — used in the header subtitle + audit footer. */
export const AGREEMENT_VARIANT_LABEL: Record<AgreementType, string> = {
  grocery: 'Grocery',
  otherStores: 'Retail',
  restaurant: 'Restaurant',
};

/** The fixed legal body for an agreement type (commission baked per the source PDFs). */
export function getAgreementBody(type: AgreementType): AgreementBody {
  switch (type) {
    case 'grocery':
      return standardBody('two percent (2%)');
    case 'otherStores':
      return standardBody('five percent (5%)');
    case 'restaurant':
      return restaurantBody;
  }
}

/**
 * Explicit vertical-name → agreement map. Keys are the canonical vertical names
 * as seeded in the API (apps/api/src/index.ts verticals list). Anything not
 * listed falls back to `otherStores` (the safest generic retail template).
 */
const VERTICAL_AGREEMENT_MAP: Record<string, AgreementType> = {
  'grocery & kirana': 'grocery',
  'restaurants & cafes': 'restaurant',
  'bakeries & desserts': 'restaurant',
  'meat & seafood': 'otherStores',
  'pharmacy & wellness': 'otherStores',
  'electronics & accessories': 'otherStores',
  'fashion & apparel': 'otherStores',
  'home & lifestyle': 'otherStores',
  'beauty & personal care': 'otherStores',
  'pet care & supplies': 'otherStores',
  'stationery, gifting & toys': 'otherStores',
  'electricals, paints & automotive': 'otherStores',
  'hardware & plumbing': 'otherStores',
  'pooja & festive needs': 'otherStores',
  'sports & fitness': 'otherStores',
};

/**
 * Routes a merchant's chosen vertical to one of the three agreements.
 * Normalizes case/whitespace and "and"→"&". Unknown verticals → otherStores.
 */
export function verticalToAgreement(verticalName: string | null | undefined): AgreementType {
  const key = (verticalName ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+and\s+/g, ' & ')
    .replace(/\s+/g, ' ');
  return VERTICAL_AGREEMENT_MAP[key] ?? 'otherStores';
}
