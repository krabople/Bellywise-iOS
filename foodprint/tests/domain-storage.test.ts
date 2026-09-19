import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDiary, parseDiary } from '../src/storage/schema';
import type { SavedDiary } from '../src/storage/schema';

function restored(modify: (state: SavedDiary) => void) {
  const state = emptyDiary();
  modify(state);
  return () => parseDiary(JSON.stringify(state));
}

test('food/drink distinction, raw label and tracking snapshots survive backup', () => {
  const state = emptyDiary();
  state.data.meals.push({ id: 'drink-1', name: 'Oat milk', kind: 'drink', source: 'label', eatenAt: '2026-09-18T12:00:00Z', ingredients: [{ id: 'oats', name: 'Oats', confidence: 'confirmed' }], labelText: 'Ingredients: water, oats (10%), salt.' });
  state.data.checkIns.push({ date: '2026-09-18', complete: true, stress: 2, trackedSymptomIds: ['bloating', 'energy'] });
  assert.deepEqual(parseDiary(JSON.stringify(state)), state);
});

test('malformed tracking snapshots, meal kind, and raw label rejected', () => {
  assert.throws(restored(state => state.data.checkIns.push({ date: '2026-09-18', complete: true, stress: 2, trackedSymptomIds: ['bloating', 'bloating'] })), /invalid check-in/);
  assert.throws(restored(state => state.data.checkIns.push({ date: '2026-09-18', complete: true, stress: 2, trackedSymptomIds: ['nonexistent'] })), /unknown tracked symptom/);
  for (const extra of [{ kind: 'other' }, { labelText: 123 }, { labelText: 'x'.repeat(40001) }]) {
    assert.throws(restored(state => state.data.meals.push({ id: 'm', name: 'Milk', ingredients: [], source: 'label', eatenAt: '2026-09-18T12:00:00Z', ...extra } as any)), /invalid food/);
  }
});

test('future instants, future check-ins and rolled 24:00 timestamps are rejected', () => {
  for (const eatenAt of [new Date(Date.now() + 3600000).toISOString(), '2026-09-18T24:00:00Z']) {
    assert.throws(restored(state => state.data.meals.push({ id: 'm', name: 'Rice', ingredients: [], source: 'typed', eatenAt })), /invalid food/);
  }
  assert.throws(restored(state => state.data.checkIns.push({ date: '2099-01-01', complete: true, stress: 2 })), /invalid check-in/);
});
