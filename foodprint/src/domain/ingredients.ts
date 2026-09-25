import taxonomy from '../data/openFoodFactsIngredients.json';
import type { Confidence, IngredientExposure } from './types';

export interface IngredientRecord {
  id: string;
  name: string;
  aliases: string[];
  parents?: string[];
  description?: string;
  wikipedia?: string;
  vegan?: string;
  vegetarian?: string;
}

export interface IngredientInfo {
  id: string;
  name: string;
  aliases: string[];
  whatItIs: string;
  whereFound: string;
  symptomContext: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

export const normalizeIngredientText = (text: string) => text.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/[-–—]/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const CORE_ROWS: [string, string, string[]?][] = [
  ['wheat', 'Wheat', ['wheat flour', 'semolina', 'durum wheat', 'spelt', 'bulgur', 'couscous', 'gluten']],
  ['barley', 'Barley', ['barley malt', 'malt extract']], ['rye', 'Rye'], ['oats', 'Oats', ['oat', 'oat flour']],
  ['rice', 'Rice', ['rice flour', 'brown rice']], ['maize', 'Maize / corn', ['maize', 'corn', 'cornflour', 'corn starch', 'corn flour']],
  ['tapioca', 'Tapioca', ['tapioca starch']], ['potato', 'Potato', ['potatoes', 'potato starch']],
  ['milk', 'Milk', ['dairy', 'whole milk', 'skimmed milk', 'semi skimmed milk', 'semi-skimmed milk', 'skim milk', 'lactose free milk', 'milk powder', 'whole milk powder', 'skimmed milk powder', 'skim milk powder', 'milk solids', 'whey', 'whey powder', 'casein', 'caseinate', 'buttermilk', 'cream', 'double cream', 'single cream', 'cheese', 'parmesan', 'mozzarella', 'butter', 'ghee']],
  ['lactose', 'Lactose', ['milk sugar']], ['egg', 'Egg', ['eggs', 'egg white', 'egg yolk']],
  ['soy', 'Soy', ['soya', 'soybean', 'soya flour', 'soy flour', 'tofu', 'tempeh', 'edamame']],
  ['peanut', 'Peanut', ['peanuts', 'groundnut', 'peanut butter']], ['almond', 'Almond', ['almonds', 'almond butter']],
  ['hazelnut', 'Hazelnut', ['hazelnuts']], ['walnut', 'Walnut', ['walnuts']], ['cashew', 'Cashew', ['cashews', 'cashew butter']],
  ['coconut', 'Coconut', ['coconut milk', 'coconut cream', 'coconut oil']], ['sesame', 'Sesame', ['tahini', 'sesame seeds']],
  ['mustard', 'Mustard'], ['celery', 'Celery'], ['onion', 'Onion', ['onions', 'shallot', 'shallots', 'onion powder']],
  ['garlic', 'Garlic', ['garlic powder']], ['tomato', 'Tomato', ['tomatoes', 'tomato puree', 'passata']],
  ['carrot', 'Carrot', ['carrots']], ['broccoli', 'Broccoli'], ['cauliflower', 'Cauliflower'], ['mushroom', 'Mushroom', ['mushrooms']],
  ['spinach', 'Spinach'], ['pepper', 'Bell pepper', ['bell pepper', 'bell peppers', 'capsicum']], ['cucumber', 'Cucumber'],
  ['lettuce', 'Lettuce'], ['cabbage', 'Cabbage'], ['courgette', 'Courgette', ['zucchini']], ['aubergine', 'Aubergine', ['eggplant']],
  ['leek', 'Leek', ['leeks']], ['pea', 'Peas', ['peas', 'green peas']], ['sweetcorn', 'Sweetcorn'],
  ['lentil', 'Lentils', ['lentils']], ['chickpea', 'Chickpeas', ['chickpeas', 'chickpea flour', 'gram flour']],
  ['bean', 'Beans', ['kidney beans', 'black beans', 'white beans', 'haricot beans', 'baked beans']],
  ['apple', 'Apple', ['apples']], ['pear', 'Pear', ['pears']], ['banana', 'Banana', ['bananas']],
  ['orange', 'Orange', ['oranges']], ['lemon', 'Lemon', ['lemon juice']], ['lime', 'Lime'], ['grape', 'Grapes', ['grapes']],
  ['strawberry', 'Strawberries', ['strawberries']], ['blueberry', 'Blueberries', ['blueberries']], ['raspberry', 'Raspberries', ['raspberries']],
  ['mango', 'Mango'], ['avocado', 'Avocado'], ['date', 'Dates', ['dates']], ['raisin', 'Raisins', ['raisins']],
  ['beef', 'Beef'], ['chicken', 'Chicken'], ['pork', 'Pork', ['bacon', 'ham']], ['lamb', 'Lamb'], ['turkey', 'Turkey'],
  ['fish', 'Fish', ['salmon', 'tuna', 'cod', 'haddock', 'anchovy', 'anchovies']],
  ['shellfish', 'Shellfish', ['prawn', 'prawns', 'shrimp', 'crab', 'lobster', 'mussel', 'mussels']],
  ['olive-oil', 'Olive oil', ['extra virgin olive oil']], ['vegetable-oil', 'Vegetable oil', ['sunflower oil', 'rapeseed oil', 'canola oil']],
  ['sugar', 'Sugar', ['sucrose', 'cane sugar', 'brown sugar', 'glucose', 'glucose syrup']], ['honey', 'Honey'],
  ['maple', 'Maple syrup'], ['cocoa', 'Cocoa', ['cacao', 'cocoa powder']], ['coffee', 'Coffee', ['ground coffee', 'roast ground coffee', 'roasted ground coffee', 'instant coffee']], ['tea', 'Tea', ['black tea', 'green tea']],
  ['caffeine', 'Caffeine'], ['carbonation', 'Carbonation', ['carbon dioxide', 'carbonated water']],
  ['peppermint', 'Peppermint'], ['chamomile', 'Chamomile', ['camomile']],
  ['alcohol', 'Alcohol', ['ethanol']], ['sorbitol', 'Sorbitol', ['e420']], ['mannitol', 'Mannitol', ['e421']],
  ['xylitol', 'Xylitol', ['e967']], ['erythritol', 'Erythritol', ['e968']], ['inulin', 'Inulin', ['chicory root fibre', 'chicory root fiber']],
  ['yeast', 'Yeast'], ['salt', 'Salt'], ['vinegar', 'Vinegar'], ['chilli', 'Chilli', ['chili', 'chilli pepper']],
  ['ginger', 'Ginger'], ['cumin', 'Cumin'], ['coriander', 'Coriander', ['cilantro']], ['basil', 'Basil'], ['oregano', 'Oregano'],
  ['quinoa', 'Quinoa'], ['buckwheat', 'Buckwheat'], ['water', 'Water'],
  ['niacin', 'Niacin (vitamin B3)', ['niacin', 'vitamin b3', 'b3', 'nicotinic acid', 'nicotinamide', 'niacinamide']],
  ['thiamin', 'Thiamin (vitamin B1)', ['thiamin', 'thiamine', 'vitamin b1', 'b1', 'thiamine mononitrate']],
  ['riboflavin', 'Riboflavin (vitamin B2)', ['riboflavin', 'vitamin b2', 'b2']],
  ['pantothenic-acid', 'Pantothenic acid (vitamin B5)', ['pantothenic acid', 'vitamin b5', 'b5']],
  ['vitamin-b6', 'Vitamin B6', ['vitamin b6', 'b6', 'pyridoxine', 'pyridoxal']],
  ['biotin', 'Biotin (vitamin B7)', ['biotin', 'vitamin b7', 'b7']],
  ['folate', 'Folate (vitamin B9)', ['folate', 'folic acid', 'vitamin b9', 'b9']],
  ['vitamin-b12', 'Vitamin B12', ['vitamin b12', 'b12', 'cobalamin', 'cyanocobalamin']],
  ['vitamin-c', 'Vitamin C', ['vitamin c', 'ascorbic acid']], ['vitamin-d', 'Vitamin D', ['vitamin d', 'cholecalciferol', 'ergocalciferol']],
  ['iron', 'Iron', ['iron', 'ferrous fumarate', 'ferrous sulphate', 'ferrous sulfate']], ['calcium', 'Calcium', ['calcium']],
  ['sulphites', 'Sulphites', ['sulphites', 'sulfites', 'sulphur dioxide', 'sulfur dioxide', 'e220']],
];

const core = CORE_ROWS.map(([id, name, aliases = []]) => ({ id, name, aliases: [...new Set([name, ...aliases].map(normalizeIngredientText))] }));
const coreAliasOwner = new Map<string, IngredientRecord>();
for (const record of core) for (const alias of record.aliases) coreAliasOwner.set(alias, record);
const aliasOwner = new Map<string, IngredientRecord>();
for (const record of core) for (const alias of record.aliases) aliasOwner.set(alias, record);
const combined: IngredientRecord[] = [...core];
for (const raw of taxonomy.records as IngredientRecord[]) {
  const aliases = [...new Set([raw.name, ...raw.aliases].map(normalizeIngredientText).filter(Boolean))];
  const owner = aliases.map(alias => aliasOwner.get(alias)).find(Boolean);
  if (owner) {
    owner.aliases = [...new Set([...owner.aliases, ...aliases])];
    for (const alias of owner.aliases) if (!aliasOwner.has(alias)) aliasOwner.set(alias, owner);
    if (normalizeIngredientText(raw.name) === normalizeIngredientText(owner.name)) {
      owner.parents ||= raw.parents;
      owner.description ||= raw.description;
      owner.wikipedia ||= raw.wikipedia;
    }
    continue;
  }
  const record = { ...raw, aliases };
  combined.push(record);
  for (const alias of aliases) if (!aliasOwner.has(alias)) aliasOwner.set(alias, record);
}

export const ingredientCatalog: IngredientRecord[] = combined;
const byId = new Map(ingredientCatalog.map(record => [record.id, record]));
const searchableAliases = new Map<string, IngredientRecord>();
for (const record of ingredientCatalog) for (const alias of record.aliases) {
  if (alias.length >= 2 && !searchableAliases.has(alias)) searchableAliases.set(alias, record);
}
const maxAliasWords = Math.max(...[...searchableAliases.keys()].map(alias => alias.split(' ').length));

// These preparation/appearance words do not turn a food into a different
// substance for diary correlation. The parent relationship must also point to
// one of our curated food families, so an arbitrary shared word cannot merge
// unrelated records. Transformations such as oil, extract, flavouring,
// fermented or hydrolysed deliberately remain separate.
const FAMILY_MODIFIERS = new Set([
  'fresh', 'raw', 'dried', 'dry', 'dehydrated', 'freeze', 'frozen', 'freeze-dried',
  'whole', 'chopped', 'minced', 'sliced', 'crushed', 'ground', 'grated', 'peeled',
  'powder', 'powdered', 'puree', 'pureed', 'paste', 'roasted', 'toasted', 'cooked',
  'red', 'green', 'yellow', 'white', 'brown', 'orange', 'purple', 'ripe', 'unripe',
  'unsweetened', 'sweetened',
]);

function canonicalFamily(record: IngredientRecord): IngredientRecord {
  const nameWords = normalizeIngredientText(record.name).split(' ').filter(Boolean);
  for (const parent of record.parents ?? []) {
    const parentName = normalizeIngredientText(parent);
    const family = coreAliasOwner.get(parentName);
    if (!family) continue;
    const parentWords = parentName.split(' ');
    for (let start = 0; start <= nameWords.length - parentWords.length; start += 1) {
      if (!parentWords.every((word, index) => nameWords[start + index] === word)) continue;
      const modifiers = [...nameWords.slice(0, start), ...nameWords.slice(start + parentWords.length)];
      if (modifiers.length > 0 && modifiers.every(word => FAMILY_MODIFIERS.has(word))) return family;
    }
  }
  return record;
}

const exclusions = /^(?:gluten|dairy|lactose|milk|nut|nuts|sugar|alcohol|caffeine)\s+free$|^(?:free\s+from|without|no|no\s+added|does\s+not\s+contain)\b/;
const stripQualifiers = (value: string) => normalizeIngredientText(value
  .replace(/\b\d+(?:\.\d+)?\s*%\b/g, '')
  .replace(/\b(?:organic|pasteurised|pasteurized|fortified|enriched|fresh|raw|dried|dry|dehydrated|freeze[ -]dried|frozen|whole|chopped|minced|sliced|crushed|ground|grated|peeled|powdered|roasted|toasted|cooked|red|green|yellow|white|brown|orange|purple|ripe|unripe|unsweetened|sweetened|concentrated)\b/gi, ''));

export function findIngredientRecord(value: string, custom: IngredientRecord[] = []): IngredientRecord | undefined {
  const normalized = normalizeIngredientText(value);
  if (!normalized || exclusions.test(normalized)) return undefined;
  const clean = stripQualifiers(value.replace(/\([^)]*\)/g, '')).replace(/^gluten\s+free\s+/, '');
  const customMatch = custom.find(record => [record.name, ...record.aliases].some(alias => normalizeIngredientText(alias) === clean));
  const match = customMatch ?? aliasOwner.get(clean) ?? byId.get(clean) ?? byId.get(normalized.replace(/^en /, ''));
  return match && !customMatch ? canonicalFamily(match) : match;
}

