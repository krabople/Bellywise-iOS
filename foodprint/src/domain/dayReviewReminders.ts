import { addDays, localDateKey } from './dates';
import type { DayCheckIn } from './types';

export const DAY_REVIEW_PREFIX = 'bellywise-day-review:';
/** Date-specific alerts can be cancelled for one completed day, even with the app closed. */
export function plannedDayReviews(checkIns: DayCheckIn[], time: { hour: number; minute: number }, now = new Date(), days = 45) {
  const latest = new Map(checkIns.map(day => [day.date, day]));
  const complete = new Set([...latest.values()].filter(day => day.complete).map(day => day.date));
  const today = localDateKey(now);
  return Array.from({ length: days }, (_, i) => addDays(today, i)).flatMap(date => {
    const at = new Date(`${date}T00:00:00`);
    at.setHours(time.hour, time.minute, 0, 0);
    return complete.has(date) || at.getTime() <= now.getTime() ? [] : [{ date, at,
      id: `${DAY_REVIEW_PREFIX}${date}:${time.hour}:${time.minute}` }];
  });
}

export function isCompletedReviewNotification(payload: Record<string, unknown>, checkIns: DayCheckIn[], now = new Date()): boolean {
  if (payload.kind !== 'day-review-reminder') return false;
  const date = typeof payload.date === 'string' ? payload.date : localDateKey(now);
  return checkIns.filter(day => day.date === date).at(-1)?.complete === true;
}

export function reviewReminderChanges(plan: ReturnType<typeof plannedDayReviews>, scheduled: { identifier: string; kind?: unknown }[], legacyId?: string) {
  const wanted = new Set(plan.map(row => row.id));
  const owned = scheduled.filter(row => row.identifier.startsWith(DAY_REVIEW_PREFIX) || row.kind === 'day-review-reminder' || row.identifier === legacyId);
  const present = new Set(owned.map(row => row.identifier));
  return { cancel: owned.filter(row => !wanted.has(row.identifier)).map(row => row.identifier), add: plan.filter(row => !present.has(row.id)) };
}
