import { expandIngredientExposuresForAnalysis, findIngredientRecord, getIngredientInfo, normalizeIngredientText } from './ingredients';
import type { AppData, IngredientExposure, Meal, PatternResult } from './types';
import { isPackagingText } from './ingredientTextPolicy';

export function foodIdentity(meal: Meal): string | undefined {
  // Single ingredients already have their own comparison. Packaged products retain barcode identity.
  if (!meal.productCode && meal.ingredients.length < 2) return undefined;
  const name = normalizeIngredientText(meal.name);
  if (/^(?:(?:plain|still|tap|bottled|spring|mineral|filtered|purified|drinking) )*water$/.test(name)) return undefined;
  if (meal.productCode) return `food:${meal.productCode}`;
  // Bound identifiers for backup/notification keys while distinguishing long product names.
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return name ? `food:${name.slice(0, 55)}:${(hash >>> 0).toString(36)}` : undefined;
}

export function mealExposures(meal: Meal): IngredientExposure[] {
  const context = [meal.name, ...(meal.excludedComponents ?? []).map(id => `${id}-free`)].join(' ');
  const recorded = meal.ingredients.filter(item => !isPackagingText(item.name)).map(item => findIngredientRecord(item.name)?.id === 'water' ? { ...item, id: 'water', name: 'Water' } : item);
  if (!recorded.length) return [];
  const ingredients = expandIngredientExposuresForAnalysis(recorded, context);
  const id = foodIdentity({ ...meal, ingredients: recorded });
  return id ? [...ingredients, { id, name: meal.name, confidence: meal.ingredients.every(i => i.confidence === 'confirmed') ? 'confirmed' : 'inferred' }] : ingredients;
}

export function evidenceContext(id: string, name: string): string {
  if (id.startsWith('food:')) return 'This compares the whole food or product. It cannot identify a responsible ingredient on its own.';
  const info = getIngredientInfo(id, name);
  if (info.triggerLevel === 'not-common') return 'Not a commonly recognised intolerance trigger at ordinary food amounts. Treat this as a diary clue with a less established explanation; another ingredient or circumstance may be responsible.';
  if (info.triggerLevel === 'unknown') return 'There is not enough established ingredient information to judge a medical explanation. The diary link alone cannot establish an intolerance.';
  return `${info.triggerSummary} This background does not measure your personal likelihood of intolerance or prove it explains this particular feeling.`;
}

/** Collapse only identical exposure timing and evidence. Partial overlap remains independently visible. */
export function groupPatternsForDisplay(patterns: PatternResult[], data: AppData): PatternResult[] {
  const exposures = data.meals.map(meal => ({ meal, ingredients: mealExposures(meal) }));
  const signatureParts = new Map<string, string[]>();
  for (const { meal, ingredients } of exposures) for (const item of ingredients) signatureParts.set(item.id, [...(signatureParts.get(item.id) ?? []), `${meal.id}@${meal.eatenAt}`]);
  const signatures = new Map([...signatureParts].map(([id, parts]) => [id, parts.sort().join('|')]));
  const hidden = new Set<string>();
  const products = patterns.filter(p => p.ingredientId.startsWith('food:'));
  const merged = new Map<string, PatternResult>();
  const strength = { 'not-enough-data': 0, exploratory: 1, emerging: 2 };
  for (const product of products) {
    const linked = patterns.filter(p => !p.ingredientId.startsWith('food:') && p.symptomId === product.symptomId && p.window === product.window && signatures.get(p.ingredientId) === signatures.get(product.ingredientId)
      && p.exposedDays === product.exposedDays && p.unexposedDays === product.unexposedDays && p.exposedSymptomDays === product.exposedSymptomDays && p.unexposedSymptomDays === product.unexposedSymptomDays
      && strength[p.status] <= strength[product.status] && p.confirmedExposedDays <= product.confirmedExposedDays);
    linked.forEach(p => hidden.add(p.id));
    const components = [...new Map(data.meals.filter(m => foodIdentity(m) === product.ingredientId).flatMap(m => mealExposures(m).filter(i => !i.id.startsWith('food:') && i.id !== 'water')).map(i => [i.id, i])).values()];
    const priority = { recognised: 0, possible: 1, 'not-common': 2, unknown: 3 };
    components.sort((a, b) => priority[getIngredientInfo(a.id, a.name).triggerLevel] - priority[getIngredientInfo(b.id, b.name).triggerLevel]);
    merged.set(product.id, { ...product, linkedIngredients: components.map(i => ({ id: i.id, name: i.name, explanation: evidenceContext(i.id, i.name) })), cautions: [...product.cautions, linked.length ? `${linked.length} ingredient comparisons share exactly the same exposure records and results, so they are shown together here. The diary cannot separate their effects.` : 'Ingredients are listed by established trigger context, not by proof that they caused this symptom.'] });
  }
  return patterns.filter(p => !hidden.has(p.id)).map(p => merged.get(p.id) ?? p);
}