/**
 * Match complete catalogue phrases rather than plucking individual words from prose.
 * Multi-ingredient OCR runs are accepted only when catalogue phrases cover most words.
 */
export function matchIngredientPhrases(value: string, custom: IngredientRecord[] = []): IngredientRecord[] {
  const normalized = normalizeIngredientText(value);
  if (!normalized || exclusions.test(normalized) || /\b(?:may contain|allergy advice|allergen information|free from|does not contain)\b/.test(normalized)) return [];
  const exact = findIngredientRecord(value, custom);
  if (exact) return [exact];
  const words = stripQualifiers(value).split(' ').filter(Boolean);
  const matches: { record: IngredientRecord; words: number }[] = [];
  let matchedWords = 0;
  for (let index = 0; index < words.length;) {
    let found: IngredientRecord | undefined;
    let used = 0;
    for (let size = Math.min(maxAliasWords, words.length - index); size > 0; size -= 1) {
      const phrase = words.slice(index, index + size).join(' ');
      found = custom.find(record => [record.name, ...record.aliases].some(alias => normalizeIngredientText(alias) === phrase)) ?? searchableAliases.get(phrase);
      if (found) { used = size; break; }
    }
    if (found) { matches.push({ record: canonicalFamily(found), words: used }); matchedWords += used; index += used; }
    else index += 1;
  }
  if (matches.length < 2 || matchedWords / Math.max(1, words.length) < 0.7) return [];
  return [...new Map(matches.map(match => [match.record.id, match.record])).values()];
}

