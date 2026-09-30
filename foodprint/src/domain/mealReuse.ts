import { localDateKey } from './dates';
import type { Meal } from './types';

export interface PreviousMeal {
  id: string;
  name: string;
  eatenAt: string;
  items: Meal[];
}

/** Keep every recorded item in a meal, even when the journal is filtered. */
export function previousMeals(meals: readonly Meal[]): PreviousMeal[] {
  const groups = new Map<string, PreviousMeal>();
  for (const meal of meals) {
    // The day also protects against imported diaries reusing a group ID across days.
    const id = meal.groupId
      ? `group:${JSON.stringify([localDateKey(meal.eatenAt), meal.groupId])}`
      : `entry:${meal.id}`;
    const existing = groups.get(id);
    if (existing) {
      existing.items.push(meal);
      if (Date.parse(meal.eatenAt) > Date.parse(existing.eatenAt)) existing.eatenAt = meal.eatenAt;
    } else {
      groups.set(id, { id, name: meal.groupId ? meal.groupName || 'Meal' : meal.name, eatenAt: meal.eatenAt, items: [meal] });
    }
  }
  for (const group of groups.values()) {
    group.items.sort((a, b) => Date.parse(a.eatenAt) - Date.parse(b.eatenAt) || a.id.localeCompare(b.id));
  }
  return [...groups.values()].sort((a, b) => Date.parse(b.eatenAt) - Date.parse(a.eatenAt) || a.id.localeCompare(b.id));
}

/** Make independent food entries without reinterpreting a previously reviewed label. */
export function copyMealItems(items: readonly Meal[], eatenAt: Date, groupName: string, makeId: () => string, now = new Date()): Meal[] {
  if (!items.length) throw new Error('Choose at least one food or drink to log again.');
  if (!Number.isFinite(eatenAt.getTime()) || !Number.isFinite(now.getTime()) || eatenAt.getTime() > now.getTime()) {
    throw new Error('Choose a valid time in the past.');
  }
  const targetGroup = groupName.trim();
  if (!targetGroup || targetGroup.length > 80) throw new Error('Choose a valid meal group.');
  const ids = new Set(items.map(item => item.id));
  return items.map(item => {
    const id = makeId();
    if (!id.trim() || id.length > 120 || ids.has(id)) throw new Error('The new food entries need separate IDs. Please try again.');
    ids.add(id);
    const { groupId: _oldGroupId, groupName: _oldGroupName, ...source } = item;
    return {
      ...source,
      id,
      eatenAt: eatenAt.toISOString(),
      ingredients: item.ingredients.map(ingredient => ({
        ...ingredient,
        ...(ingredient.excludedComponents ? { excludedComponents: [...ingredient.excludedComponents] } : {}),
      })),
      ...(item.excludedComponents ? { excludedComponents: [...item.excludedComponents] } : {}),
      ...(targetGroup === 'Ungrouped' ? {} : { groupName: targetGroup, groupId: `${localDateKey(eatenAt)}:${targetGroup}` }),
    };
  });
}
