import test from 'node:test';
import assert from 'node:assert/strict';
import { addedFoodRecordCount, resolveFood, suggestFoodNames } from '../src/domain/foods';
import { resolveIngredientEntry } from '../src/domain/ingredientEntry';
import { brandCatalogSize, findBrand, suggestBrands } from '../src/domain/brands';
import { localProductCount, searchLocalProducts } from '../src/services/localProducts';
import { CatalogError, lookupBarcode, normalizeCatalogProduct, searchProducts } from '../src/services/products';
import { parseIngredientLabel } from '../src/services/labelParser';
import guide from '../src/data/extendedFoodGuide.json';
import offBrands from '../src/data/openFoodFactsBrands.json';
import offIngredients from '../src/data/openFoodFactsIngredients.json';

test('thousands of distinct source foods and real brand/product records are available', () => {
  assert.equal(addedFoodRecordCount, 12713);
  assert.equal(new Set(guide.records.map(row => row.id)).size, addedFoodRecordCount);
  assert.ok(guide.records.every(row => row.sourceUrl.startsWith('https://fdc.nal.usda.gov/food-details/')));
  assert.ok(brandCatalogSize >= 37000);
  assert.equal(localProductCount, 60000);
  for (const dataset of [guide, offBrands, offIngredients]) assert.equal(dataset.licenseUrl, 'https://opendatacommons.org/licenses/odbl/1-0/');
  assert.equal(guide.sourceLicense, 'Public domain / CC0');
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

test('restaurant identification aliases remain available without claiming copied UK menus', () => {
  for (const name of ["McDonald's", 'McDonalds', 'mc donalds', 'Maccies']) {
    assert.equal(findBrand(name)?.name, "McDonald's");
    assert.equal(searchLocalProducts(name, { country: 'United Kingdom' }).total, 0);
  }
  for (const name of ['KFC', 'Kentucky fried chicken']) {
    assert.equal(findBrand(name)?.name, 'KFC');
    assert.equal(searchLocalProducts(name, { country: 'United Kingdom' }).total, 0);
  }
  for (const name of ['Burger King', 'burgerking', 'BK']) {
    assert.equal(findBrand(name)?.name, 'Burger King');
    assert.equal(searchLocalProducts(name, { country: 'United Kingdom' }).total, 0);
  }
  assert.equal(findBrand('McDonalds')?.productsInSource, 1); // Existing licensed USDA source directory count.
  assert.equal(findBrand('KFC')?.productsInSource, 0);
  assert.equal(findBrand('Burger King')?.productsInSource, 0);
  assert.equal(suggestBrands('burger ki')[0].name, 'Burger King');
  assert.equal(suggestBrands('dolmoi')[0].name, 'Dolmio');
});

test('restaurant records without a published ingredient list never acquire recipe assumptions', () => {
  const result = normalizeCatalogProduct({ code: '12345678', product_name: 'Chicken burger', brands: 'KFC', allergens_tags: ['en:wheat', 'en:milk'] })!;
  assert.equal(result.ingredientsText, undefined);
  assert.deepEqual(result.ingredients, []);
  assert.ok(result.warnings.some(w => /no ingredient list/.test(w)));
});

test('US records are explicitly separated from UK results, have published lists, and paginate locally', () => {
  const result = searchLocalProducts('Kellogg', { country: 'United States', limit: 100 });
  assert.ok(result.total > 0);
  assert.ok(result.products.every(row => row.country === 'United States' && row.ingredientsText && row.sourceLabel === 'USDA'));
  assert.equal(searchLocalProducts('Kellogg', { country: 'United Kingdom' }).total, 0);
  assert.equal(searchLocalProducts('shredded', { country: 'United States', limit: 12 }).products.length, 12);
  assert.equal(searchLocalProducts('shredded', { country: 'United States', limit: 24 }).products.length, 24);
});

test('remote searches use the actual brand filter, selected country and requested page; offline barcodes offer label scanning', async () => {
  const original = globalThis.fetch, originalNow = Date.now;
  let now = originalNow() + 100000, requested = '';
  Date.now = () => now;
  try {
    globalThis.fetch = async input => { requested = String(input); return new Response(JSON.stringify({ products: [] })); };
    for (const [query, term, brand] of [["McDonald's Big Mac", 'big mac', 'mcdonalds'], ['Kentucky fried chicken Zinger', 'zinger', 'kfc'], ['BK Whopper', 'whopper', 'burger-king']]) {
      await searchProducts(query, { page: 2, country: 'United Kingdom' });
      const url = new URL(requested);
      assert.equal(url.origin, 'https://world.openfoodfacts.org');
      assert.equal(url.pathname, '/cgi/search.pl');
      assert.equal(url.searchParams.get('search_terms'), term);
      assert.equal(url.searchParams.get('tag_0'), brand);
      assert.equal(url.searchParams.get('tag_1'), 'united-kingdom');
      assert.equal(url.searchParams.get('page'), '2');
      assert.equal(url.searchParams.get('page_size'), '50');
      now += 10000;
    }
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
