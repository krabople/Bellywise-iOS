import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePatterns, addDays, ingredientsFromNames, localDateKey } from '../src/domain';
import { compareOrdinalRatings } from '../src/domain/statistics';
import type { AppData, Level } from '../src/domain/types';

const now = new Date(2026, 8, 19, 12);
function diary(count = 42, following = false): AppData {
  const data: AppData = { meals: [], symptoms: [], checkIns: [], customSymptoms: [] };
  for (let i = 0; i < count + (following ? 1 : 0); i++) {
    const date = addDays('2026-07-01', i);
    data.checkIns.push({ date, complete: true, stress: 2, sleepHours: 8, trackedSymptomIds: ['bloating', 'energy'] });
    if (i === count) continue;
    data.meals.push({ id: `meal-${i}`, name: i % 2 ? 'Rice' : 'Milk', source: 'typed', eatenAt: new Date(`${date}T08:00:00`).toISOString(), ingredients: ingredientsFromNames([i % 2 ? 'rice' : 'milk']) });
    data.symptoms.push({ id: `feeling-${i}`, symptomId: 'bloating', severity: i % 2 ? 1 : 4, occurredAt: new Date(`${following ? addDays(date, 1) : date}T12:00:00`).toISOString() });
  }
  return data;
}
const milk = (data: AppData, window: 'same-day' | 'next-day' = 'same-day') => analyzePatterns(data, { now, window }).patterns.find(p => p.ingredientId === 'milk');

test('equal frequency but stronger symptoms produces a severity-only pattern', () => {
  const p = milk(diary())!;
  assert(p);
  assert.equal(p.riskDifference, 0);
  assert.equal(p.signal, 'severity');
  assert.equal(p.status, 'emerging');
  assert.notEqual(p.frequencyStatus, 'emerging');
  assert.equal(p.severity?.exposedAverage, 4);
  assert.equal(p.severity?.unexposedAverage, 1);
  assert.equal(p.severity?.exposedDays, 21);
  assert.equal(p.severity?.unexposedDays, 21);
  assert(p.severity!.adjustedPValue < .05);
  assert(p.summary.includes('4.0/5') && p.summary.includes('1.0/5'));
});

test('equal ratings and frequency do not create a severity pattern', () => {
  const data = diary();data.symptoms.forEach(s => s.severity = 3);
  assert.equal(milk(data), undefined);
});

test('frequency and intensity can both support a pattern without conflating their tests', () => {
  const data = diary();data.symptoms = data.symptoms.filter((_, i) => i % 2 === 0 || i % 6 === 1);
  const p = milk(data)!;
  assert.equal(p.signal, 'both');
  assert.equal(p.frequencyStatus, 'emerging');
  assert.equal(p.severity?.status, 'emerging');
  assert.equal(p.severity?.unexposedDays, 7);
  assert(p.adjustedPValue >= p.pValue && p.severity!.adjustedPValue >= p.severity!.pValue);
});

test('strongest daily rating is used, not an average of individual logs or extra observations', () => {
  const data = diary(), baseline = milk(data)!;
  data.symptoms.push({ ...data.symptoms[0], id: 'duplicate' }, { ...data.symptoms[0], id: 'milder-later', severity: 1 });
  assert.deepEqual(milk(data), baseline);
  data.symptoms.push({ ...data.symptoms[0], id: 'stronger-later', severity: 5 });
  const p = milk(data)!;
  assert.equal(p.severity!.exposedDays, 21);
  assert(Math.abs(p.severity!.exposedAverage! - 85 / 21) < 1e-12);
});

test('a high rating before the food cannot strengthen its same-day intensity pattern', () => {
  const data = diary(), baseline = milk(data)!;
  data.symptoms.push({ ...data.symptoms[0], id: 'before-food', severity: 5, occurredAt: new Date('2026-07-01T07:00:00').toISOString() });
  const after = milk(data)!;
  assert.equal(after.severity!.exposedAverage, baseline.severity!.exposedAverage);
  assert.equal(after.severity!.exposedDays, baseline.severity!.exposedDays);
  assert.equal(after.severity!.pValue, baseline.severity!.pValue);
  // Other ingredients may use this event, legitimately changing the joint correction.
  data.symptoms.filter((_, i) => i % 2 === 0).forEach(s => { s.occurredAt = new Date(`${localDateKey(s.occurredAt)}T07:00:00`).toISOString(); });
  assert.equal(milk(data), undefined);
});

test('next-day intensity compares the following day rather than the food day', () => {
  const p = milk(diary(42, true), 'next-day')!;
  assert.equal(p.severity?.exposedAverage, 4);
  assert.equal(p.severity?.unexposedAverage, 1);
  assert.equal(p.status, 'emerging');
  assert(p.summary.includes('following day'));
});

test('symptom-free days do not acquire invented zero ratings', () => {
  const data = diary();data.symptoms = data.symptoms.filter((_, i) => i % 2 === 0);
  const p = milk(data)!;
  assert.equal(p.signal, 'frequency');
  assert.equal(p.status, 'emerging');
  assert.equal(p.severity?.unexposedDays, 0);
  assert.equal(p.severity?.unexposedAverage, undefined);
  assert.equal(p.severity?.difference, undefined);
});

