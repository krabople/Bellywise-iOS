import { addDays, isDateKey, localDateKey } from './dates';
import { ingredientCatalog } from './foods';
import { benjaminiHochberg, differenceInterval, fisherExact } from './statistics';
import { BUILT_IN_SYMPTOMS } from './symptoms';
import { AnalysisResult, AppData, DayCheckIn, ExposureWindow, PatternResult } from './types';

export const MINIMUM_COMPLETE_DAYS = 14;
export const MINIMUM_COMPARISON_DAYS = 6;
interface Day {
  date: string;
  checkIn: DayCheckIn;
  ingredients: Map<string, { name: string; confirmed: boolean }>;
  symptoms: Set<string>;
  firstExposure: Map<string, number>;
  firstSymptom: Map<string, number>;
  unresolvedMeal: boolean;
}
interface Observation { date: string; exposed: boolean; confirmed: boolean; outcome: boolean; stress: number }

const pct = (value: number) => `${Math.round(value * 100)}%`;
const difference = (rows: Observation[]) => {
  const exposed = rows.filter(row => row.exposed), unexposed = rows.filter(row => !row.exposed);
  return exposed.length && unexposed.length
    ? exposed.filter(row => row.outcome).length / exposed.length - unexposed.filter(row => row.outcome).length / unexposed.length
    : undefined;
};

