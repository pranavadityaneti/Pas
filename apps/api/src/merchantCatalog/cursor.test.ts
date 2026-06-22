import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { encodeCursor, decodeCursor } from './cursor';

test('encode → decode round-trip', () => {
  const c = encodeCursor({ createdAt: new Date('2026-06-17T10:00:00Z'), id: 'a4-xyz' });
  const d = decodeCursor(c);
  assert.equal(d.id, 'a4-xyz');
  assert.equal(d.createdAt?.toISOString(), '2026-06-17T10:00:00.000Z');
});

test('decode of null/empty/garbage returns nulls', () => {
  assert.deepEqual(decodeCursor(undefined), { createdAt: null, id: null });
  assert.deepEqual(decodeCursor(''), { createdAt: null, id: null });
  assert.deepEqual(decodeCursor('not-base64!!!'), { createdAt: null, id: null });
});

test('encode of null returns empty string', () => {
  assert.equal(encodeCursor(null), '');
});