test('missing or invalid ratings remain missing while occurrence is retained', () => {
  const data = diary();
  data.symptoms.forEach((s, i) => { if (i % 2) s.severity = undefined as unknown as Level; });
  assert.equal(milk(data), undefined, 'equal occurrence cannot become a severity pattern with missing control ratings');
  data.symptoms = data.symptoms.filter((_, i) => i % 2 === 0 || i % 6 === 1);
  const p = milk(data)!;
  assert.equal(p.unexposedSymptomDays, 7);
  assert.equal(p.severity?.unexposedDays, 0);
});

test('unfinished explicit events are descriptive evidence but cannot pass the stronger checks', () => {
  const data = diary(); data.checkIns.forEach((c, i) => { if (i % 2 === 0) c.complete = false; });
  const p = milk(data)!;
  assert.equal(p.severity?.exposedDays, 21);
  assert.equal(p.severity?.completeExposedDays, 0);
  assert.notEqual(p.status, 'emerging');
  data.checkIns = [];
  assert.equal(milk(data), undefined, 'unfinished days cannot supply ingredient-absence controls');
});

test('few ratings or inferred exposure cannot earn a stronger severity label', () => {
  const sparse = milk(diary(8))!;
  assert(sparse);
  assert.equal(sparse.status, 'not-enough-data');
  const data = diary();data.meals.forEach(m => m.ingredients.forEach(i => i.confidence = 'inferred'));
  assert.notEqual(milk(data)!.status, 'emerging');
});

test('stress or sleep imbalance prevents a stronger intensity label', () => {
  for (const context of ['stress', 'sleep'] as const) {
    const data = diary();data.checkIns.forEach((c, i) => { if (i % 2 === 0) { if (context === 'stress') c.stress = 5; else c.sleepHours = 4; } });
    assert.equal(milk(data)!.status, 'exploratory');
  }
});

test('an intensity link that disappears on lower-stress or rested days is flagged even with equal context coverage', () => {
  for (const context of ['stress', 'sleep'] as const) {
    const data = diary();
    data.checkIns.forEach((c, i) => { if (context === 'stress') c.stress = i % 4 < 2 ? 5 : 2; else c.sleepHours = i % 4 < 2 ? 5 : 8; });
    data.symptoms.forEach((s, i) => s.severity = i % 4 === 0 ? 5 : 1);
    const p = milk(data)!;
    assert.equal(p.status, 'exploratory');
    assert(p.cautions.some(c => c.includes('intensity difference')));
    assert.equal(context === 'stress' ? p.severity?.lowStressDifference : p.severity?.restedDifference, 0);
  }
});

test('positive feeling strength is analysed separately from negative symptom severity', () => {
  const data = diary();data.symptoms.forEach(s => s.symptomId = 'energy');
  const p = milk(data)!;
  assert.equal(p.symptomKind, 'positive');
  assert.equal(p.signal, 'severity');
  assert.equal(p.status, 'emerging');
});

test('plain water remains excluded even if ratings track it perfectly', () => {
  const data = diary();data.meals.forEach((m, i) => m.ingredients = ingredientsFromNames([i % 2 ? 'rice' : 'water']));
  assert(!analyzePatterns(data, { now }).patterns.some(p => p.ingredientId === 'water'));
});

// Independent brute force over individual label assignments, not the grouped-count algorithm.
function bruteRank(x: number[], y: number[]) {
  const pooled = [...x, ...y];
  const ranks = pooled.map(v => 1 + pooled.filter(w => w < v).length + (pooled.filter(w => w === v).length - 1) / 2);
  const expected = x.length * (pooled.length + 1) / 2;
  const observed = Math.abs(ranks.slice(0, x.length).reduce((a, b) => a + b, 0) - expected);
  let all = 0, extreme = 0;
  function visit(index: number, selected: number, sum: number) {
    if (index === pooled.length) { if (selected === x.length) { all++; if (Math.abs(sum - expected) >= observed - 1e-9) extreme++; } return; }
    visit(index + 1, selected, sum);
    if (selected < x.length) visit(index + 1, selected + 1, sum + ranks[index]);
  }
  visit(0, 0, 0);
  return extreme / all;
}
test('exact ordinal tests include ties and match independent permutation enumeration', () => {
  for (const [x, y] of [[[5, 5, 5], [1, 1, 1]], [[1, 2, 3], [3, 4, 5]], [[2, 2, 3], [1, 2, 4]], [[2, 2], [2, 2]], [[1, 4], [2, 2, 3, 5]]]) {
    const result = compareOrdinalRatings(x, y);
    assert(Math.abs(result.pValue - bruteRank(x, y)) < 1e-12);
    const pairWins = x.flatMap(a => y.map(b => a > b ? 1 : a === b ? .5 : 0)).reduce<number>((a, b) => a + b, 0) / (x.length * y.length);
    assert.equal(result.probabilityOfHigher, pairWins);
    assert(Math.abs(compareOrdinalRatings(y, x).pValue - result.pValue) < 1e-12);
  }
});

test('large tied samples remain symmetric and insufficient asymmetric samples cannot pass', () => {
  const x = Array(21).fill(4), y = Array(21).fill(1);
  assert(compareOrdinalRatings(x, y).pValue < .00001);
  assert.equal(compareOrdinalRatings(x, y).pValue, compareOrdinalRatings(y, x).pValue);
  assert.equal(compareOrdinalRatings([5], Array(42).fill(1)).pValue, 1);
  assert.equal(compareOrdinalRatings(Array(21).fill(3), Array(21).fill(3)).pValue, 1);
  assert.throws(() => compareOrdinalRatings([0], [1]), RangeError);
});
