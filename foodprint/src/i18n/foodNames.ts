import names from './foodNames.json';
import { canonicalLabelContext } from './labelContext';
const key = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/[-–—]/g, ' ').replace(/\s+/g,' ').trim();
const index = new Map(Object.entries(names as Record<string, string>).map(([local, original]) => [key(local), original]));
/** Whole dish names only: never pick an ingredient out of a negated claim. */
export function canonicalMealName(value: string): string {
  const contextual = canonicalLabelContext(value);
  const exact = index.get(key(value)) ?? index.get(key(contextual));
  if (exact) return exact;
  const claims = contextual.match(/\b(?:(?:gluten|lactose|dairy|milk|sugar|alcohol|caffeine)[ -]free|vegan|vegetarian)\b/gi) ?? [];
  if (claims.length) {
    const base = contextual.replace(/\b(?:(?:gluten|lactose|dairy|milk|sugar|alcohol|caffeine)[ -]free|vegan|vegetarian)\b/gi, '').trim();
    const food = index.get(key(base));
    if (food) return [...claims, food].join(' ');
  }
  return contextual;
}
