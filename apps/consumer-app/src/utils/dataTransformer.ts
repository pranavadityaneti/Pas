// @lock — Do NOT overwrite.
/**
 * Data Transformer Utility
 * Handles mapping between Supabase Database rows and Consumer App UI contracts.
 * This is a read-only refactor to ensure compatibility with UUIDs and missing fields.
 */

export interface TransformedStore {
  id: string;
  name: string;
  address: string;
  image: string;
  rating: string | null;
  distance: string;
  category: string;
  isDining: boolean;
  isVeg?: boolean;
  prepTime?: string;
  products: any[];
  cuisine: string;
  type: string;
  merchantId?: string;
  isOpen: boolean;
  operating_hours?: any;
}

/**
 * Checks if a store is currently open based on operating hours and active status.
 */
export const checkIsOpen = (isActive: boolean, operatingHours: any, prepTimeMinutes: number): boolean => {
  if (!isActive) return false;
  if (!operatingHours || !operatingHours.days || !operatingHours.open_time || !operatingHours.close_time) return true; // Default to open if no hours specified but is active

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = dayNames[now.getDay()];

  if (!operatingHours.days.includes(currentDay)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const openMinutes = parseTime(operatingHours.open_time);
  const closeMinutes = parseTime(operatingHours.close_time);

  // We stop taking orders prepTimeMinutes before actual close time
  if (currentMinutes < openMinutes || currentMinutes > (closeMinutes - prepTimeMinutes)) {
    return false;
  }

  if (operatingHours.has_lunch_break && operatingHours.lunch_start && operatingHours.lunch_end) {
    const lunchStartMinutes = parseTime(operatingHours.lunch_start);
    const lunchEndMinutes = parseTime(operatingHours.lunch_end);
    if (currentMinutes >= lunchStartMinutes && currentMinutes <= lunchEndMinutes) {
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
  
  return {
    id: String(row.id),
    name: row.branch_name || row.name || 'Unknown Store',
    address: row.address || 'Address not available',
    image: row.image || row.merchant?.store_photos?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491?w=400',
    // Injected defaults for fields missing in DB
    rating: row.rating ? String(row.rating) : null,
    distance: row.distance ? String(row.distance) : 'Near you',
    // Map strictly to the joined vertical name for frontend category parity
    category: verticalName,
    isDining: isDining,
    isVeg: row.is_veg ?? row.isVeg ?? false,
    prepTime: row.prepTime || '30 mins',
    products: row.products || [],
    // Legacy support for cuisine/type filtering
    cuisine: row.cuisine || (isDining ? 'North Indian' : verticalName),
    type: row.type || (isDining ? 'Casual Dining' : 'Retail Store'),
    merchantId: row.merchant_id || row.merchantId || undefined,
    isOpen: checkIsOpen(row.is_active ?? true, row.operating_hours, row.prep_time_minutes || 15),
    operating_hours: row.operating_hours,
  };
};
