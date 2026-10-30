import type { FoodResolution, IngredientExposure } from './types';

/** Default selections for a newly added meal, without changing recipe provenance
 * or the confirmation choices already saved in an existing diary entry. */
export function ingredientsForMealEntry(resolution: FoodResolution): IngredientExposure[] {
  return resolution.ingredients.map(ingredient => ({
    ...ingredient,
    confidence: resolution.matched ? 'confirmed' : ingredient.confidence,
  }));
}
