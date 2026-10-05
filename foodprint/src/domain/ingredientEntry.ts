import { findIngredientRecord } from './ingredients';
import { resolveFood } from './foods';
import type { IngredientExposure } from './types';

/** Composite foods can be entered in the ingredient picker as well as the meal field.
 * The known food name does not confirm an unobserved recipe's components. */
export function resolveIngredientEntry(value: string): { recognised: boolean; ingredients: IngredientExposure[]; explanation?: string } {
  const exact = findIngredientRecord(value);
  const composite = !exact || ['bread', 'gravy', 'plant-sausage', 'buffalo-wings', 'chilli-sauce'].includes(exact.id);
  if (composite) {
    const food = resolveFood(value);
    if (food.matched) return { recognised: true, ingredients: food.ingredients, explanation: food.description };
  }
  return { recognised: Boolean(exact), ingredients: exact ? [{ id: exact.id, name: exact.name, confidence: 'confirmed' }] : [] };
}