/** Analyze daily observations only; logging the same symptom repeatedly cannot inflate n. */
export function analyzePatterns(data: AppData, options: { now?: Date; window?: ExposureWindow; includeInferred?: boolean } = {}): AnalysisResult {
  const today = localDateKey(options.now ?? new Date());
  const days = new Map<string, Day>();
  // Last check-in wins, including an explicit reversal to incomplete.
  const checkIns = new Map(data.checkIns.map(checkIn => [checkIn.date, checkIn]));
  for (const checkIn of checkIns.values()) {
    if (checkIn.complete && isDateKey(checkIn.date) && checkIn.date < today) days.set(checkIn.date, { date: checkIn.date, checkIn, ingredients: new Map(), symptoms: new Set(), firstExposure: new Map(), firstSymptom: new Map(), unresolvedMeal: false });
  }
  for (const meal of data.meals) {
    const day = days.get(localDateKey(meal.eatenAt));
    if (!day) continue;
    if (!meal.ingredients.length || meal.ingredients.some(item => item.confidence === 'inferred' && item.id.startsWith('custom-'))) day.unresolvedMeal = true;
    for (const ingredient of meal.ingredients) {
      if (!ingredient.id) continue;
      const previous = day.ingredients.get(ingredient.id);
      day.ingredients.set(ingredient.id, { name: ingredient.name, confirmed: ingredient.confidence === 'confirmed' || Boolean(previous?.confirmed) });
      day.firstExposure.set(ingredient.id, Math.min(day.firstExposure.get(ingredient.id) ?? Infinity, Date.parse(meal.eatenAt)));
    }
  }
  for (const symptom of data.symptoms) {
    const day = days.get(localDateKey(symptom.occurredAt));
    if (!day) continue;
    day.symptoms.add(symptom.symptomId);
    day.firstSymptom.set(symptom.symptomId, Math.min(day.firstSymptom.get(symptom.symptomId) ?? Infinity, Date.parse(symptom.occurredAt)));
  }
  const ordered = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const definitions = new Map([...BUILT_IN_SYMPTOMS, ...data.customSymptoms].map(symptom => [symptom.id, symptom]));
  // Positive feelings are separate outcomes and never stand in for symptom-free days.
  const symptomIds = [...new Set(ordered.flatMap(day => [...day.symptoms]))].filter(id => definitions.has(id));
  const ingredientIds = [...new Set(ordered.flatMap(day => [...day.ingredients.keys()]))];
  const names = new Map(ingredientCatalog.map(item => [item.id, item.name]));
  for (const day of ordered) for (const [id, value] of day.ingredients) names.set(id, value.name);
  const rows: PatternResult[] = [];
  const windows: ExposureWindow[] = options.window ? [options.window] : ['same-day', 'next-day'];
  const details = new Map<string, { enough: boolean; repeated: boolean; confounded: boolean; orderingSupported: boolean; confirmedDifference?: number }>();

  for (const ingredientId of ingredientIds) for (const symptomId of symptomIds) for (const window of windows) {
    const observations: Observation[] = ordered.flatMap(day => {
      const outcomeDay = window === 'same-day' ? day : days.get(addDays(day.date, 1));
      if (!outcomeDay || day.unresolvedMeal || outcomeDay.unresolvedMeal) return [];
      // A new/custom symptom must not manufacture historical symptom-free controls.
      if (!outcomeDay.checkIn.trackedSymptomIds?.includes(symptomId)) return [];
      const exposure = day.ingredients.get(ingredientId);
      // An uncertain exposure cannot become an unexposed control in confirmed-only mode.
      if (options.includeInferred === false && exposure && !exposure.confirmed) return [];
      return [{ date: day.date, exposed: Boolean(exposure), confirmed: Boolean(exposure?.confirmed), outcome: outcomeDay.symptoms.has(symptomId), stress: outcomeDay.checkIn.stress }];
    });
    const exposed = observations.filter(row => row.exposed), unexposed = observations.filter(row => !row.exposed);
    // Still include sparse hypotheses in correction; do not select tests by their outcomes.
    if (!exposed.length || !unexposed.length) continue;
    const a = exposed.filter(row => row.outcome).length, c = unexposed.filter(row => row.outcome).length;
    const confirmedExposedDays = exposed.filter(row => row.confirmed).length;
    const exposedRate = a / exposed.length, unexposedRate = c / unexposed.length, riskDifference = exposedRate - unexposedRate;
    const interval = differenceInterval(a, exposed.length, c, unexposed.length);
    const lowStress = observations.filter(row => row.stress <= 3);
    const lowStressRiskDifference = lowStress.filter(row => row.exposed).length >= 3 && lowStress.filter(row => !row.exposed).length >= 3 ? difference(lowStress) : undefined;
    const stressDifference = exposed.filter(row => row.stress >= 4).length / exposed.length - unexposed.filter(row => row.stress >= 4).length / unexposed.length;
    const confounded = Math.abs(stressDifference) >= 0.3 || (lowStressRiskDifference !== undefined && riskDifference - lowStressRiskDifference >= 0.2);
    const confirmedDifference = difference(observations.filter(row => !row.exposed || row.confirmed));
    const reversedDays = window === 'same-day' ? exposed.filter(row => row.outcome && (days.get(row.date)?.firstSymptom.get(symptomId) ?? Infinity) < (days.get(row.date)?.firstExposure.get(ingredientId) ?? Infinity)).length : 0;
    const orderingSupported = reversedDays === 0;
    const coOccursWith = ingredientIds.filter(otherId => {
      if (otherId === ingredientId) return false;
      const either = observations.filter(row => row.exposed || days.get(row.date)?.ingredients.has(otherId));
      const both = observations.filter(row => row.exposed && days.get(row.date)?.ingredients.has(otherId));
      return both.length >= 3 && either.length > 0 && both.length / either.length >= 0.8;
    }).map(id => names.get(id) ?? id);
    let exposureRuns = 0;
    let previousExposed = false;
    for (const row of observations) {
      if (row.exposed && !previousExposed) exposureRuns++;
      previousExposed = row.exposed;
    }
    const repeated = exposureRuns >= 3;
    const enough = observations.length >= MINIMUM_COMPLETE_DAYS && exposed.length >= MINIMUM_COMPARISON_DAYS && unexposed.length >= MINIMUM_COMPARISON_DAYS;
    const symptom = definitions.get(symptomId)!;
    const ingredientName = names.get(ingredientId) ?? ingredientId;
    const id = `${ingredientId}:${symptomId}:${window}`;
    const cautions = ['An association cannot establish an intolerance or cause. Other foods, timing, illness, medication and menstrual changes can affect symptoms.'];
    if (ordered.some(day => day.unresolvedMeal)) cautions.push('Days containing unresolved meal names or meals with no ingredients are excluded. Review those entries so hidden ingredients are not treated as absent.');
    if (!enough) cautions.push(`Keep logging: this comparison needs at least ${MINIMUM_COMPLETE_DAYS} complete days, including ${MINIMUM_COMPARISON_DAYS} with and ${MINIMUM_COMPARISON_DAYS} without this ingredient.`);
    if (confirmedExposedDays < exposed.length) cautions.push(`${exposed.length - confirmedExposedDays} exposure days use only inferred recipe ingredients. Confirm the actual label or recipe to improve this comparison.`);
    if (coOccursWith.length) cautions.push(`Usually logged together with ${coOccursWith.slice(0, 4).join(', ')}. These entries cannot separate their individual contributions.`);
    if (confounded) cautions.push('Stress differs between the comparison groups, or the pattern weakens on lower-stress days. This may explain part of the association.');
    if (lowStressRiskDifference === undefined) cautions.push('There are not enough lower-stress days in both groups to check whether the pattern persists with similar stress.');
    if (!repeated) cautions.push('Exposure is concentrated in fewer than three separate runs of days. A change over time could explain the pattern.');
    if (window === 'same-day') cautions.push('Same-day analysis measures calendar-day co-occurrence; it does not prove the food came before the symptom.');
    else cautions.push('Next-day analysis compares consecutive calendar days, not a fixed number of hours. Foods eaten on the symptom day may also contribute.');
    if (reversedDays) cautions.push(`On ${reversedDays} exposed symptom day${reversedDays === 1 ? '' : 's'}, this feeling was logged before the first recorded ingredient exposure. The same-day comparison stays exploratory because the timing does not consistently support a food-then-feeling sequence.`);
    rows.push({
      id, ingredientId, ingredientName, symptomId, symptomName: symptom.name, symptomKind: symptom.kind,
      window, windowLabel: window === 'same-day' ? 'Same calendar day' : 'Following calendar day',
      exposedDays: exposed.length, unexposedDays: unexposed.length, exposedSymptomDays: a, unexposedSymptomDays: c,
      exposedRate, unexposedRate, riskDifference, interval,
      pValue: fisherExact(a, exposed.length - a, c, unexposed.length - c), adjustedPValue: 1,
      status: enough ? 'exploratory' : 'not-enough-data',
      headline: `${ingredientName} & ${symptom.name.toLowerCase()}`,
      summary: `${symptom.name} was logged on ${pct(exposedRate)} of days with ${ingredientName.toLowerCase()} and ${pct(unexposedRate)} of days without it${window === 'next-day' ? ', looking at the following day' : ''}.`,
      cautions, coOccursWith, inferredFraction: 1 - confirmedExposedDays / exposed.length, confirmedExposedDays, lowStressRiskDifference,
    });
    details.set(id, { enough, repeated, confounded, orderingSupported, confirmedDifference });
  }
  const adjusted = benjaminiHochberg(rows.map(row => row.pValue));
  rows.forEach((row, index) => {
    row.adjustedPValue = adjusted[index];
    const detail = details.get(row.id)!;
    if (detail.enough && detail.repeated && detail.orderingSupported && !detail.confounded && row.confirmedExposedDays >= MINIMUM_COMPARISON_DAYS && row.riskDifference >= 0.2 && row.interval[0] > 0 && row.adjustedPValue <= 0.05 && (detail.confirmedDifference ?? 0) >= 0.2) row.status = 'emerging';
  });
  // Correction happens before window selection or display filtering.
  const best = new Map<string, PatternResult>();
  const rank = (row: PatternResult) => (row.status === 'emerging' ? 4 : row.status === 'exploratory' ? 2 : 0) + Math.max(0, row.riskDifference) + (1 - row.adjustedPValue) * 0.1;
  for (const row of rows) {
    const key = `${row.ingredientId}:${row.symptomId}`, previous = best.get(key);
    if (!previous || rank(row) > rank(previous)) best.set(key, row);
  }
  // Decreased negative symptoms are not promoted as evidence that a food is protective.
  const patterns = [...best.values()].filter(row => row.riskDifference > 0 && row.exposedSymptomDays >= 2).sort((a, b) => rank(b) - rank(a));
  const completeDays = ordered.length;
  const legacyDays = ordered.filter(day => !day.checkIn.trackedSymptomIds).length;
  return {
    patterns, completeDays, minimumDays: MINIMUM_COMPLETE_DAYS,
    message: legacyDays > 0 ? `${legacyDays} complete day${legacyDays === 1 ? '' : 's'} need${legacyDays === 1 ? 's' : ''} review of which feelings were tracked. Re-save those daily check-ins to use them in patterns. A feeling that was not tracked never counts as absent.` : completeDays < MINIMUM_COMPLETE_DAYS
      ? `${completeDays} of ${MINIMUM_COMPLETE_DAYS} complete past days logged. Early patterns are only clues; a missing entry never counts as a symptom-free day.`
      : 'Patterns compare complete past days with and without an ingredient. Keep confirming ingredients and consider these observations with a qualified clinician.',
  };
}
