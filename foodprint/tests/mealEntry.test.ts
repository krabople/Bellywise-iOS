import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFood } from '../src/domain/foods';
import { ingredientsForMealEntry } from '../src/domain/mealEntry';

test('recognised meal names start with every suggested ingredient confirmed', () => {
  for (const name of ['spaghetti bolognese', 'spag bol', 'spagetti bolognese', 'macaroni cheese', 'bacon sandwich']) {
    const resolution = resolveFood(name);
    assert.equal(resolution.matched, true, name);
    const ingredients = ingredientsForMealEntry(resolution);
    assert.ok(ingredients.length > 0, name);
    assert.ok(ingredients.every(item => item.confidence === 'confirmed'), name);
    // The catalogue still describes typical recipes rather than verified labels.
    assert.ok(resolution.ingredients.every(item => item.confidence === 'inferred'), name);
  }
});

test('meal-entry defaults preserve free-from selections and component exclusions', () => {
  const ingredients = ingredientsForMealEntry(resolveFood('spaghetti bolognese', 'gluten-free'));
  assert.ok(ingredients.length > 0);
  assert.ok(ingredients.every(item => item.confidence === 'confirmed'));
  assert.ok(!ingredients.some(item => ['wheat', 'barley', 'rye', 'gluten'].includes(item.id)));
  assert.ok(ingredients.every(item => item.excludedComponents?.includes('gluten')));
});

test('unrecognised or partly unknown meals do not become confirmed by default', () => {
  for (const name of ['Grandma special', 'rice and mystery stew']) {
    const resolution = resolveFood(name);
    assert.equal(resolution.matched, false);
    const ingredients = ingredientsForMealEntry(resolution);
    assert.deepEqual(ingredients, resolution.ingredients);
    assert.equal(ingredients.find(item => item.id.startsWith('custom-'))?.confidence, 'inferred');
  }
});

test('unconfirming an entry does not alter the recipe or the next meal defaults', () => {
  const resolution = resolveFood('spaghetti bolognese');
  const first = ingredientsForMealEntry(resolution);
  first[0].confidence = 'inferred';
  assert.equal(ingredientsForMealEntry(resolution)[0].confidence, 'confirmed');
  assert.equal(resolution.ingredients[0].confidence, 'inferred');
});
