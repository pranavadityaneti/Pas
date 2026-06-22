// Phase 4 sub-2 · lazy image re-host (spec §8, decision D3).
// On first listing of a product, copy its cdn.grofers.com image into our own Supabase
// 'products' bucket and swap Product.image. Dependencies are injected so the core logic
// is unit-testable without network/Supabase. NEVER throws — on failure it logs to Sentry
// and returns 'failed' so the listing still saves (the next listing retries).
export type RehostOutcome = 'ok' | 'skipped' | 'failed';

export type RehostDeps = {
  findProduct: (id: string) => Promise<{ image: string | null } | null>;
  download: (url: string) => Promise<{ data: Buffer; contentType: string }>;
  upload: (path: string, body: Buffer, contentType: string) => Promise<{ publicUrl: string }>;
  updateImage: (productId: string, url: string) => Promise<void>;
  captureException: (e: unknown, ctx?: Record<string, any>) => void;
};

export function makeRehoster(deps: RehostDeps) {
  async function rehostOne(productId: string): Promise<RehostOutcome> {
    try {
      const p = await deps.findProduct(productId);
      if (!p?.image) return 'skipped';
      if (!p.image.includes('cdn.grofers.com')) return 'skipped';
      const dl = await deps.download(p.image);
      const ext = inferExt(dl.contentType, p.image);
      const up = await deps.upload(`catalog/${productId}.${ext}`, dl.data, dl.contentType);
      await deps.updateImage(productId, up.publicUrl);
      return 'ok';
    } catch (e) {
      deps.captureException(e, { area: 'imageRehost', productId });
      return 'failed';
    }
  }

  async function rehostMany(productIds: string[], concurrency = 4) {
    const out = { ok: 0, skipped: 0, failed: 0 };
    let i = 0;
    async function worker() {
      while (i < productIds.length) {
        const idx = i++;
        const r = await rehostOne(productIds[idx]);
        out[r]++;
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, productIds.length || 1) }, worker));
    return out;
  }

  return { rehostOne, rehostMany };
}

export function inferExt(contentType: string, url: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (/\.png(\?|$)/i.test(url)) return 'png';
  if (/\.webp(\?|$)/i.test(url)) return 'webp';
  return 'jpg';
}
