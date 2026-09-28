import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, analyzePatterns, ingredientsFromNames, resolveFood, suggestFoodNames, ingredientCatalog } from '../src/domain';
import { foodIdentity, groupPatternsForDisplay, mealExposures } from '../src/domain/patternEvidence';
import { foodGroupHistory } from '../src/domain/foodGroups';
import { isPackagingText } from '../src/domain/ingredientTextPolicy';
import { normalizeCatalogProduct } from '../src/services/products';
import { parseIngredientLabel } from '../src/services/labelParser';
import { selectRecognizedRegion } from '../src/services/ocrRegion';
import { notificationRoute } from '../src/domain/notificationRoute';
import { patternTimeline } from '../src/domain/patternTimeline';
import { emptyDiary, parseDiary } from '../src/storage/schema';
import type { AppData, Meal } from '../src/domain/types';

const now = new Date('2026-09-20T12:00:00');
const meal = (name: string, names: string[], extra: Partial<Meal> = {}): Meal => ({ id: 'meal', name, eatenAt: '2026-08-01T12:00:00Z', ingredients: ingredientsFromNames(names), source: 'label', ...extra });
function diary(): AppData {
  const data: AppData = { meals: [], symptoms: [], checkIns: [], customSymptoms: [] };
  for (let i = 0; i < 42; i++) {
    const date = addDays('2026-07-01', i), exposed = i % 2 === 0;
    data.meals.push(meal(exposed ? 'Granola' : 'Rice', exposed ? ['oats', 'almond', 'honey'] : ['rice'], { id: `m${i}`, eatenAt: `${date}T08:00:00Z`, productCode: exposed ? '12345678' : undefined }));
    data.checkIns.push({ date, complete: true, stress: 2, sleepHours: 8, trackedSymptomIds: ['bloating'] });
    if (exposed) data.symptoms.push({ id: `s${i}`, occurredAt: `${date}T15:00:00Z`, symptomId: 'bloating', severity: 3 });
  }
  return data;
}

test('regional names, missing sweets and close recipe misspellings resolve with estimates', () => {
  for (const name of ['macaroni cheese', 'mac & cheese', 'macaroni cheeze', 'fudge', 'bacon roll', 'bacon cob', 'bacon sandwich']) {
    const result = resolveFood(name); assert(result.matched, name); assert(result.ingredients.length >= 2, name); assert(result.ingredients.every(i => i.confidence === 'inferred'));
  }
  assert.deepEqual(resolveFood('bacon roll').ingredients, resolveFood('bacon cob').ingredients);
  assert(suggestFoodNames('spagetti bolognese').some(name => name.includes('bolognese')));
  assert(!resolveFood('completely imaginary dinner').matched);
  assert(!resolveFood('vegan macaroni cheese').ingredients.some(i => ['milk', 'lactose', 'cheese', 'butter'].includes(i.id)));
});

test('butter stays distinct, dairy lactose is contextual and free-from claims persist', () => {
  assert.equal(resolveFood('butter').ingredients[0].id, 'butter');
  assert(!mealExposures(meal('Butter', ['butter'])).some(i => i.id === 'lactose'));
  assert(!mealExposures(meal('Cheddar', ['cheddar'])).some(i => i.id === 'lactose'));
  assert(mealExposures(meal('Natural yoghurt', ['milk'])).some(i => i.id === 'lactose' && i.derivedFrom === 'milk'));
  assert(!mealExposures(meal('Lactose-free yoghurt', ['milk'])).some(i => i.id === 'lactose'));
  assert(!mealExposures(meal('Yoghurt', ['milk'], { excludedComponents: ['lactose'] })).some(i => i.id === 'lactose'));
  assert(!mealExposures(meal('Pudding', ['lactose-free milk'])).some(i => i.id === 'lactose'));
  assert(!mealExposures(meal('Gluten-free bread', ['wheat'])).some(i => i.id === 'gluten'));
  assert(!mealExposures(meal('Peanut butter', ['peanut butter'])).some(i => i.id === 'milk-protein'));
});

