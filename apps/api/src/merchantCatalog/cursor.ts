// Phase 4 sub-2 · keyset pagination cursor (spec §4, decision D6).
// Encodes the (createdAt, id) of the last row in a page so the next page can resume
// deterministically — stable under ingest, unlike OFFSET, and scales to 140k rows.
export type Cursor = { createdAt: Date | null; id: string | null };

export function encodeCursor(c: { createdAt: Date; id: string } | null): string {
  if (!c) return '';
  const payload = JSON.stringify({ t: c.createdAt.toISOString(), i: c.id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined | null): Cursor {
  if (!raw) return { createdAt: null, id: null };
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const o = JSON.parse(json);
    if (!o?.t || !o?.i) return { createdAt: null, id: null };
    return { createdAt: new Date(o.t), id: String(o.i) };
  } catch {
    return { createdAt: null, id: null };
  }
}