function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) counts.set(a.slice(i, i + 2), (counts.get(a.slice(i, i + 2)) ?? 0) + 1);
  let overlap = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const pair = b.slice(i, i + 2); const count = counts.get(pair) ?? 0;
    if (count > 0) { overlap += 1; counts.set(pair, count - 1); }
  }
  return (2 * overlap) / (a.length + b.length - 2);
}

export function suggestIngredientRecords(value: string, limit = 5, custom: IngredientRecord[] = []): IngredientRecord[] {
  const query = normalizeIngredientText(value);
  if (query.length < 2) return [];
  const ranked = [...custom, ...ingredientCatalog].map(record => {
    const score = Math.max(...[record.name, ...record.aliases].map(alias => {
      const candidate = normalizeIngredientText(alias);
      const containment = candidate.includes(query) || query.includes(candidate) ? Math.min(candidate.length, query.length) / Math.max(candidate.length, query.length) : 0;
      return Math.max(containment, diceSimilarity(query, candidate));
    }));
    return { record, score };
  }).filter(item => item.score >= 0.36).sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name));
  const distinct = new Map<string, IngredientRecord>();
  for (const item of ranked) {
    const record = custom.includes(item.record) ? item.record : canonicalFamily(item.record);
    if (!distinct.has(record.id)) distinct.set(record.id, record);
    if (distinct.size >= limit) break;
  }
  return [...distinct.values()];
}

