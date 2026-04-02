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
}

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
  const verticalName = row.vertical?.name || 'Uncategorized';
  const isDining = getIsDining(verticalName);
  
  return {
    id: String(row.id),
    name: row.name || 'Unknown Store',
    address: row.address || 'Address not available',
    image: row.image || 'https://images.unsplash.com/photo-1542838132-92c53300491?w=400',
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
  };
};
