import test from 'node:test';
import assert from 'node:assert';
import { deriveVeg } from './vegRules';

test('non-food → NULL (no dot)', () => {
  assert.strictEqual(deriveVeg({ isFood: false, name: 'USB Cable', subcategory: 'Mobile Accessories' }), null);
});
test('food + chicken → false (non-veg)', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Chicken Curry Cut', subcategory: 'Chicken, Meat & Fish' }), false);
});
test('food + Eggs subcategory → false', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Farm Eggs 6 pcs', subcategory: 'Eggs' }), false);
});
test('food + "eggplant" → true (egg keyword must NOT match eggplant)', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Eggplant / Brinjal', subcategory: 'Fruits & Vegetables' }), true);
});
test('food + "eggless cake" → true', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Eggless Chocolate Cake', subcategory: 'Bakery' }), true);
});
test('food + plain dal → true (default veg)', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Tata Sampann Toor Dal', subcategory: 'Atta, Rice & Dal' }), true);
});
test('food + fish in name → false', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Fish Finger Frozen', subcategory: 'Frozen Veg' }), false);
});
test('food + "Plant Based Meat" → true (vegan override beats meat keyword)', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Plant Based Meat Keema', subcategory: 'Plant Based Meat' }), true);
});
test('food + "Vegan Chicken Nuggets" → true (vegan override)', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Vegan Chicken Nuggets', subcategory: 'Frozen Veg' }), true);
});
test('food + real subcategory "Exotic Meat" → false', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Boneless Cut', subcategory: 'Exotic Meat' }), false);
});
test('food + real subcategory "Mutton" → false', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Curry Cut 500g', subcategory: 'Mutton' }), false);
});
test('food + "Frozen Non-Veg" subcategory (no keyword in name) → false (backstop)', () => {
  assert.strictEqual(deriveVeg({ isFood: true, name: 'Crispy Snack Combo', subcategory: 'Frozen Non-Veg' }), false);
});
