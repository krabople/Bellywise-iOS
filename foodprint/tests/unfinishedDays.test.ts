import test from 'node:test';
import assert from 'node:assert/strict';
import { unfinishedDays, yesterdayNeedsReview } from '../src/domain/unfinishedDays';
import { emptyDiary, parseDiary } from '../src/storage/schema';
import { widgetRoute } from '../src/domain/widgetRoute';

test('past recorded days need a review, including symptoms-only and context-only days', () => {
  const { data } = emptyDiary();
  data.meals.push({ id: 'a', name: 'Toast', eatenAt: new Date('2026-09-30T12:00:00').toISOString(), source: 'typed', ingredients: [] });
  data.symptoms.push({ id: 's', symptomId: 'bloating', severity: 2, occurredAt: new Date('2026-09-29T12:00:00').toISOString() });
  data.checkIns.push({ date: '2026-09-28', stress: 3, complete: false });
  data.checkIns.push({ date: '2026-10-01', stress: 3, complete: false });
  data.checkIns.push({ date: '2026-10-02', stress: 3, complete: false });
  assert.deepEqual(unfinishedDays(data, '2026-10-01'), ['2026-09-30', '2026-09-29', '2026-09-28']);
  data.checkIns.push({ date: '2026-09-30', stress: 3, complete: true });
  assert.deepEqual(unfinishedDays(data, '2026-10-01'), ['2026-09-29', '2026-09-28']);
  data.checkIns.push({ date: '2026-09-30', stress: 3, complete: false });
  assert.equal(unfinishedDays(data, '2026-10-01')[0], '2026-09-30');
});

test('daily reminder is only for yesterday and does not repeat after a restart that day', () => {
  const diary = emptyDiary();
  assert.equal(yesterdayNeedsReview(diary.data, '2026-10-01'), undefined);
  diary.data.checkIns.push({ date: '2026-09-29', stress: 3, complete: false });
  assert.equal(yesterdayNeedsReview(diary.data, '2026-10-01'), undefined);
  diary.data.checkIns.push({ date: '2026-09-30', stress: 3, complete: false });
  assert.equal(yesterdayNeedsReview(diary.data, '2026-10-01'), '2026-09-30');
  diary.lastDailyReviewPromptDate = '2026-10-01';
  const restored = parseDiary(JSON.stringify(diary));
  assert.equal(yesterdayNeedsReview(restored.data, '2026-10-01', restored.lastDailyReviewPromptDate), undefined);
  diary.lastDailyReviewPromptDate = '2026-02-30';
  assert.throws(() => parseDiary(JSON.stringify(diary)), /reminder date/);
});

test('calendar day reminder handles month boundaries and finished days', () => {
  const { data } = emptyDiary();
  data.checkIns.push({ date: '2026-03-31', stress: 3, complete: false });
  assert.equal(yesterdayNeedsReview(data, '2026-04-01'), '2026-03-31');
  data.checkIns[0].complete = true;
  assert.equal(yesterdayNeedsReview(data, '2026-04-01'), undefined);
});

test('widget links open the matching form and ignore unsupported URLs', () => {
  assert.equal(widgetRoute('bellywise://quick-log/food'), 'meal');
  assert.equal(widgetRoute('bellywise://quick-log/feeling'), 'symptom');
  assert.equal(widgetRoute('bellywise://quick-log/review'), 'checkin');
  for (const url of ['https://quick-log/food', 'bellywise://quick-log/delete', 'bellywise://quick-log/food/other', 'bellywise://quick-log/food?date=old']) assert.equal(widgetRoute(url), undefined);
});
