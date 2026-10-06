import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePatterns } from '../src/domain/analysis';
import { comparisonExclusionExplanation } from '../src/domain/comparisonDays';
import { BUILT_IN_SYMPTOMS } from '../src/domain/symptoms';
import type { AppData, PatternResult } from '../src/domain/types';

const feeling = BUILT_IN_SYMPTOMS.find(s => s.kind === 'negative')!.id;
const now = new Date('2026-09-10T12:00:00');
const date = (day: number) => `2026-09-${String(day).padStart(2, '0')}`;
function diary(): AppData {
  return {
    meals: Array.from({ length: 8 }, (_, index) => ({ id: `meal-${index + 1}`, name: 'Lunch', eatenAt: `${date(index + 1)}T12:00:00`, source: 'typed' as const,
      ingredients: index < 2 ? [{ id: 'pork', name: 'Pork', confidence: 'confirmed' as const }, { id: 'yeast-extract', name: 'Yeast extract', confidence: 'confirmed' as const }]
        : index < 4 ? [{ id: 'yeast-extract', name: 'Yeast extract', confidence: 'inferred' as const }]
        : [{ id: 'rice', name: 'Rice', confidence: 'confirmed' as const }] })),
    symptoms: [1, 2].map(day => ({ id: `feeling-${day}`, symptomId: feeling, occurredAt: `${date(day)}T18:00:00`, severity: 3 as const })),
    checkIns: Array.from({ length: 8 }, (_, index) => ({ date: date(index + 1), complete: true, trackedSymptomIds: [feeling], stress: 2 as const })),
    customSymptoms: [],
  };
}
function verifyCounts(pattern: PatternResult) {
  const used = pattern.comparisonDays!.filter(day => day.included);
  assert.equal(used.filter(day => day.exposed).length, pattern.exposedDays);
  assert.equal(used.filter(day => !day.exposed).length, pattern.unexposedDays);
  assert.equal(used.filter(day => day.exposed && day.symptom).length, pattern.exposedSymptomDays);
  assert.equal(used.filter(day => !day.exposed && day.symptom).length, pattern.unexposedSymptomDays);
  assert.ok(used.every(day => day.reasons.length === 0));
  assert.ok(pattern.comparisonDays!.filter(day => !day.included).every(day => day.reasons.length > 0));
}

test('explains the exact six-versus-eight-day example without counting uncertain food as absent', () => {
  const result = analyzePatterns(diary(), { now, window: 'same-day', includeInferred: false });
  const yeast = result.patterns.find(p => p.ingredientId === 'yeast-extract')!;
  const pork = result.patterns.find(p => p.ingredientId === 'pork')!;
  assert.deepEqual([yeast.exposedSymptomDays, yeast.exposedDays, yeast.unexposedSymptomDays, yeast.unexposedDays], [2, 2, 0, 4]);
  assert.deepEqual([pork.exposedSymptomDays, pork.exposedDays, pork.unexposedSymptomDays, pork.unexposedDays], [2, 2, 0, 6]);
  assert.deepEqual(yeast.comparisonDays!.filter(day => !day.included).map(day => [day.date, day.reasons]), [[date(3), ['ingredient-unconfirmed']], [date(4), ['ingredient-unconfirmed']]]);
  assert.equal(pork.comparisonDays!.filter(day => !day.included).length, 0);
  result.patterns.forEach(verifyCounts);
});

test('following-day comparisons identify missing dates and still-in-progress outcome days', () => {
  const data = diary();
  data.meals[7].eatenAt = '2026-09-09T12:00:00';
  data.checkIns[7].date = '2026-09-09';
  data.symptoms = [2, 3].map(day => ({ id: `feeling-${day}`, symptomId: feeling, occurredAt: `${date(day)}T18:00:00`, severity: 3 }));
  const patterns = analyzePatterns(data, { now, window: 'next-day' }).patterns;
  const pork = patterns.find(p => p.ingredientId === 'pork')!;
  assert.deepEqual(pork.comparisonDays!.find(day => day.date === date(7))?.reasons, ['missing-following-day']);
  assert.deepEqual(pork.comparisonDays!.find(day => day.date === date(9))?.reasons, ['following-day-not-finished']);
  assert.equal(pork.comparisonDays!.find(day => day.date === date(1))?.symptomDate, date(2));
  patterns.forEach(verifyCounts);
});

test('distinguishes unknown symptom absence, unfinished ingredient absence and unresolved meals', () => {
  const data = diary();
  data.checkIns[2].trackedSymptomIds = [];
  data.checkIns[3].complete = false;
  data.symptoms.push({ id: 'feeling-4', symptomId: feeling, occurredAt: `${date(4)}T18:00:00`, severity: 3 });
  data.meals[4].ingredients = [];
  const pork = analyzePatterns(data, { now, window: 'same-day' }).patterns.find(p => p.ingredientId === 'pork')!;
  assert.deepEqual(pork.comparisonDays!.find(day => day.date === date(3))?.reasons, ['feeling-unconfirmed']);
  assert.deepEqual(pork.comparisonDays!.find(day => day.date === date(4))?.reasons, ['food-day-unfinished']);
  assert.deepEqual(pork.comparisonDays!.find(day => day.date === date(5))?.reasons, ['unresolved-food-day']);
  verifyCounts(pork);
});

test('time-order exclusions are explained while unfinished explicitly logged matches still count', () => {
  const data = diary();
  data.checkIns[0].complete = false;
  data.checkIns[2].complete = false;
  data.meals[2].ingredients = [{ id: 'pork', name: 'Pork', confidence: 'confirmed' }];
  data.symptoms.push({ id: 'early', symptomId: feeling, occurredAt: `${date(3)}T09:00:00`, severity: 3 });
  const pork = analyzePatterns(data, { now, window: 'same-day' }).patterns.find(p => p.ingredientId === 'pork')!;
  assert.equal(pork.comparisonDays!.find(day => day.date === date(1))?.included, true);
  assert.deepEqual(pork.comparisonDays!.find(day => day.date === date(3))?.reasons, ['feeling-before-food-unreviewed']);
  assert.match(comparisonExclusionExplanation('feeling-before-food-unreviewed', pork), /before Pork was eaten/);
  verifyCounts(pork);
});
