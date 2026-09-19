import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredientLabel, splitIngredientList } from '../src/services/labelParser';
import { normalizeCatalogProduct, lookupBarcode, searchProducts, CatalogError } from '../src/services/products';

test('isolates ingredients from marketing, nutrition, allergens and storage', () => {
  const result = parseIngredientLabel('Wonderful bread\nHigh in fibre\nINGREDIENTS: Wheat flour, water, yeast, salt.\nContains: wheat.\nMay contain milk and sesame.\nNutrition per 100g\nEnergy 850kJ\nStorage: cool and dry');
  assert.deepEqual(result.ingredients, ['Wheat flour', 'water', 'yeast', 'salt']);
  assert.deepEqual(result.allergens, ['wheat']);
  assert.deepEqual(result.mayContain, ['milk', 'sesame']);
  assert.equal(result.status, 'review');
  assert.equal(result.requiresConfirmation, true);
});

test('keeps nested subingredients and embedded allergen declarations intact', () => {
  assert.deepEqual(splitIngredientList('Pasta (durum wheat semolina, egg), sauce [tomato, cheese (contains milk)], salt'), ['Pasta (durum wheat semolina, egg)', 'sauce [tomato, cheese (contains milk)]', 'salt']);
  const result = parseIngredientLabel('Ingredients: sauce (tomato, whey (contains milk)), rice. Storage: refrigerate');
  assert.deepEqual(result.ingredients, ['sauce (tomato, whey (contains milk))', 'rice']);
  assert.deepEqual(result.allergens, []);
});

test('does not promote arbitrary OCR words without an explicit header', () => {
  const result = parseIngredientLabel('Fresh wholesome goodness\nBread\nWheat, water, salt\nBest before tomorrow');
  assert.equal(result.status, 'needs-manual-selection');
  assert.deepEqual(result.ingredients, []);
  assert.equal(result.hasIngredientsHeader, false);
});

test('supports a standalone heading and manually selected ingredient field', () => {
  assert.deepEqual(parseIngredientLabel('Ingredients\nRice flour, water\nNutrition information: 4g').ingredients, ['Rice flour', 'water']);
  assert.deepEqual(parseIngredientLabel('rice flour, water, salt', { source: 'manual' }).ingredients, ['rice flour', 'water', 'salt']);
  assert.deepEqual(parseIngredientLabel('rice flour, water, salt', { source: 'catalog' }).ingredients, ['rice flour', 'water', 'salt']);
});

test('preserves gluten-free text and percentages without inventing ingredients', () => {
  const result = parseIngredientLabel('Ingredients: gluten-free oats (60%), water, contains 2% or less of: salt, yeast. Nutrition Facts: fat 5g');
  assert.deepEqual(result.ingredients, ['gluten-free oats (60%)', 'water', 'contains 2% or less of: salt', 'yeast']);
  assert.deepEqual(result.allergens, []);
});

test('never folds may-contain into confirmed ingredients', () => {
  const result = parseIngredientLabel('Ingredients: rice, salt. May contain traces of wheat, peanuts. Best before: see base');
  assert.deepEqual(result.ingredients, ['rice', 'salt']);
  assert.deepEqual(result.mayContain, ['wheat', 'peanuts']);
  assert.ok(result.warnings.some(warning => warning.includes('cross-contact')));
});

test('cuts a nutrition heading even when OCR misses a closing bracket', () => {
  const result = parseIngredientLabel('Ingredients: flour (wheat, calcium\nNutrition information\nSalt 1g', { ocrConfidence: 0.4 });
  assert.equal(result.ingredientText, 'flour (wheat, calcium');
  assert.ok(result.warnings.some(warning => warning.includes('parentheses')));
  assert.ok(result.warnings.some(warning => warning.includes('difficult to read')));
});

test('empty input and header-only scans do not produce ingredients', () => {
  for (const text of ['', '  \n ', 'Ingredients: Nutrition: 42']) {
    const result = parseIngredientLabel(text);
    assert.deepEqual(result.ingredients, []);
    assert.equal(result.status, 'empty');
  }
});

test('oversized pasted text cannot become a large ingredient list', () => {
  const result = parseIngredientLabel('Ingredients: ' + 'water, '.repeat(7000), { source: 'manual' });
  assert.equal(result.status, 'needs-manual-selection');
  assert.deepEqual(result.ingredients, []);
});

test('normalizes catalog fields while preserving missing-ingredient uncertainty', () => {
  const result = normalizeCatalogProduct({ code: '12345678', product_name: '<b>Bread</b>', allergens_tags: ['en:wheat'], traces_tags: ['en:milk'], labels_tags: ['en:gluten-free'] });
  assert.equal(result?.name, 'Bread');
  assert.equal(result?.ingredientsText, undefined);
  assert.deepEqual(result?.allergens, ['wheat']);
  assert.deepEqual(result?.traces, ['milk']);
  assert.deepEqual(result?.labels, ['gluten free']);
  assert.ok(result?.warnings.some(warning => warning.includes('no ingredient list')));
  assert.ok(result?.attribution.includes('Open Food Facts'));
  assert.equal(normalizeCatalogProduct({ code: '../../bad' }), null);
  assert.equal(normalizeCatalogProduct(null), null);
});

test('rejects invalid product input before any network request', async () => {
  await assert.rejects(() => lookupBarcode('bread'), (error: unknown) => error instanceof CatalogError && error.code === 'invalid-input');
  await assert.rejects(() => searchProducts('a'), (error: unknown) => error instanceof CatalogError && error.code === 'invalid-input');
});

test('catalog request handles not-found, rate limits, missing fields and cached results', async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = originalNow();
  let requests = 0;
  Date.now = () => now;
  try {
    globalThis.fetch = async () => { requests += 1; return new Response(JSON.stringify({ status: 0 }), { status: 200 }); };
    assert.equal(await lookupBarcode('00000001'), null);
    assert.equal(await lookupBarcode('00000001'), null);
    assert.equal(requests, 1, 'identical product lookup uses memory cache');
    now += 7000;
    globalThis.fetch = async () => new Response('', { status: 429 });
    await assert.rejects(() => lookupBarcode('00000002'), (error: unknown) => error instanceof CatalogError && error.code === 'rate-limited');
    now += 7000;
    globalThis.fetch = async () => new Response(JSON.stringify({ products: [{ code: '12345678', product_name: 'Incomplete record' }, { nonsense: true }] }), { status: 200 });
    const products = await searchProducts('example product');
    assert.equal(products.length, 1);
    assert.equal(products[0].ingredientsText, undefined);
    now += 7000;
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(() => searchProducts('offline product'), (error: unknown) => error instanceof CatalogError && error.code === 'network');
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
