import { Confidence, FoodResolution, IngredientExposure } from './types';
import { extraRecipes, type Recipe } from './extraRecipes';
import extendedGuide from '../data/extendedFoodGuide.json';
import { spellingDistance, foodQualifierKey } from './catalogMatching';

import { findIngredientRecord, ingredientCatalog, ingredientFromText, ingredientsFromNames, normalizeIngredientText } from './ingredients';
export { ingredientCatalog, ingredientFromText, ingredientsFromNames } from './ingredients';

const normalize = (value: string) => normalizeIngredientText(value.replace(/&/g, ' and '));

/** Recipes are editable hypotheses, not brand-specific ingredient lists. */
const CURATED_RECIPES: Recipe[] = [...extraRecipes,
  { names: ['bread', 'white bread', 'brown bread', 'wholemeal bread', 'toast', 'baguette', 'sourdough', 'pitta', 'pita', 'bagel', 'bread roll'], ingredients: ['wheat', 'yeast', 'salt'], question: 'grain' },
  { names: ['gluten free bread', 'gluten free toast', 'gluten free bagel'], ingredients: ['rice', 'maize', 'tapioca', 'yeast', 'salt'] },
  { names: ['pasta', 'spaghetti', 'penne', 'macaroni', 'fusilli', 'linguine'], ingredients: ['wheat'], question: 'grain' },
  { names: ['gluten free pasta', 'gluten free spaghetti'], ingredients: ['rice', 'maize'] },
  { names: ['spaghetti bolognese', 'spag bol', 'pasta bolognese', 'bolognese'], ingredients: ['wheat', 'beef', 'tomato', 'onion', 'garlic', 'carrot', 'olive-oil'], question: 'grain' },
  { names: ['lasagne', 'lasagna'], ingredients: ['wheat', 'beef', 'tomato', 'onion', 'garlic', 'milk', 'lactose'], question: 'grain' },
  { names: ['carbonara', 'spaghetti carbonara'], ingredients: ['wheat', 'egg', 'pork', 'milk'], question: 'grain' },
  { names: ['pesto', 'pesto pasta'], ingredients: ['wheat', 'basil', 'milk', 'olive-oil', 'garlic'], question: 'grain' },
  { names: ['pizza', 'margherita', 'margherita pizza'], ingredients: ['wheat', 'milk', 'tomato', 'yeast', 'olive-oil'], question: 'grain' },
  { names: ['pepperoni pizza'], ingredients: ['wheat', 'milk', 'tomato', 'pork', 'yeast'], question: 'grain' },
  { names: ['sandwich', 'cheese sandwich', 'cheese toastie'], ingredients: ['wheat', 'milk', 'yeast'], question: 'grain' },
  { names: ['ham sandwich', 'ham and cheese sandwich'], ingredients: ['wheat', 'pork', 'milk', 'yeast'], question: 'grain' },
  { names: ['tuna sandwich', 'tuna mayo sandwich'], ingredients: ['wheat', 'fish', 'egg', 'yeast'], question: 'grain' },
  { names: ['peanut butter sandwich', 'peanut butter on toast'], ingredients: ['wheat', 'peanut', 'yeast'], question: 'grain' },
  { names: ['croissant', 'pain au chocolat'], ingredients: ['wheat', 'milk', 'egg', 'yeast'] },
  { names: ['pancake', 'pancakes', 'crepe', 'crepes', 'waffle', 'waffles'], ingredients: ['wheat', 'milk', 'lactose', 'egg'], question: 'grain' },
  { names: ['porridge', 'oatmeal'], ingredients: ['oats', 'milk', 'lactose'], question: 'milk' },
  { names: ['granola', 'muesli'], ingredients: ['oats', 'raisin', 'almond', 'honey'] },
  { names: ['cornflakes', 'corn flakes'], ingredients: ['maize', 'barley', 'sugar'] },
  { names: ['weetabix', 'wheat cereal'], ingredients: ['wheat', 'barley'] },
  { names: ['scrambled eggs', 'scrambled egg'], ingredients: ['egg', 'milk', 'lactose'], question: 'milk' },
  { names: ['omelette', 'omelet'], ingredients: ['egg', 'vegetable-oil'] },
  { names: ['french toast', 'eggy bread'], ingredients: ['wheat', 'egg', 'milk', 'lactose'], question: 'grain' },
  { names: ['milk', 'cows milk', 'whole milk', 'skimmed milk', 'semi skimmed milk'], ingredients: ['milk', 'lactose'], question: 'milk' },
  { names: ['lactose free milk'], ingredients: ['milk'] },
  { names: ['oat milk', 'oat drink'], ingredients: ['oats'] },
  { names: ['almond milk', 'almond drink'], ingredients: ['almond'] },
  { names: ['soy milk', 'soya milk', 'soya drink'], ingredients: ['soy'] },
  { names: ['coconut milk', 'coconut cream'], ingredients: ['coconut'] },
  { names: ['yoghurt', 'yogurt', 'greek yoghurt', 'greek yogurt'], ingredients: ['milk', 'lactose'], question: 'milk' },
  { names: ['cheddar', 'parmesan', 'hard cheese', 'aged cheese'], ingredients: ['hard-cheese'] },
  { names: ['mozzarella', 'feta', 'soft cheese', 'cream cheese', 'ricotta', 'cottage cheese'], ingredients: ['milk', 'lactose'] },
  { names: ['cheese'], ingredients: ['cheese', 'lactose'], question: 'cheese' },
  { names: ['ice cream', 'gelato', 'custard'], ingredients: ['milk', 'lactose', 'sugar'], question: 'milk' },
  { names: ['latte', 'cappuccino', 'flat white', 'coffee with milk'], ingredients: ['coffee', 'caffeine', 'milk', 'lactose'], question: 'milk' },
  { names: ['americano', 'espresso', 'black coffee', 'coffee', 'cold brew', 'iced coffee'], ingredients: ['coffee', 'caffeine'] },
  { names: ['oat latte', 'oat milk latte', 'oat cappuccino', 'oat flat white'], ingredients: ['coffee', 'caffeine', 'oats'] },
  { names: ['soy latte', 'soya latte', 'soy milk latte'], ingredients: ['coffee', 'caffeine', 'soy'] },
  { names: ['almond latte', 'almond milk latte'], ingredients: ['coffee', 'caffeine', 'almond'] },
  { names: ['tea', 'black tea', 'green tea', 'earl grey'], ingredients: ['tea', 'caffeine'] },
  { names: ['peppermint tea', 'mint tea'], ingredients: ['peppermint'] },
  { names: ['chamomile tea', 'camomile tea'], ingredients: ['chamomile'] },
  { names: ['ginger tea'], ingredients: ['ginger'] },
  { names: ['tea with milk', 'milk tea', 'chai latte'], ingredients: ['tea', 'caffeine', 'milk', 'lactose'], question: 'milk' },
  { names: ['hot chocolate'], ingredients: ['cocoa', 'milk', 'lactose', 'sugar'], question: 'milk' },
  { names: ['mocha'], ingredients: ['coffee', 'caffeine', 'cocoa', 'milk', 'lactose', 'sugar'], question: 'milk' },
  { names: ['milk chocolate'], ingredients: ['milk', 'lactose', 'cocoa', 'sugar'] },
  { names: ['dark chocolate'], ingredients: ['cocoa', 'sugar'] },
  { names: ['chocolate cake', 'brownie', 'brownies'], ingredients: ['wheat', 'egg', 'milk', 'sugar', 'cocoa'] },
  { names: ['cake', 'cupcake', 'muffin', 'sponge cake'], ingredients: ['wheat', 'egg', 'milk', 'sugar'] },
  { names: ['biscuit', 'biscuits', 'cookie', 'cookies'], ingredients: ['wheat', 'milk', 'sugar'] },
  { names: ['hummus', 'houmous'], ingredients: ['chickpea', 'sesame', 'garlic', 'lemon', 'olive-oil'] },
  { names: ['falafel'], ingredients: ['chickpea', 'onion', 'garlic', 'cumin', 'coriander'] },
  { names: ['lentil soup', 'dal', 'dhal', 'dahl'], ingredients: ['lentil', 'onion', 'garlic', 'cumin'] },
  { names: ['tomato soup'], ingredients: ['tomato', 'onion', 'garlic'] },
  { names: ['vegetable soup', 'minestrone'], ingredients: ['carrot', 'onion', 'celery', 'tomato'] },
  { names: ['chicken curry', 'curry'], ingredients: ['chicken', 'onion', 'garlic', 'tomato', 'ginger', 'cumin'] },
  { names: ['chicken tikka masala', 'butter chicken'], ingredients: ['chicken', 'milk', 'lactose', 'tomato', 'onion', 'garlic'] },
  { names: ['thai green curry', 'thai red curry'], ingredients: ['coconut', 'chicken', 'garlic', 'chilli', 'fish'] },
  { names: ['chickpea curry', 'chana masala'], ingredients: ['chickpea', 'tomato', 'onion', 'garlic', 'cumin'] },
  { names: ['chilli con carne', 'chili con carne'], ingredients: ['beef', 'bean', 'tomato', 'onion', 'garlic', 'chilli'] },
  { names: ['chilli sin carne', 'bean chilli'], ingredients: ['bean', 'tomato', 'onion', 'garlic', 'chilli'] },
  { names: ['stir fry', 'chicken stir fry'], ingredients: ['chicken', 'soy', 'wheat', 'garlic', 'ginger', 'pepper'] },
  { names: ['fried rice', 'egg fried rice'], ingredients: ['rice', 'egg', 'soy', 'wheat', 'pea'] },
  { names: ['risotto', 'mushroom risotto'], ingredients: ['rice', 'mushroom', 'onion', 'milk'] },
  { names: ['sushi', 'salmon sushi'], ingredients: ['rice', 'fish', 'vinegar'] },
  { names: ['ramen'], ingredients: ['wheat', 'soy', 'egg', 'garlic', 'onion'] },
  { names: ['noodles', 'egg noodles'], ingredients: ['wheat', 'egg'] },
  { names: ['rice noodles'], ingredients: ['rice'] },
  { names: ['burger', 'beef burger', 'hamburger'], ingredients: ['beef', 'wheat', 'yeast', 'onion'] },
  { names: ['cheeseburger'], ingredients: ['beef', 'wheat', 'milk', 'onion'] },
  { names: ['sausage', 'sausages'], ingredients: ['pork', 'wheat'] },
  { names: ['fish and chips'], ingredients: ['fish', 'wheat', 'potato', 'vegetable-oil'] },
  { names: ['chips', 'fries', 'french fries'], ingredients: ['potato', 'vegetable-oil', 'salt'] },
  { names: ['crisps', 'potato chips'], ingredients: ['potato', 'vegetable-oil', 'salt'] },
  { names: ['jacket potato', 'baked potato'], ingredients: ['potato'] },
  { names: ['mashed potato', 'mashed potatoes'], ingredients: ['potato', 'milk', 'lactose'], question: 'milk' },
  { names: ['baked beans'], ingredients: ['bean', 'tomato', 'sugar'] },
  { names: ['beans on toast'], ingredients: ['bean', 'tomato', 'sugar', 'wheat'] },
  { names: ['caesar salad'], ingredients: ['lettuce', 'wheat', 'milk', 'egg', 'fish', 'garlic'] },
  { names: ['greek salad'], ingredients: ['tomato', 'cucumber', 'milk', 'onion', 'olive-oil'] },
  { names: ['coleslaw'], ingredients: ['cabbage', 'carrot', 'onion', 'egg'] },
  { names: ['guacamole'], ingredients: ['avocado', 'onion', 'lime', 'tomato'] },
  { names: ['mayonnaise', 'mayo'], ingredients: ['egg', 'vegetable-oil', 'vinegar', 'mustard'] },
  { names: ['soy sauce', 'soya sauce'], ingredients: ['soy', 'wheat', 'salt'] },
  { names: ['tamari'], ingredients: ['soy', 'salt'] },
  { names: ['peanut butter'], ingredients: ['peanut'] },
  { names: ['almond butter'], ingredients: ['almond'] },
  { names: ['cashew butter'], ingredients: ['cashew'] },
  { names: ['apple juice'], ingredients: ['apple'] },
  { names: ['orange juice'], ingredients: ['orange'] },
  { names: ['grape juice'], ingredients: ['grape'] },
  { names: ['mango juice'], ingredients: ['mango'] },
  { names: ['water', 'still water', 'mineral water'], ingredients: ['water'] },
  { names: ['sparkling water', 'soda water', 'fizzy water'], ingredients: ['water', 'carbonation'] },
  { names: ['cola'], ingredients: ['water', 'sugar', 'caffeine', 'carbonation'], question: 'cola' },
  { names: ['smoothie', 'banana smoothie'], ingredients: ['banana', 'milk', 'lactose'], question: 'milk' },
  { names: ['beer', 'lager', 'ale'], ingredients: ['barley', 'alcohol', 'yeast'] },
  { names: ['wine', 'red wine', 'white wine'], ingredients: ['grape', 'alcohol'] },
  { names: ['cider'], ingredients: ['apple', 'alcohol'] },
  { names: ['vodka', 'gin', 'rum', 'whisky', 'whiskey', 'tequila', 'brandy'], ingredients: ['alcohol'] },
];
const RECIPES: Recipe[] = [...CURATED_RECIPES, ...extendedGuide.records];
/** Import mapping stays independent of previously generated catalogue records. */
export function curatedRecipeIngredients(input: string): string[] | undefined {
  const key = normalize(input);
  return CURATED_RECIPES.find(recipe => recipe.names.some(name => normalize(name) === key))?.ingredients;
}

