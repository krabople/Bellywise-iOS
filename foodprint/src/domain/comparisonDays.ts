import type { ComparisonExclusionReason, PatternResult } from './types';

export function comparisonExclusionExplanation(reason: ComparisonExclusionReason, pattern: Pick<PatternResult, 'ingredientName' | 'symptomName'>): string {
  switch (reason) {
    case 'following-day-not-finished': return 'The following day has not finished yet. Bellywise waits until tomorrow to use it.';
    case 'missing-following-day': return 'There is no usable diary information for the following day, so Bellywise cannot check what happened then.';
    case 'unresolved-food-day': return 'A food entry on this day has unknown ingredients. Bellywise leaves the day out rather than assuming this ingredient was absent.';
    case 'unresolved-feeling-day': return 'A food entry on the following day has unknown ingredients. Both days need usable food information for this comparison.';
    case 'feeling-unconfirmed': return `${pattern.symptomName} was not logged for the relevant time, and the daily review does not confirm it was tracked. Not logged does not automatically mean it did not happen.`;
    case 'feeling-before-food-unreviewed': return `${pattern.symptomName} was logged before ${pattern.ingredientName} was eaten. There is no later entry or completed review confirming what happened after the food.`;
    case 'food-day-unfinished': return `${pattern.ingredientName} was not logged, but this day is unfinished. Bellywise cannot yet count it as a day without the ingredient.`;
    case 'ingredient-unconfirmed': return `${pattern.ingredientName} is estimated on this day, and “Confirmed ingredients only” is selected. It counts as neither with nor without the ingredient.`;
  }
}
