import test from 'node:test';
import assert from 'node:assert/strict';
import { addedFoodRecordCount, resolveFood, suggestFoodNames } from '../src/domain/foods';
import { resolveIngredientEntry } from '../src/domain/ingredientEntry';
import { brandCatalogSize, findBrand, suggestBrands } from '../src/domain/brands';
import { localProductCount, searchLocalProducts } from '../src/services/localProducts';
import { CatalogError, lookupBarcode, refreshSelectedProduct, searchProducts, manufacturerIngredientText } from '../src/services/products';
import { parseIngredientLabel } from '../src/services/labelParser';
import guide from '../src/data/extendedFoodGuide.json';

test('thousands of distinct source foods and real brand/product records are available', () => {
  assert.equal(addedFoodRecordCount, 12713);
  assert.equal(new Set(guide.records.map(row => row.id)).size, addedFoodRecordCount);
  assert.ok(guide.records.every(row => row.sourceUrl.startsWith('https://fdc.nal.usda.gov/food-details/')));
  assert.ok(brandCatalogSize >= 37000);
  assert.equal(localProductCount, 60486);
});

test('requested foods work in both the meal field and ingredient picker, with estimates retained', () => {
  for (const name of ['toast', 'gravy', 'vegetarian sausages', 'vegan sausages', 'buffalo wings', 'chilli sauce']) {
    assert.equal(resolveFood(name).matched, true, name);
    const result = resolveIngredientEntry(name);
    assert.equal(result.recognised, true, name);
    assert.ok(result.ingredients.length, name);
    assert.ok(result.ingredients.every(row => row.confidence === 'inferred'), name);
  }
  assert.ok(resolveIngredientEntry('toast').ingredients.some(row => row.id === 'wheat'));
  assert.ok(!resolveIngredientEntry('gluten-free toast').ingredients.some(row => ['wheat', 'barley', 'rye'].includes(row.id)));
  for (const name of ['vegetarian sausages', 'vegan sausages']) assert.ok(!resolveFood(name).ingredients.some(row => ['pork', 'beef', 'chicken', 'gelatine'].includes(row.id)));
});

test('spelling matches keep free-from context and do not invent unknown meals', () => {
  assert.equal(resolveFood('spagetti bolognese').matched, true);
  assert.equal(resolveFood('gluten free tost').matched, true);
  assert.ok(!resolveFood('gluten free tost').ingredients.some(row => row.id === 'wheat'));
  assert.ok(suggestFoodNames('buffallo wings').some(name => /buffalo wings/i.test(name)));
  assert.equal(resolveFood('quuxalicious unknown dish').matched, false);
});

test('UK restaurant aliases resolve to their correct, distinct official menus', () => {
  for (const name of ["McDonald's", 'McDonalds', 'mc donalds']) {
    const result = searchLocalProducts(name, { country: 'United Kingdom', limit: 200 });
    assert.equal(result.total, 136);
    assert.ok(result.products.every(row => row.brands === "McDonald's" && row.sourceUrl.startsWith('https://www.mcdonalds.com/gb/')));
    assert.ok(result.products.some(row => row.name === 'Big Mac'));
  }
  for (const name of ['KFC', 'Kentucky fried chicken']) assert.equal(searchLocalProducts(name, { country: 'United Kingdom' }).total, 137);
  for (const name of ['Burger King', 'burgerking', 'BK']) assert.equal(searchLocalProducts(name, { country: 'United Kingdom' }).total, 213);
  assert.equal(searchLocalProducts('KFC Zinger', { country: 'United Kingdom', limit: 100 }).products.every(row => /zinger/i.test(row.name)), true);
  assert.ok(searchLocalProducts('Burger King Whopper', { country: 'United Kingdom', limit: 100 }).total > 5);
  assert.equal(findBrand('Maccies')?.name, "McDonald's");
  assert.equal(suggestBrands('burger ki')[0].name, 'Burger King');
  assert.equal(suggestBrands('dolmoi')[0].name, 'Dolmio');
});

test('restaurant names without a full published list never acquire recipe assumptions', async () => {
  for (const brand of ['KFC', 'Burger King']) {
    const product = searchLocalProducts(brand, { country: 'United Kingdom' }).products[0];
    const result = await refreshSelectedProduct(product);
    assert.equal(result.ingredientsText, undefined);
    assert.deepEqual(result.ingredients, []);
    assert.ok(result.warnings.some(w => /complete ingredients list is not published/.test(w)));
  }
});