test('catalogue and OCR discard addresses, trademark tokens, origin and contact prose', () => {
  const junk = ['TM', 'Inc', 'E-mail', 'Made in Turkey', 'Contact us', '12 Example Road', 'hello@example.com', 'www.example.com'];
  const product = normalizeCatalogProduct({ code: '12345678', ingredients_text_en: 'Sugar, gelatine, water', ingredients: [...junk, 'sugar', 'gelatine', 'water'].map(text => ({ text })) })!;
  assert.deepEqual(product.ingredients.map(i => i.name), ['sugar', 'gelatine', 'water']);
  assert(!ingredientCatalog.some(i => isPackagingText(i.name)));
  const parsed = parseIngredientLabel('Ingredients: sugar, gelatine, water.\nMade in Turkey\n12 Example Road\nE-mail: hello@example.com\nTM, Inc');
  assert(parsed.ingredients.includes('Sugar'));
  assert(!parsed.ingredients.some(i => /Turkey|Email|Example|Inc|TM/.test(i)));
  assert.equal(ingredientsFromNames(['Turkey'])[0].id, 'turkey', 'the food turkey is still valid');
});

test('headerless photos retain continuation lines without including product name', () => {
  const parsed = parseIngredientLabel('Bread\nwheat, water, yeast,\nsalt, sugar\nMade in Turkey');
  assert.deepEqual(parsed.ingredients, ['Wheat', 'Water', 'Yeast', 'Salt', 'Sugar']);
});

test('lactose-free milk wording survives label parsing', () => {
  const parsed = parseIngredientLabel('Ingredients: lactose-free milk, sugar');
  const exposures = mealExposures(meal('Dessert', parsed.ingredients));
  assert(exposures.some(i => i.id === 'milk'));
  assert(!exposures.some(i => i.id === 'lactose'));
  for (const names of [['milk', 'lactose-free milk'], ['lactose-free milk', 'milk']]) assert(mealExposures(meal('Mixed milks', names)).some(i => i.id === 'lactose'));
});

test('whole product groups identical component evidence without hiding independent ingredient exposures', () => {
  const data = diary(); const patterns = analyzePatterns(data, { now, window: 'same-day' }).patterns;
  const display = groupPatternsForDisplay(patterns, data);
  const product = display.find(p => p.ingredientId === 'food:12345678'); assert(product);
  assert(product.linkedIngredients?.some(i => i.id === 'almond'));
  assert(!display.some(p => p.ingredientId === 'almond'));
  data.meals.push(meal('Almonds', ['almond'], { id: 'independent', eatenAt: '2026-07-02T09:00:00Z' }));
  const independent = groupPatternsForDisplay(analyzePatterns(data, { now, window: 'same-day' }).patterns, data);
  assert(independent.some(p => p.ingredientId === 'almond'));
});

test('sleep imbalance reduces diary confidence without rewriting raw symptom rates', () => {
  const data = diary(); const baseline = analyzePatterns(data, { now, window: 'same-day' }).patterns.find(p => p.ingredientId === 'food:12345678')!;
  assert.equal(baseline.status, 'emerging');
  data.checkIns.forEach((c, i) => c.sleepHours = i % 2 === 0 ? 4 : 8);
  const pattern = analyzePatterns(data, { now, window: 'same-day' }).patterns.find(p => p.ingredientId === 'food:12345678')!;
  assert.notEqual(pattern.status, 'emerging'); assert.equal(pattern.riskDifference, baseline.riskDifference);
  assert(pattern.cautions.some(c => c.includes('Sleep differs')));
});

test('a weaker inferred product does not hide stronger direct ingredient evidence', () => {
  const data = diary();
  data.meals.forEach(m => { if (m.productCode) m.ingredients.find(i => i.id === 'honey')!.confidence = 'inferred'; });
  const patterns = groupPatternsForDisplay(analyzePatterns(data, { now, window: 'same-day' }).patterns, data);
  assert.equal(patterns.find(p => p.ingredientId === 'almond')?.status, 'emerging');
});

test('next-day visual pairs the food date with the following outcome date and preserves missing tracking', () => {
  const data = diary();
  const base = analyzePatterns(data, { now, window: 'same-day' }).patterns.find(p => p.ingredientId === 'food:12345678')!;
  const timeline = patternTimeline({ ...base, window: 'next-day' }, data, now);
  assert.deepEqual(timeline.find(d => d.date === '2026-07-01'), { date: '2026-07-01', symptomDate: '2026-07-02', exposed: true, symptom: false, complete: true });
  assert.equal(timeline.find(d => d.date === '2026-07-02')?.symptom, true);
  data.checkIns[1].trackedSymptomIds = [];
  assert.equal(patternTimeline({ ...base, window: 'next-day' }, data, now).find(d => d.date === '2026-07-01')?.complete, false);
});

