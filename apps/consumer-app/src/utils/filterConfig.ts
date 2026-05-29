// Category-aware filter visibility config
// Determines which filter sections appear based on vertical/category name

const FOOD_CATEGORIES = new Set([
    'Grocery & Kirana',
    'Restaurants & Cafes',
    'Bakeries & Desserts',
    'Meat & Seafood',
]);

// Only Restaurants & Cafes has NO brands — all other categories show brands
const NO_BRAND_CATEGORIES = new Set([
    'Restaurants & Cafes',
]);

export type SortOption = 'relevance' | 'rating' | 'distance' | 'most_items' | 'prep_time';

export interface FilterVisibility {
    showDietary: boolean;
    showBrands: boolean;
    showRatings: boolean;
    showPriceRange: boolean;
    showSortOptions: SortOption[];
}

export function getFilterConfig(categoryName: string): FilterVisibility {
    return {
        showDietary: FOOD_CATEGORIES.has(categoryName),
        showBrands: !NO_BRAND_CATEGORIES.has(categoryName),
        showRatings: false, // globally disabled until platform has rating data
        showPriceRange: true,
        showSortOptions: ['relevance', 'distance', 'prep_time', 'most_items'],
    };
}
