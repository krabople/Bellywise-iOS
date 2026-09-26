import { Confidence, FoodResolution, IngredientExposure } from './types';

import { findIngredientRecord, ingredientCatalog, ingredientFromText, ingredientsFromNames, normalizeIngredientText } from './ingredients';
export { ingredientCatalog, ingredientFromText, ingredientsFromNames } from './ingredients';

const normalize = normalizeIngredientText;

/** Recipes are editable hypotheses, not brand-specific ingredient lists. */
const RECIPES: { names: string[]; ingredients: string[]; question?: 'grain' | 'milk' | 'cola' | 'cheese' }[] = [
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
  { names: ['cheddar', 'parmesan', 'hard cheese', 'aged cheese'], ingredients: ['milk'] },
  { names: ['mozzarella', 'feta', 'soft cheese', 'cream cheese', 'ricotta', 'cottage cheese'], ingredients: ['milk', 'lactose'] },
  { names: ['cheese'], ingredients: ['milk', 'lactose'], question: 'cheese' },
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

export const foodCatalogSize = RECIPES.reduce((count, item) => count + item.names.length, 0) + ingredientCatalog.length;
const grainOptions = [{ id: 'standard', label: 'Regular recipe' }, { id: 'gluten-free', label: 'Gluten-free' }];
const milkOptions = [{ id: 'standard', label: 'Regular dairy' }, { id: 'lactose-free', label: 'Lactose-free dairy' }, { id: 'oat', label: 'Oat' }, { id: 'soy', label: 'Soy' }, { id: 'almond', label: 'Almond' }, { id: 'dairy-free', label: 'Other dairy-free' }];
const cheeseOptions = [{ id: 'fresh-soft', label: 'Fresh / soft cheese' }, { id: 'hard-aged', label: 'Hard / aged cheese' }, { id: 'lactose-free', label: 'Lactose-free cheese' }];

function makeIngredient(id: string, confidence: Confidence = 'inferred'): IngredientExposure {
  const known = ingredientCatalog.find(item => item.id === id) ?? findIngredientRecord(id);
  return { id, name: known?.name ?? id, confidence };
}

/** Resolve whole dish names before individual words, so peanut butter never becomes dairy. */
export function resolveFood(input: string, variant?: string): FoodResolution {
  const name = input.trim();
  const query = normalize(name);
  const variantText = normalize(variant ?? '');
  const glutenFree = /\bgluten free\b|\b(?:without|no) gluten\b/.test(`${query} ${variantText}`);
  const lactoseFree = /\blactose free\b/.test(`${query} ${variantText}`);
  const vegan = /\bvegan\b/.test(`${query} ${variantText}`);
  const decaf = /\b(?:decaf|decaffeinated|caffeine free)\b/.test(`${query} ${variantText}`);
  const alcoholFree = /\b(?:alcohol free|non alcoholic)\b/.test(`${query} ${variantText}`);
  const sugarFree = /\b(?:sugar free|diet|zero sugar)\b/.test(`${query} ${variantText}`);
  const dairyFree = vegan || /\b(?:dairy|milk) free\b|\b(?:without|no) (?:milk|dairy)\b/.test(`${query} ${variantText}`) || /^(oat|soy|almond)$/.test(variantText);
  const stripped = query.replace(/\b(?:gluten free|lactose free|dairy free|milk free|vegan|decaf|decaffeinated|caffeine free|alcohol free|non alcoholic|sugar free|diet|zero sugar)\b/g, '').replace(/\b(?:without|no)\s+.*$/, '').replace(/\s+/g, ' ').trim();
  const exactRecipe = RECIPES.find(item => item.names.includes(query));
  const recipe = exactRecipe ?? RECIPES.find(item => item.names.includes(stripped));
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
  if (dairyFree) ids = ids.filter(id => !['milk', 'lactose'].includes(id));
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
  if (/^(oat|soy|almond)$/.test(variantText)) ids.push(variantText === 'oat' ? 'oats' : variantText);
  const exclusions = query.match(/\b(?:without|no)\s+(.+)$/)?.[1].split(/,|\s+or\s+|\s+and\s+/).map(text => ingredientFromText(text).id) ?? [];
  ids = [...new Set(ids.filter(id => !exclusions.includes(id)))];
  if (exclusions.includes('milk')) ids = ids.filter(id => id !== 'lactose');

  const questions = [];
  if (recipe?.question === 'grain' && !glutenFree && !variant) questions.push({ id: 'grain', prompt: 'Which version did you have?', options: grainOptions });
  if (recipe?.question === 'milk' && !dairyFree && !lactoseFree && !variant) questions.push({ id: 'milk', prompt: 'Which milk or dairy was used?', options: milkOptions });
  if (recipe?.question === 'cola' && !sugarFree && !variant) questions.push({ id: 'cola', prompt: 'Which version did you drink?', options: [{ id: 'standard', label: 'Regular' }, { id: 'sugar-free', label: 'Diet / sugar-free' }] });
  if (recipe?.question === 'cheese' && !lactoseFree && !variant) questions.push({ id: 'cheese', prompt: 'Which kind of cheese was it?', options: cheeseOptions });
  const ingredients = ids.map(id => compositeIngredients.get(id) ?? makeIngredient(id));
  if (!ingredients.length && name) ingredients.push(ingredientFromText(name, 'inferred'));
  return {
    name, ingredients, questions, matched,
    description: matched
      ? 'Typical recipe only. Edit the ingredients and confirm what you actually ate; brands and recipes vary.'
      : 'No complete recipe match. This entry stays uncertain until you add or confirm its ingredients.',
  };
}
