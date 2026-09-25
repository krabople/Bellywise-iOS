import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, analyzePatterns, BUILT_IN_SYMPTOMS, getDemoData, getIngredientInfo, ingredientsFromNames, isDateKey, localDateKey, resolveFood, suggestIngredientRecords } from '../src/domain';
import { AppData } from '../src/domain/types';
import { benjaminiHochberg, differenceInterval, fisherExact, wilsonInterval } from '../src/domain/statistics';

const now = new Date(2026, 8, 19, 12);
function synthetic(count = 42, inferred = false): AppData {
  const data: AppData = { meals: [], symptoms: [], checkIns: [], customSymptoms: [] };
  for (let index = 0; index < count; index++) {
    const day = addDays('2026-07-01', index);
    data.checkIns.push({ date: day, complete: true, trackedSymptomIds: BUILT_IN_SYMPTOMS.map(item => item.id), stress: 2 });
    data.meals.push({ id: `meal-${index}`, name: index % 2 === 0 ? 'Milk' : 'Rice', eatenAt: new Date(`${day}T08:00:00`).toISOString(), source: 'typed', ingredients: ingredientsFromNames(index % 2 === 0 ? ['Milk'] : ['Rice'], inferred ? 'inferred' : 'confirmed') });
    if (index % 2 === 0) data.symptoms.push({ id: `symptom-${index}`, symptomId: 'bloating', occurredAt: new Date(`${day}T12:00:00`).toISOString(), severity: 3 });
  }
  return data;
}

test('gluten-free and lactose-free are different exclusions', () => {
  assert(!resolveFood('gluten-free bread').ingredients.some(item => ['wheat', 'barley', 'rye'].includes(item.id)));
  assert(!resolveFood('spaghetti bolognese', 'gluten-free').ingredients.some(item => item.id === 'wheat'));
  const lactoseFree = resolveFood('latte', 'lactose-free').ingredients.map(item => item.id);
  assert(lactoseFree.includes('milk'));
  assert(!lactoseFree.includes('lactose'));
  const oat = resolveFood('latte', 'oat').ingredients.map(item => item.id);
  assert(oat.includes('oats') && oat.includes('coffee'));
  assert(!oat.includes('milk') && !oat.includes('lactose'));
});

test('explicit exclusions and plant foods do not become dairy', () => {
  for (const name of ['peanut butter', 'almond butter', 'coconut milk', 'oat milk']) assert(!resolveFood(name).ingredients.some(item => item.id === 'milk'), name);
  assert(!resolveFood('bread without gluten').ingredients.some(item => item.id === 'wheat'));
  assert(!resolveFood('bolognese without onion and garlic').ingredients.some(item => item.id === 'onion' || item.id === 'garlic'));
  assert(!resolveFood('vegan lasagne').ingredients.some(item => ['beef', 'milk', 'lactose', 'egg'].includes(item.id)));
  assert(!resolveFood('baked beans').ingredients.some(item => item.id === 'wheat'));
});

test('dish recipes are inferred, unknown foods preserved and questions explicit', () => {
  assert(resolveFood('bread').questions[0].options.some(item => item.id === 'gluten-free'));
  assert.equal(resolveFood('bread', 'standard').questions.length, 0);
  assert(resolveFood('spaghetti bolognese').ingredients.every(item => item.confidence === 'inferred'));
  const unknown = resolveFood('Grandma special');
  assert.equal(unknown.matched, false);
  assert.equal(unknown.ingredients[0].name, 'Grandma special');
  assert.equal(unknown.ingredients[0].confidence, 'inferred');
  assert.equal(resolveFood('rice and mystery stew').ingredients.find(item => item.id.startsWith('custom-'))?.name, 'mystery stew');
  const reviewed = ingredientsFromNames(['wheat flour', 'Milk', 'whole milk', 'new ingredient']);
  assert.equal(reviewed.filter(item => item.id === 'milk').length, 1);
  assert(reviewed.every(item => item.confidence === 'confirmed'));
});

