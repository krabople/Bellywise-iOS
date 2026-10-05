import test from 'node:test';
import assert from 'node:assert/strict';
import { plannedDayReviews, reviewReminderChanges, isCompletedReviewNotification } from '../src/domain/dayReviewReminders';
import { notificationRoute } from '../src/domain/notificationRoute';
import type { DayCheckIn } from '../src/domain/types';

const time = { hour: 20, minute: 30 }, now = new Date('2026-10-05T12:00:00');
const complete: DayCheckIn = { date: '2026-10-05', complete: true, stress: 2 };
test('completing today cancels only its date-specific alert while food and future reviews remain', () => {
  const original = plannedDayReviews([], time, now);
  const remaining = plannedDayReviews([complete], time, now);
  assert.equal(original.length, 45); assert.equal(remaining.length, 44);
  const changes = reviewReminderChanges(remaining, [...original.map(row => ({ identifier: row.id, kind: 'day-review-reminder' })), { identifier: 'food-1', kind: 'food-reminder' }]);
  assert.deepEqual(changes.cancel, [original[0].id]); assert.deepEqual(changes.add, []);
  assert.ok(!remaining.some(row => row.date === complete.date));
});
test('an unfinished review still gets its reminder; undoing completion restores only future alerts', () => {
  const unfinished = { ...complete, complete: false };
  assert.equal(plannedDayReviews([unfinished], time, now)[0].date, complete.date);
  assert.equal(plannedDayReviews([complete, unfinished], time, now)[0].date, complete.date);
  const changes = reviewReminderChanges(plannedDayReviews([], time, now), plannedDayReviews([complete], time, now).map(row => ({ identifier: row.id })));
  assert.equal(changes.add.length, 1);
  assert.equal(changes.add[0].date, complete.date);
  assert.equal(plannedDayReviews([], time, new Date('2026-10-05T21:00:00'))[0].date, '2026-10-06');
});
test('turning review reminders off cancels legacy repeats and one-offs without cancelling food reminders', () => {
  const row = plannedDayReviews([], time, now)[0];
  const changes = reviewReminderChanges([], [{ identifier: row.id }, { identifier: 'legacy-review', kind: 'day-review-reminder' }, { identifier: 'food', kind: 'food-reminder' }]);
  assert.deepEqual(changes.cancel, [row.id, 'legacy-review']); assert.deepEqual(changes.add, []);
});
test('changing reminder time replaces dates and reminders retain local clock time across British DST', () => {
  const previous = plannedDayReviews([], time, now);
  const changed = plannedDayReviews([], { hour: 22, minute: 5 }, now);
  const diff = reviewReminderChanges(changed, previous.map(row => ({ identifier: row.id })));
  assert.equal(diff.cancel.length, 45); assert.equal(diff.add.length, 45);
  assert.ok(changed.every(row => row.at.getHours() === 22 && row.at.getMinutes() === 5));
});
test('notification display and taps use their own date, including delayed yesterday alerts', () => {
  assert.equal(isCompletedReviewNotification({ kind: 'day-review-reminder', date: complete.date }, [complete]), true);
  assert.equal(isCompletedReviewNotification({ kind: 'food-reminder' }, [complete], now), false);
  assert.equal(isCompletedReviewNotification({ kind: 'day-review-reminder', date: '2026-10-06' }, [complete]), false);
  assert.equal(isCompletedReviewNotification({ kind: 'day-review-reminder' }, [complete], now), true);
  assert.deepEqual(notificationRoute({ kind: 'day-review-reminder', date: '2026-10-04' }), { screen: 'checkin', date: '2026-10-04' });
  assert.deepEqual(notificationRoute({ kind: 'day-review-reminder' }), { screen: 'checkin' });
});
