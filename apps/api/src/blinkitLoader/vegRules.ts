// Pure veg derivation for the Blinkit loader. Tri-state: true / false / null.
// Decision (spec §6): default-VEG for unsignalled food; non-food → null (no dot).

export const NON_VEG_SUBCATEGORIES = new Set<string>([
  'Chicken, Meat & Fish',
  'Frozen Non-Veg',
  'Fish & Seafood',
  'Sausages, Salami & Ham',
  'Eggs',
]);

// Word-boundary, case-insensitive. `eggs?` matches egg/eggs but NOT eggplant/eggless
// (no word boundary after "egg" in those). Tune via the dry-run distribution.
const NON_VEG_PATTERN =
  /\b(chicken|mutton|fish|prawns?|shrimps?|seafood|crabs?|meat|eggs?|anda|pork|bacon|hams?|sausages?|salami|keema|fillets?|lamb|tuna|squid|octopus)\b/i;

export function hasNonVegSignal(name: string, subcategory: string | null): boolean {
  if (subcategory && NON_VEG_SUBCATEGORIES.has(subcategory)) return true;
  return NON_VEG_PATTERN.test(`${name} ${subcategory ?? ''}`);
}

export function deriveVeg(args: { isFood: boolean; name: string; subcategory: string | null }): boolean | null {
  if (!args.isFood) return null;                                   // non-food → unknown, no dot
  if (hasNonVegSignal(args.name, args.subcategory)) return false;  // explicit non-veg signal
  return true;                                                     // default-veg for unsignalled food
}