test('canonical ingredient aliases collapse vitamin names without inventing free-from exposures', () => {
  const vitamins = ingredientsFromNames(['niacin', 'B3', 'vitamin B3']);
  assert.deepEqual(vitamins.map(item => item.id), ['niacin']);
  assert.equal(vitamins[0].name, 'Niacin (vitamin B3)');
  assert(!ingredientsFromNames(['gluten free']).some(item => item.id === 'wheat'));
  assert.equal(ingredientsFromNames(['gluten-free oats'])[0].id, 'oats');
});

test('preparation variants share a food family while materially different derivatives remain distinct', () => {
  const garlic = ingredientsFromNames(['garlic', 'fresh garlic', 'dried garlic', 'garlic powder']);
  assert.deepEqual(garlic.map(item => item.id), ['garlic']);
  assert.deepEqual(ingredientsFromNames(['strawberries', 'raw strawberry', 'frozen strawberries']).map(item => item.id), ['strawberry']);
  assert.equal(ingredientsFromNames(['fresh onion', 'red onion'])[0].id, 'onion');
  assert.notEqual(ingredientsFromNames(['garlic oil'])[0].id, 'garlic');
  assert.notEqual(ingredientsFromNames(['wild garlic'])[0].id, 'garlic');
  assert.equal(suggestIngredientRecords('fresh garlic')[0]?.id, 'garlic');
});

test('unknown manual ingredients get useful close catalogue matches', () => {
  assert.equal(suggestIngredientRecords('niacn')[0]?.id, 'niacin');
  assert(suggestIngredientRecords('sunflour lecithin').some(item => /sunflower lecithin/i.test(item.name)));
});

test('ingredient information distinguishes recognised triggers from ordinary and unknown ingredients', () => {
  const garlic = getIngredientInfo('garlic');
  assert.equal(garlic.triggerLevel, 'recognised');
  assert.match(garlic.triggerSummary, /fermentable carbohydrates/i);
  assert(garlic.commonSymptoms.includes('Bloating'));

  const milk = getIngredientInfo('milk');
  assert.equal(milk.triggerLevel, 'recognised');
  assert.match(milk.triggerSummary, /lactose intolerance and milk allergy/i);
  assert(milk.commonSymptoms.some(symptom => /swelling/i.test(symptom)));

  const rice = getIngredientInfo('rice');
  assert.equal(rice.triggerLevel, 'not-common');
  assert.equal(rice.commonSymptoms.length, 0);
  assert.doesNotMatch(rice.symptomContext, /not automatically a cause/i);

  const garlicOilId = ingredientsFromNames(['garlic oil'])[0].id;
  const garlicOil = getIngredientInfo(garlicOilId);
  assert.equal(garlicOil.triggerLevel, 'possible');
  assert.doesNotMatch(garlicOil.triggerSummary, /fermentable carbohydrates/i);

  const unknown = getIngredientInfo('custom-mystery-powder', 'Mystery powder');
  assert.equal(unknown.triggerLevel, 'unknown');
  assert.match(unknown.triggerSummary, /not enough reliable/i);
});

test('known Fisher, Wilson and BH numerical values', () => {
  assert(Math.abs(fisherExact(1, 9, 11, 3) - 0.00275945618522008) < 1e-10);
  assert.equal(fisherExact(0, 0, 0, 0), 1);
  assert(Math.abs(fisherExact(4, 4, 4, 4) - 1) < 1e-10);
  const [lower, upper] = wilsonInterval(0, 10);
  assert(lower < 1e-10 && Math.abs(upper - 0.2775327998628892) < 1e-8);
  assert.deepEqual(benjaminiHochberg([0.01, 0.04, 0.03, 0.002]), [0.02, 0.04, 0.04, 0.008]);
  const interval = differenceInterval(10, 10, 0, 10);
  assert(interval[0] > 0.5 && interval[1] === 1);
});

