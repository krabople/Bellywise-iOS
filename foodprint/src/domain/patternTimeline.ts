import { addDays, localDateKey } from './dates';
import { mealExposures } from './patternEvidence';
import type { AppData, PatternResult } from './types';

/** Raw diary timeline. Comparison eligibility and missingness remain enforced by analysis.ts. */
export function patternTimeline(pattern: PatternResult, data: AppData, now = new Date()) {
  const today = localDateKey(now);
  const completed = new Set(data.checkIns.filter(c => c.complete).map(c => c.date));
  const tracked = new Set(data.checkIns.filter(c => c.complete && c.trackedSymptomIds?.includes(pattern.symptomId)).map(c => c.date));
  const dates = new Set([...completed, ...data.meals.map(m => localDateKey(m.eatenAt)), ...data.symptoms.map(s => localDateKey(s.occurredAt))]);
  const exposures = data.meals.filter(m => mealExposures(m).some(i => i.id === pattern.ingredientId));
  return [...dates].filter(date => date < today && (pattern.window !== 'next-day' || addDays(date, 1) < today)).sort().slice(-42).map(date => {
    const times = exposures.filter(m => localDateKey(m.eatenAt) === date).map(m => Date.parse(m.eatenAt));
    const exposed = times.length > 0, symptomDate = pattern.window === 'next-day' ? addDays(date, 1) : date;
    const symptom = data.symptoms.some(s => s.symptomId === pattern.symptomId && localDateKey(s.occurredAt) === symptomDate && (pattern.window === 'next-day' || !exposed || Date.parse(s.occurredAt) >= Math.min(...times)));
    return { date, symptomDate, exposed, symptom, complete: completed.has(date) && tracked.has(symptomDate) };
  });
}