test('notes do not silently manufacture exposures or change symptom statistics', () => {
  const data = diary(), before = analyzePatterns(data, { now });
  data.meals.forEach(m => m.notes = 'No milk. Stress and terrible sleep?');
  data.checkIns.forEach(c => c.notes = 'allergic to everything');
  assert.deepEqual(analyzePatterns(data, { now }), before);
});

test('less-established intolerance explanations are labelled with lower interpretive confidence', () => {
  const data = diary(); data.meals.forEach((m, i) => { m.productCode = undefined; m.ingredients = ingredientsFromNames(i % 2 === 0 ? ['niacin'] : ['rice']); });
  const pattern = analyzePatterns(data, { now, window: 'same-day' }).patterns.find(p => p.ingredientId === 'niacin')!;
  assert.equal(pattern.interpretationConfidence, 'limited');
  assert(pattern.evidenceContext?.includes('less established'));
});

test('long product identifiers fit notification backup limits and plain water has no product hypothesis', () => {
  assert(foodIdentity(meal('very long '.repeat(30), ['milk', 'sugar']))!.length < 90);
  assert.notEqual(foodIdentity(meal('same'.repeat(40) + 'a', ['milk', 'sugar'])), foodIdentity(meal('same'.repeat(40) + 'b', ['milk', 'sugar'])));
  assert.equal(foodIdentity(meal('Still mineral water', ['water', 'calcium'], { productCode: '12345678' })), undefined);
  for (const name of ['water', 'mineral water', 'spring water', 'tap water']) assert.equal(ingredientsFromNames([name])[0].id, 'water');
  assert.equal(mealExposures(meal('Water', [], { ingredients: [{ id: 'off-spring-water', name: 'Spring water', confidence: 'confirmed' }] }))[0].id, 'water');
});

test('photo selection converts Vision coordinates and excludes address lines outside the box', () => {
  const result = selectRecognizedRegion({ text: '', confidence: 1, blocks: [
    { text: 'sugar, water', confidence: .9, bounds: { x: .1, y: .65, width: .8, height: .1 } },
    { text: 'Made in Turkey', confidence: 1, bounds: { x: .1, y: .15, width: .8, height: .1 } },
  ] }, { x: 0, y: .2, width: 1, height: .2 });
  assert.equal(result.text, 'sugar, water'); assert.equal(result.blocks.length, 1);
});

test('notification payloads route to logging, daily review and a specific pattern', () => {
  assert.equal(notificationRoute({ kind: 'food-reminder' })?.screen, 'meal');
  assert.equal(notificationRoute({ kind: 'day-review-reminder' })?.screen, 'checkin');
  assert.deepEqual(notificationRoute({ kind: 'new-pattern', patternId: 'milk:bloating:same-day' }), { screen: 'patterns', patternId: 'milk:bloating:same-day' });
  assert.equal(notificationRoute({ kind: 'untrusted' }), undefined);
});

test('meal groups, barcode and exclusion context survive backup with validation', () => {
  const saved = emptyDiary(); saved.data.meals.push(meal('Dinner yoghurt', ['lactose-free milk'], { groupId: '2026-08-01:Dinner', groupName: 'Dinner', productCode: '12345678', excludedComponents: ['lactose'] }));
  assert.deepEqual(parseDiary(JSON.stringify(saved)), saved);
  saved.data.meals[0].productCode = '../invalid'; assert.throws(() => parseDiary(JSON.stringify(saved)));
});

test('food-group history distinguishes sparse logging from recorded variety and excludes oils', () => {
  const data: AppData = { meals: [meal('Apple', ['apple']), meal('Walnut oil', ['walnut oil'], { id: 'oil' })], symptoms: [], checkIns: [], customSymptoms: [] };
  const groups = foodGroupHistory(data, now);
  assert.equal(groups.find(g => g.name === 'Fruit')!.weeks.reduce((n, w) => n + w.presentDays, 0), 1);
  assert.equal(groups.find(g => g.name === 'Beans, lentils & nuts')!.weeks.reduce((n, w) => n + w.presentDays, 0), 0);
  assert(groups.every(g => g.weeks.every(w => w.completeDays === 0)));
});
