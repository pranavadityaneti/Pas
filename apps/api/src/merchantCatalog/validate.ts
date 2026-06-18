// Phase 4 sub-2 · server-side listing guards (spec §7). Pure functions, no DB —
// the route fetches Products + merchant, then calls these. Mirrors the client-side
// validation so the API is the source of truth (the DB trigger is the final backstop).
export type Item = { productId: string; price: number; stock: number };
export type ValidationResult = { ok: true } | { ok: false; code: string; offenders?: any[] };

export function validatePayload(body: any): ValidationResult {
  const items: any[] = body?.items;
  if (!Array.isArray(items) || items.length === 0) return { ok: false, code: 'EMPTY_ITEMS' };
  if (items.length > 200) return { ok: false, code: 'TOO_MANY_ITEMS' };
  for (const it of items) {
    if (!it?.productId || typeof it.productId !== 'string') return { ok: false, code: 'INVALID_PRODUCT_ID' };
    if (typeof it.price !== 'number' || !Number.isFinite(it.price) || it.price <= 0) {
      return { ok: false, code: 'INVALID_PRICE' };
    }
    if (!Number.isInteger(it.stock) || it.stock < 0) return { ok: false, code: 'INVALID_STOCK' };
  }
  return { ok: true };
}

export function validateMrpCeiling(
  items: Item[],
  products: Map<string, { mrp: number }>,
): ValidationResult {
  const offenders: any[] = [];
  for (const it of items) {
    const p = products.get(it.productId);
    if (!p) return { ok: false, code: 'PRODUCT_NOT_FOUND', offenders: [{ productId: it.productId }] };
    if (it.price > p.mrp) offenders.push({ productId: it.productId, price: it.price, mrp: p.mrp });
  }
  return offenders.length ? { ok: false, code: 'MRP_CEILING_VIOLATED', offenders } : { ok: true };
}

export function validateFssaiGate(
  items: { productId: string }[],
  products: Map<string, { requiresFssai: boolean }>,
  merchant: { fssaiNumber: string | null },
): ValidationResult {
  if (merchant.fssaiNumber) return { ok: true };
  const food = items.filter((it) => products.get(it.productId)?.requiresFssai);
  if (food.length === 0) return { ok: true };
  return { ok: false, code: 'FSSAI_REQUIRED', offenders: food.map((it) => it.productId) };
}
