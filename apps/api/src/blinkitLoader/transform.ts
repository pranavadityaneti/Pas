import { BlinkitRow, CategoryResolution, ProductUpsert } from './types';
import { deriveVeg } from './vegRules';

export function parseQuantity(raw: string | null): { uom: string | null; unitValue: number | null; unitType: string | null } {
  if (!raw || !raw.trim()) return { uom: null, unitValue: null, unitType: null };
  const uom = raw.trim();
  const m = uom.match(/^([\d.]+)\s*(kg|g|gm|gms|ml|l|ltr|litre|pcs|pc|piece|pieces|pack)\b/i);
  if (!m) return { uom, unitValue: null, unitType: null };
  const unitValue = parseFloat(m[1]);
  return { uom, unitValue: Number.isFinite(unitValue) ? unitValue : null, unitType: m[2].toLowerCase() };
}

export function clampSuggestedPrice(price: number, mrp: number): number {
  if (!Number.isFinite(price) || price <= 0) return mrp;  // junk → fall back to the ceiling
  return Math.min(price, mrp);                            // never above mrp
}

export function firstImage(imagesRaw: string | null): string | null {
  const arr = safeJson<unknown>(imagesRaw);
  if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') return arr[0] as string;
  if (typeof imagesRaw === 'string' && imagesRaw.startsWith('http')) return imagesRaw.trim();
  return null;
}

export function safeJson<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
}

export function mapRowToProduct(row: BlinkitRow, cat: CategoryResolution): ProductUpsert {
  const mrp = parseFloat(row.mrp);
  const suggestedPrice = clampSuggestedPrice(parseFloat(row.price), mrp);
  const { uom, unitValue, unitType } = parseQuantity(row.quantity);
  const dump = safeJson<Record<string, unknown>>(row.data_dump) ?? {};
  return {
    name: (row.name || '').trim(),
    mrp,
    brand: row.brand?.trim() || null,
    image: firstImage(row.images),
    uom, unitType, unitValue,
    subcategory: row.subcategory?.trim() || null,
    source: 'blinkit',
    sourceProductId: row.product_id,
    vertical_id: cat.vertical_id,
    category_id: cat.category_id,
    isVeg: deriveVeg({ isFood: cat.requiresFssai, name: row.name || '', subcategory: row.subcategory?.trim() || null }),
    productUrl: row.deeplink?.trim() || null,
    avgRating: numOrNull(dump.rating),
    numberOfRatings: intOrNull((dump as any).ratingCount ?? (dump as any).rating_count),
    extraData: {
      suggestedPrice,
      siblings: (dump as any).siblings ?? null,
      parentIndex: (dump as any).parentIndex ?? null,
      childIndex: (dump as any).childIndex ?? null,
    },
  };
}
