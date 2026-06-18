import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validatePayload, validateMrpCeiling, validateFssaiGate } from './validate';

test('validatePayload: empty items rejected', () => {
  const r = validatePayload({ items: [] });
  assert.equal(r.ok, false);
  assert.equal((r as any).code, 'EMPTY_ITEMS');
});

test('validatePayload: > 200 items rejected', () => {
  const r = validatePayload({ items: new Array(201).fill({ productId: 'p', price: 10, stock: 1 }) });
  assert.equal(r.ok, false);
  assert.equal((r as any).code, 'TOO_MANY_ITEMS');
});

test('validatePayload: price <= 0 rejected', () => {
  const r = validatePayload({ items: [{ productId: 'p', price: 0, stock: 1 }] });
  assert.equal(r.ok, false);
  assert.equal((r as any).code, 'INVALID_PRICE');
});

test('validatePayload: negative/non-integer stock rejected', () => {
  assert.equal((validatePayload({ items: [{ productId: 'p', price: 10, stock: -1 }] }) as any).code, 'INVALID_STOCK');
  assert.equal((validatePayload({ items: [{ productId: 'p', price: 10, stock: 1.5 }] }) as any).code, 'INVALID_STOCK');
});

test('validatePayload: clean payload passes', () => {
  assert.equal(validatePayload({ items: [{ productId: 'p', price: 10, stock: 1 }] }).ok, true);
});

test('validateMrpCeiling: price > mrp reports offenders', () => {
  const items = [{ productId: 'a', price: 50, stock: 1 }, { productId: 'b', price: 200, stock: 1 }];
  const products = new Map([['a', { mrp: 100 }], ['b', { mrp: 100 }]]);
  const r = validateMrpCeiling(items, products);
  assert.equal(r.ok, false);
  assert.deepEqual((r as any).offenders, [{ productId: 'b', price: 200, mrp: 100 }]);
});

test('validateMrpCeiling: price == mrp passes', () => {
  const r = validateMrpCeiling([{ productId: 'a', price: 100, stock: 1 }], new Map([['a', { mrp: 100 }]]));
  assert.equal(r.ok, true);
});

test('validateMrpCeiling: missing product reported', () => {
  const r = validateMrpCeiling([{ productId: 'missing', price: 10, stock: 1 }], new Map());
  assert.equal(r.ok, false);
  assert.equal((r as any).code, 'PRODUCT_NOT_FOUND');
});

test('validateFssaiGate: food + no FSSAI → blocked', () => {
  const r = validateFssaiGate([{ productId: 'a' }], new Map([['a', { requiresFssai: true }]]), { fssaiNumber: null });
  assert.equal(r.ok, false);
  assert.equal((r as any).code, 'FSSAI_REQUIRED');
});

test('validateFssaiGate: food + FSSAI present → ok', () => {
  const r = validateFssaiGate([{ productId: 'a' }], new Map([['a', { requiresFssai: true }]]), { fssaiNumber: 'FSSAI-123' });
  assert.equal(r.ok, true);
});

test('validateFssaiGate: non-food + no FSSAI → ok', () => {
  const r = validateFssaiGate([{ productId: 'a' }], new Map([['a', { requiresFssai: false }]]), { fssaiNumber: null });
  assert.equal(r.ok, true);
});
