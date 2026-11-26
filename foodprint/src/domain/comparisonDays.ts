import { t } from '../i18n';
import type { ComparisonExclusionReason, PatternResult } from './types';

export function comparisonExclusionExplanation(reason: ComparisonExclusionReason, pattern: Pick<PatternResult, 'ingredientName' | 'symptomName'>): string {
  switch (reason) {
    case 'following-day-not-finished': return 'The following day has not finished yet. Bellywise waits until tomorrow to use it.';
    case 'missing-following-day': return 'There is no usable diary information for the following day, so Bellywise cannot check what happened then.';
    case 'unresolved-food-day': return 'A food entry on this day has unknown ingredients. Bellywise leaves the day out rather than assuming this ingredient was absent.';
    case 'unresolved-feeling-day': return 'A food entry on the following day has unknown ingredients. Both days need usable food information for this comparison.';
    case 'feeling-unconfirmed': return t("{0} was not logged for the relevant time, and the daily review does not confirm it was tracked. Not logged does not automatically mean it did not happen.", [pattern.symptomName]);
    case 'feeling-before-food-unreviewed': return t("{0} was logged before {1} was eaten. There is no later entry or completed review confirming what happened after the food.", [pattern.symptomName, pattern.ingredientName]);
    case 'food-day-unfinished': return t("{0} was not logged, but this day is unfinished. Bellywise cannot yet count it as a day without the ingredient.", [pattern.ingredientName]);
    case 'ingredient-unconfirmed': return t("{0} is estimated on this day, and “Confirmed ingredients only” is selected. It counts as neither with nor without the ingredient.", [pattern.ingredientName]);
  }
}
