import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDiary, parseDiary, type SavedDiary } from '../src/storage/schema';

function parseModified(modify: (diary: SavedDiary) => void) {
  const diary = emptyDiary();
  modify(diary);
  return () => parseDiary(JSON.stringify(diary));
}

test('empty diary selects real built-in symptoms, including positive feelings', () => {
  const state = emptyDiary();
  assert.deepEqual(parseDiary(JSON.stringify(state)), state);
  assert.ok(state.selectedSymptoms.includes('energy'));
  assert.ok(state.selectedSymptoms.includes('comfortable'));
});

test('valid complete diary survives backup roundtrip', () => {
  const state = emptyDiary();
  state.data.customSymptoms.push({ id: 'custom-1', name: 'Rested', kind: 'positive' });
  state.data.customIngredients?.push({ id: 'personal-sunflower-lecithin', name: 'Sunflower lecithin', aliases: ['sunflower lecithin'] });
  state.selectedSymptoms.push('custom-1');
  state.data.meals.push({ id: 'm1', name: 'Rice', eatenAt: '2026-09-18T12:30:00.000Z', ingredients: [{ id: 'rice', name: 'Rice', confidence: 'confirmed' }], source: 'typed' });
  state.data.symptoms.push({ id: 's1', symptomId: 'custom-1', occurredAt: '2026-09-18T14:00:00+01:00', severity: 2 });
  state.data.checkIns.push({ date: '2024-02-29', complete: true, stress: 2, sleepHours: 7.5 });
  assert.deepEqual(parseDiary(JSON.stringify(state)), state);
});

test('accepts older backups without a personal ingredient catalogue', () => {
  const state = emptyDiary();
  delete state.data.customIngredients;
  assert.deepEqual(parseDiary(JSON.stringify(state)), state);
});

test('rejects invalid or duplicate personal ingredients', () => {
  assert.throws(parseModified(state => { state.data.customIngredients = [{ id: 'personal-one', name: '', aliases: [] }]; }), /invalid custom ingredient/);
  assert.throws(parseModified(state => { state.data.customIngredients = [{ id: 'personal-one', name: 'One', aliases: ['one'] }, { id: 'personal-one', name: 'Two', aliases: ['two'] }]; }), /duplicate custom ingredient IDs/);
});

test('notification choices survive backups and reject invalid times or duplicate pattern keys', () => {
  const state = emptyDiary();
  state.data.notificationPreferences = { foodRemindersEnabled: true, foodReminderTimes: [{ key: 'breakfast', hour: 8, minute: 15, notificationId: 'food-1' }, { key: 'dinner', hour: 19, minute: 45, notificationId: 'food-2' }], dayReviewReminderEnabled: true, dayReviewReminderHour: 21, dayReviewReminderMinute: 0, dayReviewReminderId: 'review-1', patternAlertsEnabled: true, notifiedPatternKeys: ['garlic|bloating'] };
  assert.deepEqual(parseDiary(JSON.stringify(state)), state);
  assert.throws(parseModified(value => { value.data.notificationPreferences = { ...state.data.notificationPreferences!, dayReviewReminderHour: 24 }; }), /invalid notification preferences/);
  assert.throws(parseModified(value => { value.data.notificationPreferences = { ...state.data.notificationPreferences!, notifiedPatternKeys: ['one', 'one'] }; }), /invalid notification preferences/);
  assert.throws(parseModified(value => { value.data.notificationPreferences = { ...state.data.notificationPreferences!, foodReminderTimes: [{ key: 'one', hour: 8, minute: 0 }, { key: 'one', hour: 12, minute: 0 }] }; }), /invalid notification preferences/);
});

test('accepts legacy notification settings and explicit symptom-free confirmation', () => {
  const state = emptyDiary();
  state.data.notificationPreferences = { dailyReminderEnabled: true, dailyReminderHour: 19, dailyReminderMinute: 45, dailyReminderId: 'legacy-1', patternAlertsEnabled: false, notifiedPatternKeys: [] } as any;
  state.data.checkIns.push({ date: '2026-09-20', complete: true, noSymptomsConfirmed: true, stress: 2 });
  assert.deepEqual(parseDiary(JSON.stringify(state)), state);
  assert.throws(parseModified(value => value.data.checkIns.push({ date: '2026-09-20', complete: true, noSymptomsConfirmed: 'yes' as any, stress: 2 })), /invalid check-in/);
});

test('rejects impossible calendar dates and duplicate daily check-ins', () => {
  assert.throws(parseModified(state => state.data.checkIns.push({ date: '2026-02-31', complete: true, stress: 2 })), /invalid check-in/);
  assert.throws(parseModified(state => state.data.checkIns.push({ date: '2026-02-01', complete: true, stress: 2 }, { date: '2026-02-01', complete: false, stress: 3 })), /same date/);
});

test('rejects ambiguous timestamps and invalid dates in food records', () => {
  for (const eatenAt of ['1', '2026-02-31T12:00:00Z', '2026-09-18T12:00:00']) {
    assert.throws(parseModified(state => state.data.meals.push({ id: 'm1', name: 'Rice', eatenAt, ingredients: [], source: 'typed' })), /invalid food/);
  }
});

test('rejects unknown symptom references and duplicate built-in IDs', () => {
  assert.throws(parseModified(state => state.selectedSymptoms.push('missing')), /unknown symptom/);
  assert.throws(parseModified(state => state.data.symptoms.push({ id: 's1', symptomId: 'missing', occurredAt: '2026-09-18T12:00:00Z', severity: 2 })), /unknown symptom/);
  assert.throws(parseModified(state => state.data.customSymptoms.push({ id: 'bloating', name: 'Different meaning', kind: 'positive' })), /existing symptom/);
});

test('rejects invalid confidence, severity and duplicate entry IDs', () => {
  assert.throws(parseModified(state => state.data.meals.push({ id: 'm1', name: 'Rice', eatenAt: '2026-09-18T12:00:00Z', ingredients: [{ id: 'rice', name: 'Rice', confidence: 'certain' as any }], source: 'typed' })), /invalid food/);
  assert.throws(parseModified(state => state.data.symptoms.push({ id: 's1', symptomId: 'bloating', occurredAt: '2026-09-18T12:00:00Z', severity: 6 as any })), /invalid symptom/);
  assert.throws(parseModified(state => state.data.customSymptoms.push({ id: 'c1', name: 'One', kind: 'negative' }, { id: 'c1', name: 'Two', kind: 'positive' })), /duplicate entry IDs/);
});
