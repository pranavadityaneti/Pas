import test from 'node:test';
import assert from 'node:assert';
import { parseQuantity, clampSuggestedPrice } from './transform';

test('parseQuantity "500 g"', () => {
  assert.deepStrictEqual(parseQuantity('500 g'), { uom: '500 g', unitValue: 500, unitType: 'g' });
});
test('parseQuantity "1.5 kg"', () => {
  assert.deepStrictEqual(parseQuantity('1.5 kg'), { uom: '1.5 kg', unitValue: 1.5, unitType: 'kg' });
});
test('parseQuantity unparseable keeps raw uom', () => {
  assert.deepStrictEqual(parseQuantity('Combo Pack'), { uom: 'Combo Pack', unitValue: null, unitType: null });
});
test('parseQuantity null → all null', () => {
  assert.deepStrictEqual(parseQuantity(null), { uom: null, unitValue: null, unitType: null });
});
test('clampSuggestedPrice keeps discounted price', () => {
  assert.strictEqual(clampSuggestedPrice(349, 649), 349);
});
test('clampSuggestedPrice clamps price>mrp to mrp', () => {
  assert.strictEqual(clampSuggestedPrice(700, 500), 500);
});
test('clampSuggestedPrice junk/zero falls back to mrp', () => {
  assert.strictEqual(clampSuggestedPrice(0, 500), 500);
  assert.strictEqual(clampSuggestedPrice(NaN, 500), 500);
});
