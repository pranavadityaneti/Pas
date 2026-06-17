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
