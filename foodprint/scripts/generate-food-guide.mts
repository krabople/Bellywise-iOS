import fs from 'node:fs';
import { findIngredientRecord, normalizeIngredientText } from '../src/domain/ingredients';
import { curatedRecipeIngredients } from '../src/domain/foods';

const source = JSON.parse(fs.readFileSync('src/data/usdaFoodDescriptions.json', 'utf8'));
const seen = new Set<string>();
const records = source.records.flatMap((food: { name: string; fdcId: number; components: string[]; sourceType: string }) => {
  const key = normalizeIngredientText(food.name);
  if (seen.has(key)) return [];
  seen.add(key);
  const aliases = new Set([key, key.replace(/\b(?:nfs|ns as to [a-z ]+)\b/g, '').replace(/\s+/g, ' ').trim()]);
  for (const alias of [...aliases]) {
    const uk = alias.replace(/\bchili\b/g, 'chilli').replace(/\byogurt\b/g, 'yoghurt').replace(/\bcookie(s?)\b/g, 'biscuit$1').replace(/\bcandy\b/g, 'sweets').replace(/\bzucchini\b/g, 'courgette').replace(/\beggplant\b/g, 'aubergine').replace(/\bcilantro\b/g, 'coriander');
    aliases.add(uk);
  }
  const ingredients = new Set<string>();
  let unmapped = 0;
  for (const description of food.components) {
    const head = description.split(',')[0].trim();
    const exact = findIngredientRecord(description) ?? findIngredientRecord(head);
    if (exact) { ingredients.add(exact.id); continue; }
    const recipe = curatedRecipeIngredients(head);
    // Do not create exposures for unrecognised phrases or self-references.
    if (recipe) recipe.forEach(id => ingredients.add(id)); else unmapped++;
  }
  // Names with explicit exclusions must not acquire a contradictory source component.
  const exclude = /\b(?:gluten free|without gluten)\b/.test(key) ? ['wheat', 'barley', 'rye', 'gluten'] : [];
  if (/\b(?:dairy free|milk free|vegan)\b/.test(key)) exclude.push('milk', 'cheese', 'butter', 'cream', 'cream-cheese', 'hard-cheese', 'yoghurt', 'whey', 'casein', 'lactose');
  if (/\blactose free\b/.test(key)) exclude.push('lactose');
  if (/\b(?:vegan|vegetarian|meatless)\b/.test(key)) exclude.push('beef', 'pork', 'chicken', 'lamb', 'turkey', 'fish', 'shellfish');
  exclude.forEach(id => ingredients.delete(id));
  return [{ id: `usda-${food.fdcId}`, name: food.name, names: [...aliases].filter(Boolean), ingredients: [...ingredients], sourceUrl: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`, incomplete: unmapped > 0 || !ingredients.size, sourceType: food.sourceType }];
});
fs.writeFileSync('src/data/extendedFoodGuide.json', JSON.stringify({ source: source.source, sourceLicense: source.license,
  license: 'Open Database License (ODbL) 1.0', licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution: 'USDA FoodData Central source data (public domain / CC0), with Bellywise ingredient mappings using Open Food Facts contributors’ taxonomy (ODbL 1.0) and curated entries.', records }) + '\n');
console.log({ foodRecords: records.length, withMappedComponents: records.filter((r: { ingredients: string[] }) => r.ingredients.length).length, aliases: records.reduce((sum: number, r: { names: string[] }) => sum + r.names.length, 0) });