const recipeAliases = new Map<string, Recipe>();
for (const recipe of RECIPES) for (const alias of recipe.names) {
  const key = normalize(alias);
  if (!recipeAliases.has(key)) recipeAliases.set(key, recipe);
}
const aliasRows = [...recipeAliases].map(([alias, recipe]) => ({ alias, recipe }));
const qualifierMatches = (a: string, b: string) => foodQualifierKey(a) === foodQualifierKey(b);
export const addedFoodRecordCount = extendedGuide.records.length;
export const foodRecipeRecordCount = RECIPES.length;

export const foodCatalogSize = RECIPES.length + ingredientCatalog.length;

export function suggestFoodNames(input: string): string[] {
  const query = normalize(input); if (query.length < 3) return [];
  const results = new Map<Recipe, number>();
  const tokens = query.split(' ');
  for (const { alias, recipe } of aliasRows) {
    if (!qualifierMatches(query, alias)) continue;
    const overlap = tokens.filter(token => alias.split(' ').includes(token)).length / tokens.length;
    const score = alias.startsWith(query) ? .98 - (alias.length - query.length) / 1000 : overlap === 1 ? .82 : spellingDistance(query, alias, 2) <= 2 ? .9 : overlap >= .5 ? .55 : 0;
    if (score > (results.get(recipe) ?? 0)) results.set(recipe, score);
  }
  return [...results].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([recipe]) => recipe.names === undefined ? '' : ('name' in recipe ? String(recipe.name) : recipe.names[0]));
}
const grainOptions = [{ id: 'standard', label: 'Regular recipe' }, { id: 'gluten-free', label: 'Gluten-free' }];
const milkOptions = [{ id: 'standard', label: 'Regular dairy' }, { id: 'lactose-free', label: 'Lactose-free dairy' }, { id: 'oat', label: 'Oat' }, { id: 'soy', label: 'Soy' }, { id: 'almond', label: 'Almond' }, { id: 'dairy-free', label: 'Other dairy-free' }];
const cheeseOptions = [{ id: 'fresh-soft', label: 'Fresh / soft cheese' }, { id: 'hard-aged', label: 'Hard / aged cheese' }, { id: 'lactose-free', label: 'Lactose-free cheese' }];

