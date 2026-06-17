// Pure veg derivation for the Blinkit loader. Tri-state: true / false / null.
// Decision (spec §6): default-VEG for unsignalled food; non-food → null (no dot).

// Real Blinkit non-veg subcategory names (verified against the dataset 2026-06-17).
// A backstop for non-veg items whose NAME lacks a keyword (e.g. "Frozen Non-Veg").
export const NON_VEG_SUBCATEGORIES = new Set<string>([
  'Chicken',
  'Eggs',
  'Fish & Seafood',
  'Sausage, Salami & Ham',
  'Exotic Meat',
  'Mutton',
  'Frozen Non-Veg',
]);

// Word-boundary, case-insensitive. `eggs?` matches egg/eggs but NOT eggplant/eggless
// (no word boundary after "egg" in those). Tuned via the dry-run distribution.
const NON_VEG_PATTERN =
  /\b(chicken|mutton|fish|prawns?|shrimps?|seafood|crabs?|meat|eggs?|anda|pork|bacon|hams?|sausages?|salami|keema|fillets?|lamb|tuna|squid|octopus)\b/i;

// Explicit veg signal — overrides the meat/keyword check so "Plant Based Meat",
// "Vegan Chicken Nuggets", etc. are VEG, not non-veg. NOT bare "veg" (matches "non-veg").
const VEG_OVERRIDE = /\b(plant[\s-]?based|vegan)\b/i;

export function hasNonVegSignal(name: string, subcategory: string | null): boolean {
  const hay = `${name} ${subcategory ?? ''}`;
  if (VEG_OVERRIDE.test(hay)) return false;                         // plant-based/vegan → veg
  if (subcategory && NON_VEG_SUBCATEGORIES.has(subcategory)) return true;
  return NON_VEG_PATTERN.test(hay);
}

export function deriveVeg(args: { isFood: boolean; name: string; subcategory: string | null }): boolean | null {
  if (!args.isFood) return null;                                   // non-food → unknown, no dot
  if (hasNonVegSignal(args.name, args.subcategory)) return false;  // explicit non-veg signal
  return true;                                                     // default-veg for unsignalled food
}