test('drinks respect milk alternatives, decaf, alcohol-free and unknown sweeteners', () => {
  const oatLatte = resolveFood('oat latte').ingredients.map(item => item.id);
  assert(oatLatte.includes('oats') && oatLatte.includes('coffee') && oatLatte.includes('caffeine'));
  assert(!oatLatte.includes('milk'));
  const decaf = resolveFood('decaf latte', 'oat').ingredients.map(item => item.id);
  assert(decaf.includes('oats') && decaf.includes('coffee'));
  assert(!decaf.includes('caffeine') && !decaf.includes('milk'));
  assert(!resolveFood('peppermint tea').ingredients.some(item => item.id === 'caffeine'));
  assert(resolveFood('black tea').ingredients.some(item => item.id === 'caffeine'));
  assert(resolveFood('orange juice').ingredients.some(item => item.id === 'orange'));
  assert(!resolveFood('alcohol-free beer').ingredients.some(item => item.id === 'alcohol'));
  assert(resolveFood('red wine').ingredients.some(item => item.id === 'alcohol'));
  const dietCola = resolveFood('cola', 'sugar-free').ingredients;
  assert(!dietCola.some(item => item.id === 'sugar'));
  assert(dietCola.some(item => item.id.startsWith('custom-') && item.confidence === 'inferred'));
  assert.equal(ingredientsFromNames(['Pasteurised semi-skimmed MILK'])[0].id, 'milk');
  assert.equal(ingredientsFromNames(['lactose-free milk'])[0].id, 'milk');
  assert.notEqual(ingredientsFromNames(['dairy-free cream'])[0].id, 'milk');
});

test('a repeated strong pattern is found with explanatory comparison counts', () => {
  const result = analyzePatterns(synthetic(), { now });
  const milk = result.patterns.find(item => item.ingredientId === 'milk');
  assert(milk);
  assert.equal(milk.window, 'same-day');
  assert.equal(milk.exposedDays, 21);
  assert.equal(milk.unexposedDays, 21);
  assert.equal(milk.riskDifference, 1);
  assert.equal(milk.status, 'emerging');
  assert(milk.adjustedPValue < 0.05);
});

test('duplicate meals and symptoms never inflate the number of observations', () => {
  const data = synthetic();
  const baseline = analyzePatterns(data, { now });
  data.meals.push({ ...data.meals[0], id: 'duplicate-meal' });
  data.symptoms.push({ ...data.symptoms[0], id: 'duplicate-symptom' });
  assert.deepEqual(analyzePatterns(data, { now }), baseline);
});

test('same-day symptoms before ingredient exposure cannot get the stronger label', () => {
  const data = synthetic();
  // Use explicit local times so this test is independent of the host timezone.
  for (const symptom of data.symptoms) symptom.occurredAt = new Date(`${localDateKey(symptom.occurredAt)}T05:00:00`).toISOString();
  const milk = analyzePatterns(data, { now, window: 'same-day' }).patterns.find(item => item.ingredientId === 'milk');
  assert(milk);
  assert.equal(milk.status, 'exploratory');
  assert(milk.cautions.some(item => item.includes('before the first recorded')));
});

test('sparse days and inferred recipes cannot receive an emerging label', () => {
  const sparse = analyzePatterns(synthetic(8), { now });
  assert(sparse.patterns.length > 0);
  assert(sparse.patterns.every(item => item.status === 'not-enough-data'));
  const inferred = analyzePatterns(synthetic(42, true), { now });
  assert(inferred.patterns.every(item => item.status !== 'emerging'));
  assert.equal(inferred.patterns.find(item => item.ingredientId === 'milk')?.confirmedExposedDays, 0);
});

test('a missing/incomplete day never becomes a negative control; newest check-in wins', () => {
  const data = synthetic();
  data.checkIns = data.checkIns.filter((_, index) => index % 2 === 0);
  const result = analyzePatterns(data, { now });
  assert.equal(result.completeDays, 21);
  assert(!result.patterns.some(item => item.ingredientId === 'milk'));
  data.checkIns.push({ ...data.checkIns[0], complete: false });
  assert.equal(analyzePatterns(data, { now }).completeDays, 20);
});

test('newly tracked feelings do not turn historical untracked dates into negative controls', () => {
  const data = synthetic();
  for (let index = 0; index < data.checkIns.length; index++) if (index % 2 === 1) data.checkIns[index].trackedSymptomIds = ['energy'];
  assert(!analyzePatterns(data, { now, window: 'same-day' }).patterns.some(item => item.ingredientId === 'milk'));
  for (const checkIn of data.checkIns) delete checkIn.trackedSymptomIds;
  const legacy = analyzePatterns(data, { now });
  assert.equal(legacy.patterns.length, 0);
  assert(legacy.message.includes('which feelings were tracked'));
});