function makeIngredient(id: string, confidence: Confidence = 'inferred'): IngredientExposure {
  const known = ingredientCatalog.find(item => item.id === id) ?? findIngredientRecord(id);
  return { id: known?.id ?? id, name: known?.name ?? id, confidence };
}

/** Resolve whole dish names before individual words, so peanut butter never becomes dairy. */
export function resolveFood(input: string, variant?: string): FoodResolution {
  const name = input.trim();
  const query = normalize(name);
  const variantText = normalize(variant ?? '');
  const glutenFree = /\bgluten free\b|\b(?:without|no) gluten\b/.test(`${query} ${variantText}`);
  const lactoseFree = /\blactose free\b/.test(`${query} ${variantText}`);
  const vegan = /\bvegan\b/.test(`${query} ${variantText}`);
  const vegetarian = vegan || /\b(?:vegetarian|veggie|meat free|meatfree|meatless|plant based)\b/.test(query);
  const decaf = /\b(?:decaf|decaffeinated|caffeine free)\b/.test(`${query} ${variantText}`);
  const alcoholFree = /\b(?:alcohol free|non alcoholic)\b/.test(`${query} ${variantText}`);
  const sugarFree = /\b(?:sugar free|diet|zero sugar)\b/.test(`${query} ${variantText}`);
  const dairyFree = vegan || /\b(?:dairy|milk) free\b|\b(?:without|no) (?:milk|dairy)\b/.test(`${query} ${variantText}`) || /^(oat|soy|almond)$/.test(variantText);
  const stripped = query.replace(/\b(?:gluten free|lactose free|dairy free|milk free|vegan|decaf|decaffeinated|caffeine free|alcohol free|non alcoholic|sugar free|diet|zero sugar)\b/g, '').replace(/\b(?:without|no)\s+.*$/, '').replace(/\s+/g, ' ').trim();
  const exactRecipe = recipeAliases.get(query);
  const close = !exactRecipe && !recipeAliases.has(stripped) && !findIngredientRecord(stripped) && query.length >= 6
    ? aliasRows.filter(row => qualifierMatches(query, row.alias)).map(({ recipe: item, alias }) => ({ item, distance: spellingDistance(query, alias, 2) })).filter(row => row.distance <= 2).sort((a, b) => a.distance - b.distance) : [];
  const fuzzy = close[0] && close[0].distance <= Math.min(2, Math.floor(query.length / 6)) && !close.some(other => other.item !== close[0].item && other.distance === close[0].distance) ? close[0].item : undefined;
  const recipe = exactRecipe ?? recipeAliases.get(stripped) ?? fuzzy;
  const exactIngredient = findIngredientRecord(stripped);
  let ids = recipe ? [...recipe.ingredients] : exactIngredient ? [exactIngredient.id] : [];
  let matched = Boolean(recipe || exactIngredient);
  const compositeIngredients = new Map<string, IngredientExposure>();

  // Composite entry: resolve comma/"and" separated foods independently, not fuzzy substrings.
  if (!matched && /,|\s+and\s+|\s+with\s+/.test(query)) {
    const parts = query.split(/,|\s+and\s+|\s+with\s+/).map(part => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      const resolved = parts.map(part => resolveFood(part));
      for (const item of resolved) for (const ingredient of item.ingredients) compositeIngredients.set(ingredient.id, ingredient);
      ids = resolved.flatMap(item => item.ingredients.map(ingredient => ingredient.id));
      matched = resolved.every(item => item.matched);
    }
  }

  if (glutenFree) {
    const hadWheat = ids.includes('wheat');
    ids = ids.filter(id => !['wheat', 'barley', 'rye'].includes(id));
    if (hadWheat && recipe) ids.push('rice', 'maize');
  }
  if (dairyFree) ids = ids.filter(id => !['milk', 'lactose', 'butter', 'cream', 'cheese', 'cream-cheese', 'hard-cheese', 'yoghurt', 'mozzarella', 'ghee', 'whey', 'casein'].includes(id));
  if (lactoseFree) ids = ids.filter(id => id !== 'lactose');
  if (recipe?.question === 'cheese' && variantText === 'hard aged') ids = ids.filter(id => id !== 'lactose');
  if (decaf) ids = ids.filter(id => id !== 'caffeine');
  if (alcoholFree) ids = ids.filter(id => id !== 'alcohol');
  if (sugarFree) {
    ids = ids.filter(id => id !== 'sugar');
    if (recipe?.question === 'cola') {
      ids.push('custom-unspecified-sweetener');
      compositeIngredients.set('custom-unspecified-sweetener', { id: 'custom-unspecified-sweetener', name: 'Sweetener — check the actual label', confidence: 'inferred' });
    }
  }
  if (vegan) ids = ids.filter(id => !['egg', 'beef', 'chicken', 'pork', 'lamb', 'turkey', 'fish', 'shellfish', 'honey'].includes(id));
  if (vegetarian) ids = ids.filter(id => !['beef', 'chicken', 'pork', 'lamb', 'turkey', 'fish', 'shellfish', 'gelatine'].includes(id));
  if (recipe?.question === 'plant-protein' && ['soy', 'pea', 'mushroom'].includes(variantText)) ids.push(variantText);
  if (/^(oat|soy|almond)$/.test(variantText)) ids.push(variantText === 'oat' ? 'oats' : variantText);
  const exclusions = query.match(/\b(?:without|no)\s+(.+)$/)?.[1].split(/,|\s+or\s+|\s+and\s+/).map(text => ingredientFromText(text).id) ?? [];
  ids = [...new Set(ids.filter(id => !exclusions.includes(id)))];
  if (exclusions.includes('milk')) ids = ids.filter(id => id !== 'lactose');

  const questions = [];
  if (recipe?.question === 'grain' && !glutenFree && !variant) questions.push({ id: 'grain', prompt: 'Which version did you have?', options: grainOptions });
  if (recipe?.question === 'milk' && !dairyFree && !lactoseFree && !variant) questions.push({ id: 'milk', prompt: 'Which milk or dairy was used?', options: milkOptions });
  if (recipe?.question === 'cola' && !sugarFree && !variant) questions.push({ id: 'cola', prompt: 'Which version did you drink?', options: [{ id: 'standard', label: 'Regular' }, { id: 'sugar-free', label: 'Diet / sugar-free' }] });
  if (recipe?.question === 'cheese' && !lactoseFree && !variant) questions.push({ id: 'cheese', prompt: 'Which kind of cheese was it?', options: cheeseOptions });
  if (recipe?.question === 'plant-protein' && !variant) questions.push({ id: 'plant-protein', prompt: 'What was the main ingredient? Check the packet if you’re unsure.', options: [{ id: 'soy', label: 'Soya / tofu' }, { id: 'pea', label: 'Pea protein' }, { id: 'mushroom', label: 'Mushroom' }, { id: 'unknown', label: 'Not sure — add from label' }] });
  const ingredients: IngredientExposure[] = ids.map(id => ({ ...(compositeIngredients.get(id) ?? makeIngredient(id, exactIngredient && !recipe ? 'confirmed' : 'inferred')), excludedComponents: [glutenFree ? 'gluten' : '', lactoseFree ? 'lactose' : ''].filter(Boolean) }));
  if (!ingredients.length && name) ingredients.push(ingredientFromText(name, 'inferred'));
  return {
    name, ingredients, questions, matched,
    description: matched
      ? `${fuzzy && !exactRecipe ? `Closest recipe: ${recipe!.names[0]}. ` : ''}${recipe?.sourceUrl ? 'Recognised in the USDA food guide. ' : ''}${recipe?.incomplete ? 'The guide cannot supply a complete ingredient list. Add missing ingredients from your recipe or packet. ' : ''}Typical recipe only. Ingredients are estimates; edit anything that differs from what you ate.`
      : 'No complete recipe match. This entry stays uncertain until you add or confirm its ingredients.',
  };
}