test('US records are explicitly separated from UK results, have published lists, and paginate locally', () => {
  const result = searchLocalProducts('Kellogg', { country: 'United States', limit: 100 });
  assert.ok(result.total > 0);
  assert.ok(result.products.every(row => row.country === 'United States' && row.ingredientsText && row.sourceLabel === 'USDA'));
  assert.equal(searchLocalProducts('Kellogg', { country: 'United Kingdom' }).total, 0);
  assert.equal(searchLocalProducts('McDonalds', { limit: 12 }).products.length, 12);
  assert.equal(searchLocalProducts('McDonalds', { limit: 24 }).products.length, 24);
});

test('manufacturer refresh parses every actual component despite intermediate trace warnings', async () => {
  const original = globalThis.fetch;
  const product = searchLocalProducts('McDonalds Big Mac', { country: 'United Kingdom' }).products[0];
  let requested = '';
  try {
    globalThis.fetch = async input => { requested = String(input); return new Response(JSON.stringify({ item: { components: { component: [
      { is_default: 1, ingredient_statement: 'Wheat flour, water, yeast. May contain sesame.' },
      { is_default: 1, ingredient_statement: 'Beef, salt.' },
      { is_default: 1, ingredient_statement: 'Either: milk, mustard OR: egg, mustard.' },
      { is_default: 1, ingredient_statement: '100% Onion.' },
      { is_default: 1, ingredient_statement: '100% Iceberg Lettuce.' },
      { is_default: 1, ingredient_statement: 'Water, rapeseed oil, <span class="offscreen">Allergen Ingredient: </span> Free Range <strong>EGG</strong> Yolk, Spices (contain <span class="offscreen">Allergen Ingredient: </span><strong>MUSTARD</strong>), salt.' },
      { is_default: 0, ingredient_statement: 'Peanuts, honey.' },
    ] } } })); };
    const refreshed = await refreshSelectedProduct(product);
    assert.ok(requested.startsWith('https://www.mcdonalds.com/dnaapp/itemDetails?country=UK'));
    assert.equal(refreshed.ingredientConfidence, 'inferred');
    for (const ingredient of ['Wheat', 'Beef', 'Salt', 'Mustard', 'Onion', 'iceberg lettuce', 'free range egg yolk']) assert.ok(refreshed.ingredients.some(row => row.name === ingredient), ingredient);
    assert.ok(!refreshed.ingredients.some(row => /peanut|honey|sesame/i.test(row.name)));
    assert.ok(refreshed.traces.includes('sesame'));
  } finally { globalThis.fetch = original; }
});

test('manufacturer ingredient fields retain single foods and all supplier alternatives without reading marketing as ingredients', () => {
  assert.equal(manufacturerIngredientText('100% Pure Beef.<br/>No additives, fillers or binders.'), 'Beef');
  const single = parseIngredientLabel(manufacturerIngredientText('100% Onion. May contain sesame.'), { source: 'catalog' });
  assert.deepEqual(single.ingredients, ['Onion']); assert.deepEqual(single.mayContain, ['sesame']);
  const alternatives = manufacturerIngredientText('EITHER: rice, sesame. OR: Ingredients: wheat, soy.');
  for (const name of ['Rice', 'Sesame', 'Wheat', 'Soy']) assert.ok(parseIngredientLabel(alternatives, { source: 'catalog' }).ingredients.includes(name), name);
  assert.deepEqual(parseIngredientLabel('Ingredients: 100% onion.', { source: 'catalog' }).ingredients, ['Onion']);
});

test('remote searches use the actual brand filter, selected country and requested page; offline barcodes offer label scanning', async () => {
  const original = globalThis.fetch, originalNow = Date.now;
  let now = originalNow() + 100000, requested = '';
  Date.now = () => now;
  try {
    globalThis.fetch = async input => { requested = String(input); return new Response(JSON.stringify({ products: [] })); };
    await searchProducts('Burger King Whopper', { page: 2, country: 'United Kingdom' });
    const url = new URL(requested);
    assert.equal(url.searchParams.get('search_terms'), 'whopper');
    assert.equal(url.searchParams.get('tag_0'), 'burger-king');
    assert.equal(url.searchParams.get('tag_1'), 'united-kingdom');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('page_size'), '50');
    now += 10000;
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(lookupBarcode('87654321'), error => error instanceof CatalogError && error.code === 'network' && /Photograph the ingredients list/.test(error.message));
  } finally { globalThis.fetch = original; Date.now = originalNow; }
});

test('expanded food and brand catalogues do not turn packet addresses or gluten-free marketing into ingredient exposures', () => {
  const result = parseIngredientLabel('GLUTEN FREE\nIngredients: sugar, glucose syrup, niacin (vitamin B3), water.\nAllergy advice!\nMade in Turkey\nE-mail: sweets@example.com\nAcme Inc, 23 Milk Street\nTM', { source: 'catalog' });
  // The existing canonical sugar family merges glucose syrup, so it appears once.
  assert.deepEqual(result.ingredients, ['Sugar', 'Niacin (vitamin B3)', 'Water']);
});
