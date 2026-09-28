import { addDays, localDateKey } from './dates';
import { findIngredientRecord, ingredientCatalog } from './ingredients';
import type { AppData } from './types';

const groups: { name: string; members: string[]; parents: string[] }[] = [
  { name: 'Fruit', members: ['apple', 'pear', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'raspberry', 'mango', 'date', 'raisin'], parents: ['fruit'] },
  { name: 'Vegetables', members: ['carrot', 'broccoli', 'cauliflower', 'spinach', 'pepper', 'cucumber', 'lettuce', 'cabbage', 'courgette', 'aubergine', 'leek', 'pea', 'sweetcorn', 'tomato'], parents: ['vegetable'] },
  { name: 'Beans, lentils & nuts', members: ['bean', 'lentil', 'chickpea', 'peanut', 'almond', 'walnut', 'cashew', 'hazelnut'], parents: ['legume', 'pulse', 'tree nut', 'nut'] },
  { name: 'Grains & starchy foods', members: ['wheat', 'oats', 'rice', 'maize', 'rye', 'barley', 'potato', 'quinoa', 'buckwheat'], parents: ['cereal', 'grain'] },
];
export function foodGroupHistory(data: AppData, now = new Date()) {
  const today = localDateKey(now), start = addDays(today, -182);
  const records = new Map(ingredientCatalog.map(r => [r.id, r]));
  const mealDays = new Map<string, Set<string>>();
  for (const meal of data.meals) {
    const date = localDateKey(meal.eatenAt); if (date < start || date >= today) continue;
    const day = mealDays.get(date) ?? new Set<string>();
    for (const item of meal.ingredients) {
      // Flavours, extracts and oils are not portions of the source food group.
      if (/\b(?:oil|flavou?r|extract|colour|color)\b/i.test(item.name)) continue;
      const record = records.get(item.id) ?? findIngredientRecord(item.name);
      for (const group of groups) if (group.members.includes(record?.id ?? item.id) || record?.parents?.some(parent => group.parents.includes(parent.toLowerCase()))) day.add(group.name);
    }
    mealDays.set(date, day);
  }
  const complete = new Set(data.checkIns.filter(c => c.complete).map(c => c.date));
  return groups.map(group => ({ name: group.name, weeks: Array.from({ length: 26 }, (_, i) => {
    const from = addDays(start, i * 7), dates = Array.from({ length: 7 }, (_, offset) => addDays(from, offset));
    return { from, to: dates[6], loggedDays: dates.filter(date => mealDays.has(date)).length, completeDays: dates.filter(date => complete.has(date)).length, presentDays: dates.filter(date => mealDays.get(date)?.has(group.name)).length };
  }) }));
}
