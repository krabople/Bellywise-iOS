import { addDays, localDateKey } from './dates';
import type { AppData } from './types';

/** Empty dates and the current day are not overdue reviews. Last review wins. */
export function unfinishedDays(data: AppData, today = localDateKey(new Date())): string[] {
  const reviews = new Map(data.checkIns.map(review => [review.date, review.complete]));
  const dates = new Set([
    ...data.meals.map(meal => localDateKey(meal.eatenAt)),
    ...data.symptoms.map(symptom => localDateKey(symptom.occurredAt)),
    ...data.checkIns.map(review => review.date),
  ]);
  return [...dates].filter(date => date && date < today && !reviews.get(date)).sort().reverse();
}

export function yesterdayNeedsReview(data: AppData, today: string, lastPromptDate?: string): string | undefined {
  if (lastPromptDate === today) return undefined;
  const yesterday = addDays(today, -1);
  return unfinishedDays(data, today).includes(yesterday) ? yesterday : undefined;
}