export function ingredientFromText(text: string, confidence: Confidence = 'confirmed', custom: IngredientRecord[] = []): IngredientExposure {
  const known = findIngredientRecord(text, custom);
  const clean = normalizeIngredientText(text);
  return known ? { id: known.id, name: known.name, confidence } : {
    id: `custom-${clean.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ingredient'}`,
    name: text.trim(), confidence,
  };
}

export function ingredientsFromNames(names: string[], confidence: Confidence = 'confirmed', custom: IngredientRecord[] = []): IngredientExposure[] {
  return [...new Map(names.map(name => name.trim()).filter(Boolean).map(name => {
    const ingredient = ingredientFromText(name, confidence, custom);
    return [ingredient.id, ingredient] as const;
  })).values()];
}

const PROFILE: Record<string, Pick<IngredientInfo, 'whatItIs' | 'whereFound' | 'symptomContext' | 'sourceTitle' | 'sourceUrl'>> = {
  lactose: { whatItIs: 'Lactose is the natural sugar in milk and dairy foods.', whereFound: 'Milk, yoghurt, soft cheese, cream and foods made with milk.', symptomContext: 'When the small intestine makes too little lactase, lactose can reach the colon and cause wind, bloating, diarrhoea or abdominal discomfort. Amount and tolerance vary.', sourceTitle: 'NHS: Lactose intolerance', sourceUrl: 'https://www.nhs.uk/conditions/lactose-intolerance/' },
  wheat: { whatItIs: 'Wheat is a cereal grain. It contains gluten as well as other proteins and fermentable carbohydrates.', whereFound: 'Bread, pasta, pastry, many cereals, sauces and processed foods.', symptomContext: 'Several different conditions can be associated with wheat, including coeliac disease, wheat allergy and non-coeliac symptoms. A diary cannot distinguish them, and testing for coeliac disease should happen before removing gluten.', sourceTitle: 'NHS: Coeliac disease', sourceUrl: 'https://www.nhs.uk/conditions/coeliac-disease/' },
  caffeine: { whatItIs: 'Caffeine is a stimulant naturally present in coffee, tea and cocoa and added to some drinks and medicines.', whereFound: 'Coffee, tea, cola, energy drinks, chocolate and some medicines.', symptomContext: 'Sensitivity varies. Larger amounts can contribute to restlessness, sleep difficulty, palpitations, anxiety or digestive upset.', sourceTitle: 'Food Standards Agency: Caffeine', sourceUrl: 'https://www.food.gov.uk/safety-hygiene/food-supplements' },
  sorbitol: { whatItIs: 'Sorbitol is a sugar alcohol used as a sweetener and found naturally in some fruit.', whereFound: 'Sugar-free sweets and gum, some medicines, apples, pears and stone fruit.', symptomContext: 'Sugar alcohols are incompletely absorbed in some people and can contribute to wind, bloating or diarrhoea, especially in larger amounts.', sourceTitle: 'NHS: Food intolerance', sourceUrl: 'https://www.nhs.uk/conditions/food-intolerance/' },
  niacin: { whatItIs: 'Niacin is vitamin B3, a water-soluble vitamin used in energy metabolism. “Niacin”, “vitamin B3” and “B3” are stored as one ingredient.', whereFound: 'Meat, fish, nuts, grains and foods fortified with vitamins.', symptomContext: 'Niacin in ordinary food is not a common intolerance trigger. High-dose nicotinic-acid supplements can cause flushing and other adverse effects; supplement doses are different from normal food exposure.', sourceTitle: 'NIH: Niacin fact sheet', sourceUrl: 'https://ods.od.nih.gov/factsheets/Niacin-Consumer/' },
};

export function getIngredientInfo(id: string, fallbackName?: string): IngredientInfo {
  const record = byId.get(id) ?? ingredientCatalog.find(item => item.name === fallbackName);
  const profile = PROFILE[id];
  const name = record?.name ?? fallbackName ?? id;
  return {
    id, name, aliases: record?.aliases ?? [],
    whatItIs: profile?.whatItIs ?? record?.description ?? `${name} is a recognised entry in the Open Food Facts ingredient taxonomy.`,
    whereFound: profile?.whereFound ?? (record?.parents?.length ? `Related ingredient groups: ${record.parents.join(', ')}.` : 'Where it appears depends on the product and recipe. Check the exact label.'),
    symptomContext: profile?.symptomContext ?? 'This ingredient is not automatically a cause of symptoms. Bellywise only shows associations in your own completed diary, and foods eaten together can produce the same signal.',
    sourceTitle: profile?.sourceTitle, sourceUrl: profile?.sourceUrl,
  };
}

export const ingredientCatalogMetadata = { source: taxonomy.source, license: taxonomy.license, revision: taxonomy.revision, count: ingredientCatalog.length };
