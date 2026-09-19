import { addDays, localDateKey } from './dates';
import { ingredientsFromNames } from './foods';
import { BUILT_IN_SYMPTOMS } from './symptoms';
import { AppData, Level } from './types';

/** Deterministic illustrative data. Never merged automatically into a real diary. */
export function getDemoData(referenceDate: Date = new Date()): AppData {
  const result: AppData = { meals: [], symptoms: [], checkIns: [], customSymptoms: [] };
  const reference = localDateKey(referenceDate);
  for (let index = 0; index < 42; index++) {
    const day = addDays(reference, index - 42);
    const hasMilk = [0, 1, 4].includes(index % 7);
    const wheat = index % 3 !== 0;
    const highStress = index % 9 === 0;
    const hasBloating = hasMilk ? index % 7 !== 1 || index % 2 === 0 : index % 13 === 0;
    result.checkIns.push({ date: day, complete: true, trackedSymptomIds: BUILT_IN_SYMPTOMS.map(item => item.id), stress: (highStress ? 4 : 2) as Level, sleepHours: highStress ? 6 : 7.5 });
    result.meals.push({
      id: `demo-breakfast-${index}`, name: hasMilk ? 'Yoghurt with blueberries' : 'Oats with blueberries',
      eatenAt: new Date(`${day}T08:15:00`).toISOString(), source: 'typed',
      ingredients: ingredientsFromNames(hasMilk ? ['Milk', 'Lactose', 'Blueberries'] : ['Oats', 'Blueberries']),
    });
    result.meals.push({
      id: `demo-lunch-${index}`, name: wheat ? 'Chicken sandwich' : 'Chicken and rice bowl',
      eatenAt: new Date(`${day}T12:30:00`).toISOString(), source: 'typed',
      ingredients: ingredientsFromNames(wheat ? ['Wheat', 'Chicken', 'Lettuce'] : ['Rice', 'Chicken', 'Carrot']),
    });
    result.meals.push({
      id: `demo-dinner-${index}`, name: index % 2 ? 'Salmon, rice and greens' : 'Roast chicken and potatoes',
      eatenAt: new Date(`${day}T18:45:00`).toISOString(), source: 'typed',
      ingredients: ingredientsFromNames(index % 2 ? ['Salmon', 'Rice', 'Spinach', 'Olive oil'] : ['Chicken', 'Potato', 'Carrot', 'Olive oil']),
    });
    if (hasBloating) result.symptoms.push({ id: `demo-bloating-${index}`, symptomId: 'bloating', occurredAt: new Date(`${day}T11:00:00`).toISOString(), severity: hasMilk ? 3 : 2 });
    if (highStress) result.symptoms.push({ id: `demo-energy-${index}`, symptomId: 'fatigue', occurredAt: new Date(`${day}T16:00:00`).toISOString(), severity: 3 });
    if (!hasBloating && index % 2 === 0) result.symptoms.push({ id: `demo-comfort-${index}`, symptomId: 'comfortable', occurredAt: new Date(`${day}T20:00:00`).toISOString(), severity: 4 });
  }
  return result;
}