test('missing dates do not manufacture separate exposure runs', () => {
  const data = synthetic();
  for (let index = 0; index < data.meals.length; index++) {
    const milk = index < 21;
    data.meals[index].ingredients = ingredientsFromNames(milk ? ['milk'] : ['rice']);
  }
  data.symptoms = data.meals.filter((_, index) => index < 21).map((meal, index) => ({ id: `block-${index}`, symptomId: 'bloating', occurredAt: new Date(`${localDateKey(meal.eatenAt)}T12:00:00`).toISOString(), severity: 3 }));
  data.checkIns = data.checkIns.filter((_, index) => index >= 21 || index % 2 === 0);
  const milk = analyzePatterns(data, { now, window: 'same-day' }).patterns.find(item => item.ingredientId === 'milk');
  assert(milk);
  assert.equal(milk.status, 'exploratory');
  assert(milk.cautions.some(item => item.includes('fewer than three separate')));
});

test('next-day analysis requires both adjacent dates to be complete', () => {
  const data = synthetic(12);
  data.checkIns = data.checkIns.filter((_, index) => index % 2 === 0);
  assert.equal(analyzePatterns(data, { now, window: 'next-day' }).patterns.length, 0);
});

test('unresolved meals cannot silently supply unexposed control days', () => {
  const data = synthetic();
  for (let index = 1; index < data.meals.length; index += 2) data.meals[index].ingredients = resolveFood('mystery meal').ingredients;
  assert(!analyzePatterns(data, { now }).patterns.some(item => item.ingredientId === 'milk'));
});

test('confirmed-only mode excludes inferred exposure days instead of making controls', () => {
  const data = synthetic();
  for (let index = 0; index < data.meals.length; index++) if (index % 4 === 0) data.meals[index].ingredients[0].confidence = 'inferred';
  const milk = analyzePatterns(data, { now, window: 'same-day', includeInferred: false }).patterns.find(item => item.ingredientId === 'milk');
  assert(milk);
  assert.equal(milk.exposedDays, 10);
  assert.equal(milk.unexposedDays, 21);
});

test('stress and inseparable co-ingredients are surfaced', () => {
  const data = synthetic();
  for (let index = 0; index < data.checkIns.length; index++) {
    if (index % 2 === 0) {
      data.checkIns[index].stress = 5;
      data.meals[index].ingredients.push(...ingredientsFromNames(['Lactose']));
    }
  }
  const milk = analyzePatterns(data, { now }).patterns.find(item => item.ingredientId === 'milk');
  assert(milk);
  assert.equal(milk.status, 'exploratory');
  assert(milk.coOccursWith.includes('Lactose'));
  assert(milk.cautions.some(item => item.includes('Stress differs')));
});

test('positive feelings remain distinct outcomes', () => {
  const data = synthetic();
  data.symptoms.forEach(item => { item.symptomId = 'energy'; });
  const result = analyzePatterns(data, { now });
  assert(result.patterns.length > 0);
  assert(result.patterns.every(item => item.symptomKind === 'positive'));
});

test('current/future/invalid dates excluded and date arithmetic handles leap days', () => {
  const data = synthetic(6);
  data.checkIns.push({ date: '2026-09-19', complete: true, stress: 2 }, { date: '2026-09-20', complete: true, stress: 2 }, { date: '2026-02-30', complete: true, stress: 2 });
  assert.equal(analyzePatterns(data, { now }).completeDays, 6);
  assert.equal(localDateKey(new Date(2026, 8, 19, 0, 1)), '2026-09-19');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-03-31', 1), '2024-04-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(isDateKey('2026-02-29'), false);
});

test('demo has deterministic confirmed observations and a milk/bloating pattern', () => {
  const demo = getDemoData(now);
  assert.equal(demo.checkIns.length, 42);
  assert.deepEqual(demo, getDemoData(now));
  const milk = analyzePatterns(demo, { now }).patterns.find(item => item.ingredientId === 'milk' && item.symptomId === 'bloating');
  assert(milk && milk.riskDifference > 0.5);
});
