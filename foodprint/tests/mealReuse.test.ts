import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey } from '../src/domain/dates';
import { copyMealItems, previousMeals } from '../src/domain/mealReuse';
import type { Meal } from '../src/domain/types';
import { emptyDiary, parseDiary } from '../src/storage/schema';

const now = new Date('2026-09-20T14:00:00');
const sourceTime = new Date('2026-09-19T20:00:00').toISOString();
const targetTime = new Date('2026-09-20T13:00:00');
const source = (id: string, extra: Partial<Meal> = {}): Meal => ({
  id, name: 'Lactose-free pasta sauce', kind: 'food', source: 'label', eatenAt: sourceTime,
  ingredients: [{ id: 'milk', name: 'Milk', confidence: 'confirmed', excludedComponents: ['lactose'] }, { id: 'milk-protein', name: 'Milk / dairy protein', confidence: 'inferred', derivedFrom: 'milk' }],
  excludedComponents: ['lactose'], labelText: 'Ingredients: lactose-free milk.', productCode: '12345678', notes: 'Half a jar\nProduct data: https://world.openfoodfacts.org/product/12345678',
  groupName: 'Dinner', groupId: `${localDateKey(sourceTime)}:Dinner`, ...extra,
});
const nextIds = () => { let count = 0; return () => `copy-${++count}`; };

test('log again retains exact reviewed ingredients and provenance with fresh entries and lunch time', () => {
  const original = source('sauce');
  const before = structuredClone(original);
  const [copy] = copyMealItems([original], targetTime, 'Lunch', nextIds(), now);
  assert.equal(copy.id, 'copy-1');
  assert.equal(copy.eatenAt, targetTime.toISOString());
  assert.equal(copy.groupId, `${localDateKey(targetTime)}:Lunch`);
  assert.equal(copy.groupName, 'Lunch');
  for (const field of ['name', 'kind', 'source', 'notes', 'labelText', 'productCode', 'ingredients', 'excludedComponents'] as const) assert.deepEqual(copy[field], original[field]);
  copy.ingredients[0].name = 'Changed';
  copy.ingredients[0].excludedComponents!.push('gluten');
  copy.excludedComponents!.push('gluten');
  copy.ingredients.push({ id: 'garlic', name: 'Garlic', confidence: 'confirmed' });
  assert.deepEqual(original, before);
});

test('previous meals include whole groups, separate reused group IDs on different days, and order by actual time', () => {
  const old = source('old', { eatenAt: new Date('2026-09-18T19:00:00').toISOString(), groupId: 'reused-id' });
  const sauce = source('sauce', { groupId: 'reused-id' });
  const pasta = source('pasta', { name: 'Spaghetti', groupId: 'reused-id', eatenAt: new Date('2026-09-19T19:58:00').toISOString() });
  const drink = source('drink', { name: 'Tea', kind: 'drink', groupId: 'reused-id', eatenAt: new Date('2026-09-19T20:02:00').toISOString() });
  const snack = source('snack', { name: 'Apple', groupId: undefined, groupName: undefined, eatenAt: '2026-09-20T10:00:00Z' });
  const input = [sauce, old, drink, snack, pasta];
  const before = input.map(item => item.id);
  const result = previousMeals(input);
  assert.equal(result.length, 3);
  assert.equal(result[0].name, 'Apple');
  assert.equal(result[1].name, 'Dinner');
  assert.deepEqual(result[1].items.map(item => item.id), ['pasta', 'sauce', 'drink']);
  assert.equal(result[1].eatenAt, drink.eatenAt);
  assert.deepEqual(result[2].items.map(item => item.id), ['old']);
  assert.notEqual(result[1].id, result[2].id);
  assert.deepEqual(input.map(item => item.id), before);
});

test('copying selected items excludes the unwanted drink and Ungrouped clears the old meal group', () => {
  const sauce = source('sauce');
  const pasta = source('pasta', { name: 'Spaghetti', source: 'typed', productCode: undefined, ingredients: [{ id: 'wheat', name: 'Wheat', confidence: 'inferred' }] });
  const copies = copyMealItems([sauce, pasta], targetTime, 'Ungrouped', nextIds(), now);
  assert.equal(copies.length, 2);
  assert.deepEqual(copies.map(item => item.id), ['copy-1', 'copy-2']);
  assert(copies.every(item => !Object.hasOwn(item, 'groupId') && !Object.hasOwn(item, 'groupName')));
  assert.equal(copies[1].ingredients[0].confidence, 'inferred');
});

test('previous meals sort instants correctly when imported timestamps have different UTC offsets', () => {
  const earlier = source('earlier', { groupId: undefined, eatenAt: '2026-09-19T13:00:00+02:00' });
  const later = source('later', { groupId: undefined, eatenAt: '2026-09-19T12:00:00Z' });
  assert.deepEqual(previousMeals([earlier, later]).map(group => group.items[0].id), ['later', 'earlier']);
});

test('copy dates use the destination local calendar day and reject invalid times or empty selection', () => {
  const midnight = new Date(2026, 8, 20, 0, 5);
  const [copy] = copyMealItems([source('sauce')], midnight, 'Lunch', nextIds(), now);
  assert.equal(copy.groupId, '2026-09-20:Lunch');
  assert.throws(() => copyMealItems([], targetTime, 'Lunch', nextIds(), now), /at least one/);
  assert.throws(() => copyMealItems([source('sauce')], new Date('invalid'), 'Lunch', nextIds(), now), /valid time/);
  assert.throws(() => copyMealItems([source('sauce')], new Date(now.getTime() + 1), 'Lunch', nextIds(), now), /valid time/);
  assert.throws(() => copyMealItems([source('sauce')], targetTime, 'Lunch', () => 'sauce', now), /separate IDs/);
  assert.throws(() => copyMealItems([source('sauce'), source('pasta')], targetTime, 'Lunch', () => 'copy', now), /separate IDs/);
});

test('source and copied meals coexist in a valid diary backup', () => {
  const original = source('sauce');
  const saved = emptyDiary();
  saved.data.meals = [original, ...copyMealItems([original], targetTime, 'Lunch', nextIds(), now)];
  assert.deepEqual(parseDiary(JSON.stringify(saved)), saved);
});
