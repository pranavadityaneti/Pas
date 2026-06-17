import test from 'node:test';
import assert from 'node:assert';
import { parseQuantity, clampSuggestedPrice, mapRowToProduct } from './transform';
import { BlinkitRow, CategoryResolution } from './types';

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

const ROW: BlinkitRow = {
  product_id: 'blk_123', name: ' Tata Toor Dal ', mrp: '244.00', price: '210.00', brand: 'Tata Sampann',
  images: '["https://cdn.grofers.com/a.jpg","https://cdn.grofers.com/b.jpg"]',
  deeplink: 'https://blinkit.com/prn/x/prid/123', quantity: '1 kg', category: 'Atta, Rice & Dal',
  subcategory: 'Toor & Arhar Dal',
  data_dump: '{"siblings":["blk_123","blk_999"],"parentIndex":0,"childIndex":1,"rating":4.3,"ratingCount":58}',
};
const CAT: CategoryResolution = { vertical_id: 'v-1', category_id: 'c-1', requiresFssai: true };

test('mapRowToProduct maps + derives correctly', () => {
  const p = mapRowToProduct(ROW, CAT);
  assert.strictEqual(p.name, 'Tata Toor Dal');
  assert.strictEqual(p.mrp, 244);
  assert.strictEqual(p.sourceProductId, 'blk_123');
  assert.strictEqual(p.source, 'blinkit');
  assert.strictEqual(p.vertical_id, 'v-1');
  assert.strictEqual(p.category_id, 'c-1');
  assert.strictEqual(p.image, 'https://cdn.grofers.com/a.jpg');     // first image only
  assert.strictEqual(p.uom, '1 kg');
  assert.strictEqual(p.unitValue, 1);
  assert.strictEqual(p.unitType, 'kg');
  assert.strictEqual(p.isVeg, true);                                // food + no non-veg signal
  assert.strictEqual(p.productUrl, 'https://blinkit.com/prn/x/prid/123');
  assert.strictEqual(p.avgRating, 4.3);
  assert.strictEqual(p.numberOfRatings, 58);
  assert.strictEqual((p.extraData as any).suggestedPrice, 210);     // price ≤ mrp
  assert.deepStrictEqual((p.extraData as any).siblings, ['blk_123', 'blk_999']);
  assert.strictEqual((p.extraData as any).childIndex, 1);
});
