// @lock — Do NOT overwrite.
/**
 * Data Transformer Utility
 * Handles mapping between Supabase Database rows and Consumer App UI contracts.
 * This is a read-only refactor to ensure compatibility with UUIDs and missing fields.
 */

import { getStoreImageUrl, getStoreImageUrls } from './storageUrl';

export interface TransformedStore {
  id: string;
  name: string;
  address: string;
  image: string;
  storePhotos: string[];
  rating: string | null;
  distance: string;
  category: string;
  isDining: boolean;
  isVeg?: boolean;
  prepTime?: string;
  products: any[];
  cuisines: string[];
  cuisine: string;
  type: string;
  merchantId?: string;
  isOpen: boolean;
  operating_hours?: any;
  serviceTableBooking?: boolean;
  servicePickup: boolean;
  serviceDinein: boolean;
}

/**
 * Checks if a store is currently open based on operating hours and active status.
 *
 * operating_hours JSONB format (as saved by merchant app):
 * {
 *   days: [0, 1, 2, 3, 4, 5],  // numeric indices: 0=Mon, 1=Tue, ..., 6=Sun
 *   open: "09:00",              // HH:mm
 *   close: "21:00",             // HH:mm
 *   hasLunchBreak: true,
 *   lunchStart: "13:00",        // HH:mm (only if hasLunchBreak)
 *   lunchEnd: "14:00"           // HH:mm (only if hasLunchBreak)
 * }
 */
export const checkIsOpen = (isActive: boolean, operatingHours: any, prepTimeMinutes: number): boolean => {
  if (!isActive) return false;
  if (!operatingHours || !operatingHours.days || !operatingHours.open || !operatingHours.close) {
    if (__DEV__) console.warn('[checkIsOpen] No operating hours configured for store, defaulting to open');
    return true;
  }

  const now = new Date();

  // Convert JS getDay() (0=Sun, 1=Mon, ..., 6=Sat) to store format (0=Mon, ..., 6=Sun)
  const jsDay = now.getDay();
  const todayIndex = (jsDay + 6) % 7; // Sun(0)→6, Mon(1)→0, Tue(2)→1, etc.

  if (!operatingHours.days.includes(todayIndex)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const openMinutes = parseTime(operatingHours.open);
  const closeMinutes = parseTime(operatingHours.close);

  // We stop taking orders prepTimeMinutes before actual close time
  if (currentMinutes < openMinutes || currentMinutes > (closeMinutes - prepTimeMinutes)) {
    return false;
  }

  // Check lunch break
  if (operatingHours.hasLunchBreak && operatingHours.lunchStart && operatingHours.lunchEnd) {
    const lunchStartMinutes = parseTime(operatingHours.lunchStart);
    const lunchEndMinutes = parseTime(operatingHours.lunchEnd);
    if (currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes) {
      return false;
    }
  }

  return true;
};

/**
 * Checks if a vertical is considered "Dining" (Restaurant/Cafe/Bakery)
 * @param verticalName The display name of the vertical
 */
export const getIsDining = (verticalName: string): boolean => {
  const diningCategories = ['Restaurants & Cafes', 'Bakeries & Desserts'];
  return diningCategories.includes(verticalName);
};

/**
 * Transforms a raw Supabase 'Store' row into a UI-compatible 'Store' object.
 * @param row Raw Supabase row with camelCase or snake_case fields
 */
export const transformStoreData = (row: any): TransformedStore => {
  const verticalName = row.merchant?.vertical?.name || row.vertical?.name || 'Uncategorized';
  const isDining = getIsDining(verticalName);

  // Branch-level photos take precedence over merchant-level
  const branchPhotos = row.branch_photos?.length > 0 ? row.branch_photos : null;
  const resolvedPhotos = branchPhotos
    ? getStoreImageUrls(branchPhotos)
    : getStoreImageUrls(row.merchant?.store_photos);

  // Branch-level dining fields with merchant-level fallback
  const cuisines = (row.cuisines?.length > 0) ? row.cuisines : (row.merchant?.cuisines || []);
  const isVeg = row.is_veg ?? row.merchant?.is_veg ?? false;
  const restaurantType = row.restaurant_type || row.merchant?.restaurant_type;

  return {
    id: String(row.id),
    name: row.branch_name || row.name || 'Unknown Store',
    address: row.address || 'Address not available',
    image: resolvedPhotos[0] || getStoreImageUrl(row.image),
    storePhotos: resolvedPhotos,
    rating: row.merchant?.rating ? String(row.merchant.rating) : null,
    distance: row.distance ? String(row.distance) : 'Near you',
    category: verticalName,
    isDining: isDining,
    isVeg: isVeg,
    prepTime: row.prepTime || '30 mins',
    products: row.products || [],
    cuisines: cuisines,
    cuisine: (cuisines.length > 0) ? cuisines.join(', ') : (isDining ? 'Multi-Cuisine' : verticalName),
    type: restaurantType || (isDining ? 'Casual Dining' : 'Retail Store'),
    merchantId: row.merchant_id || row.merchantId || undefined,
    isOpen: checkIsOpen(row.is_active ?? true, row.operating_hours, row.prep_time_minutes || 15),
    operating_hours: row.operating_hours,
    serviceTableBooking: row.service_table_booking ?? false,
    servicePickup: row.service_pickup ?? true,
    serviceDinein: row.service_dinein ?? true,
  };
};
