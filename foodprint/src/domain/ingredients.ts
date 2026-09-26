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
  triggerLevel: 'recognised' | 'possible' | 'not-common' | 'unknown';
  triggerSummary: string;
  commonSymptoms: string[];
  symptomContext: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

export const normalizeIngredientText = (text: string) => text.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/[-–—]/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const CORE_ROWS: [string, string, string[]?][] = [
  ['wheat', 'Wheat', ['wheat flour', 'semolina', 'durum wheat', 'spelt', 'bulgur', 'couscous']],
  ['gluten', 'Gluten', ['wheat gluten', 'vital wheat gluten']],
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

function inflectionCandidates(value: string): string[] {
  const words = value.split(' ');
  const last = words.pop() ?? '';
  const stems = new Set<string>();
  if (/[^aeiou]ies$/.test(last)) stems.add(`${last.slice(0, -3)}y`);
  if (/(?:ches|shes|sses|xes|zes|oes)$/.test(last)) stems.add(last.slice(0, -2));
  if (last.endsWith('s') && !/(?:ss|us|is)$/.test(last)) stems.add(last.slice(0, -1));
  return [...stems].filter(Boolean).map(candidate => [...words, candidate].join(' '));
}

export function findIngredientRecord(value: string, custom: IngredientRecord[] = []): IngredientRecord | undefined {
  const normalized = normalizeIngredientText(value);
  if (!normalized || exclusions.test(normalized)) return undefined;
  const clean = stripQualifiers(value.replace(/\([^)]*\)/g, '')).replace(/^gluten\s+free\s+/, '');
  const candidates = [clean, ...inflectionCandidates(clean)];
  const customMatch = custom.find(record => [record.name, ...record.aliases].some(alias => candidates.includes(normalizeIngredientText(alias))));
  const match = customMatch ?? candidates.map(candidate => aliasOwner.get(candidate)).find(Boolean) ?? byId.get(clean) ?? byId.get(normalized.replace(/^en /, ''));
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

/**
 * Add well-established components for pattern analysis without presenting them
 * as literal label ingredients. Gluten is present in wheat, barley and rye;
 * an explicit gluten-free entry never contains those source grains here.
 */
export function expandIngredientExposuresForAnalysis(ingredients: IngredientExposure[]): IngredientExposure[] {
  const expanded = new Map<string, IngredientExposure>();
  const add = (ingredient: IngredientExposure) => {
    const previous = expanded.get(ingredient.id);
    expanded.set(ingredient.id, previous?.confidence === 'confirmed'
      ? previous
      : { ...ingredient, confidence: ingredient.confidence === 'confirmed' ? 'confirmed' : previous?.confidence ?? ingredient.confidence });
  };
  for (const ingredient of ingredients) {
    add(ingredient);
    if (['wheat', 'barley', 'rye'].includes(ingredient.id)) add({ id: 'gluten', name: 'Gluten', confidence: ingredient.confidence });
  }
  return [...expanded.values()];
}

type IngredientProfile = Pick<IngredientInfo, 'triggerLevel' | 'triggerSummary' | 'commonSymptoms' | 'symptomContext' | 'sourceTitle' | 'sourceUrl'>
  & Partial<Pick<IngredientInfo, 'whatItIs' | 'whereFound'>>;

const IBS_SOURCE = { sourceTitle: 'NIDDK: Eating, diet and nutrition for IBS', sourceUrl: 'https://www.niddk.nih.gov/health-information/digestive-diseases/irritable-bowel-syndrome/eating-diet-nutrition' };
const ALLERGY_SOURCE = { sourceTitle: 'NHS: Food allergy symptoms', sourceUrl: 'https://www.nhs.uk/conditions/food-allergy/' };
const FODMAP_SYMPTOMS = ['Bloating', 'Wind', 'Abdominal pain or cramps', 'Diarrhoea or constipation'];

const PROFILE: Record<string, IngredientProfile> = {
  gluten: { whatItIs: 'Gluten is a group of proteins found in wheat, barley and rye.', whereFound: 'Foods containing wheat, barley or rye, including most bread, pasta, cakes, many cereals, some sauces and most beer.', triggerLevel: 'recognised', triggerSummary: 'A medically recognised trigger in coeliac disease and a reported trigger in non-coeliac gluten sensitivity.', commonSymptoms: ['Diarrhoea or constipation', 'Abdominal pain', 'Bloating and wind', 'Indigestion', 'Tiredness'], symptomContext: 'Coeliac disease is an autoimmune condition, not a food intolerance or allergy. Wheat can also cause symptoms through wheat allergy or fermentable fructans, so a diary link with gluten cannot identify the mechanism. Ask a clinician about coeliac testing before removing gluten, because testing is less reliable after starting a gluten-free diet.', sourceTitle: 'NHS: Coeliac disease', sourceUrl: 'https://www.nhs.uk/conditions/coeliac-disease/' },
  lactose: { whatItIs: 'Lactose is the natural sugar in milk and dairy foods.', whereFound: 'Milk, yoghurt, soft cheese, cream and foods made with milk.', triggerLevel: 'recognised', triggerSummary: 'A well-established digestive trigger in people who make too little lactase.', commonSymptoms: ['Bloating', 'Wind', 'Abdominal pain or rumbling', 'Diarrhoea or constipation', 'Nausea'], symptomContext: 'Undigested lactose can reach the colon, draw in fluid and ferment. Symptoms depend on the amount eaten and the person’s remaining lactase activity; many people tolerate some lactose.', sourceTitle: 'NHS: Lactose intolerance', sourceUrl: 'https://www.nhs.uk/conditions/lactose-intolerance/' },
  milk: { whatItIs: 'Milk contains lactose sugar and milk proteins. These can be involved in different kinds of reaction.', whereFound: 'Milk, yoghurt, cream, soft cheese, butter and many processed foods.', triggerLevel: 'recognised', triggerSummary: 'A well-known symptom trigger for some people, with lactose intolerance and milk allergy being different conditions.', commonSymptoms: ['Bloating, wind or abdominal pain', 'Diarrhoea or nausea', 'Itching, hives or swelling in allergy', 'Cough or wheeze in allergy'], symptomContext: 'Lactose intolerance mainly causes digestive symptoms and often depends on dose. Milk-protein allergy can affect the skin or breathing and may be serious. A diary cannot tell these mechanisms apart.', sourceTitle: 'NHS: Lactose intolerance and milk allergy', sourceUrl: 'https://www.nhs.uk/conditions/lactose-intolerance/' },
  wheat: { whatItIs: 'Wheat is a cereal grain. It contains gluten as well as other proteins and fermentable carbohydrates.', whereFound: 'Bread, pasta, pastry, many cereals, sauces and processed foods.', triggerLevel: 'recognised', triggerSummary: 'A well-known trigger, but several different mechanisms can be responsible.', commonSymptoms: FODMAP_SYMPTOMS, symptomContext: 'Wheat fructans can aggravate gut symptoms in some people with IBS. Coeliac disease and wheat allergy are different conditions and may cause other symptoms. A diary cannot distinguish them, and coeliac testing should happen before removing gluten.', sourceTitle: 'NHS: Coeliac disease', sourceUrl: 'https://www.nhs.uk/conditions/coeliac-disease/' },
  caffeine: { whatItIs: 'Caffeine is a stimulant naturally present in coffee, tea and cocoa and added to some drinks and medicines.', whereFound: 'Coffee, tea, cola, energy drinks, chocolate and some medicines.', triggerLevel: 'recognised', triggerSummary: 'A recognised dose-related trigger for some people.', commonSymptoms: ['Restlessness or jitteriness', 'Sleep difficulty', 'Palpitations', 'Anxiety', 'Digestive upset'], symptomContext: 'Sensitivity varies considerably. The amount, timing, medicines and other ingredients in a caffeinated product can all affect symptoms.', sourceTitle: 'Food Standards Agency: Caffeine', sourceUrl: 'https://www.food.gov.uk/safety-hygiene/food-supplements' },
  sorbitol: { whatItIs: 'Sorbitol is a sugar alcohol used as a sweetener and found naturally in some fruit.', whereFound: 'Sugar-free sweets and gum, some medicines, apples, pears and stone fruit.', triggerLevel: 'recognised', triggerSummary: 'A recognised fermentable-carbohydrate trigger for some people.', commonSymptoms: FODMAP_SYMPTOMS, symptomContext: 'Sorbitol can be incompletely absorbed and can draw water into the bowel and ferment, especially at larger amounts.', ...IBS_SOURCE },
  niacin: { whatItIs: 'Niacin is vitamin B3, a water-soluble vitamin used in energy metabolism. “Niacin”, “vitamin B3” and “B3” are stored as one ingredient.', whereFound: 'Meat, fish, nuts, grains and foods fortified with vitamins.', triggerLevel: 'not-common', triggerSummary: 'Not a common intolerance trigger at the amounts normally present in food.', commonSymptoms: [], symptomContext: 'High-dose nicotinic-acid supplements can cause flushing, itching, headache or dizziness, but supplement doses are very different from ordinary food exposure.', sourceTitle: 'NIH: Niacin fact sheet', sourceUrl: 'https://ods.od.nih.gov/factsheets/Niacin-Consumer/' },
};

const FRUCTAN_IDS = new Set(['garlic', 'onion', 'leek', 'barley', 'rye']);
const OTHER_FODMAP_IDS = new Set(['apple', 'pear', 'mango', 'honey', 'cabbage', 'cauliflower', 'mushroom', 'lentil', 'chickpea', 'bean', 'pea']);
const POLYOL_IDS = new Set(['mannitol', 'xylitol', 'erythritol']);
const ALLERGEN_IDS = new Set(['milk', 'egg', 'soy', 'peanut', 'almond', 'hazelnut', 'walnut', 'cashew', 'sesame', 'mustard', 'celery', 'fish', 'shellfish']);
const MICRONUTRIENT_IDS = new Set(['thiamin', 'riboflavin', 'pantothenic-acid', 'vitamin-b6', 'biotin', 'folate', 'vitamin-b12', 'vitamin-c', 'vitamin-d', 'iron', 'calcium']);

function relatedTerms(id: string, record?: IngredientRecord): Set<string> {
  return new Set([id, record?.name, ...(record?.parents ?? [])].filter(Boolean).map(value => normalizeIngredientText(String(value)).replace(/^off /, '')));
}

function inferredProfile(id: string, record?: IngredientRecord): IngredientProfile {
  const terms = relatedTerms(id, record);
  const relatedTo = (...values: string[]) => values.some(value => terms.has(normalizeIngredientText(value)));
  const normalizedName = normalizeIngredientText(record?.name ?? id);
  const materiallyTransformed = /\b(?:oil|extract|flavou?r(?:ing)?|protein isolate|hydrolys(?:ed|ate))\b/.test(normalizedName);
  if (FRUCTAN_IDS.has(id) || (!materiallyTransformed && relatedTo('garlic', 'onion', 'leek', 'barley', 'rye'))) return {
    triggerLevel: 'recognised', triggerSummary: 'A recognised source of fermentable carbohydrates that can trigger symptoms in some people with IBS.', commonSymptoms: FODMAP_SYMPTOMS,
    symptomContext: 'Fructans can be poorly absorbed and then fermented in the bowel. Portion size and the total amount of similar carbohydrates eaten that day can change the response.', ...IBS_SOURCE,
  };
  if (OTHER_FODMAP_IDS.has(id) || relatedTo('legume', 'pulse')) return {
    triggerLevel: 'possible', triggerSummary: 'Known to contain carbohydrates that can trigger gut symptoms in some people with IBS.', commonSymptoms: FODMAP_SYMPTOMS,
    symptomContext: 'Tolerance is individual and often depends on portion size, ripeness, processing and other fermentable foods eaten at the same time.', ...IBS_SOURCE,
  };
  if (POLYOL_IDS.has(id) || relatedTo('sugar alcohol', 'polyol')) return {
    triggerLevel: 'recognised', triggerSummary: 'A recognised dose-related digestive trigger for some people.', commonSymptoms: FODMAP_SYMPTOMS,
    symptomContext: 'Sugar alcohols can be incompletely absorbed, draw water into the bowel and ferment. Larger servings are more likely to cause symptoms.', ...IBS_SOURCE,
  };
  if (ALLERGEN_IDS.has(id) || (!materiallyTransformed && relatedTo('tree nut', 'crustacean', 'mollusc'))) return {
    triggerLevel: 'recognised', triggerSummary: 'A recognised food allergen for some people; food allergy is different from food intolerance.', commonSymptoms: ['Itching or hives', 'Swelling of the lips, face or throat', 'Vomiting or diarrhoea', 'Cough, wheeze or breathing difficulty'],
    symptomContext: 'Allergic reactions can be rapid and serious. Bellywise diary correlations cannot diagnose allergy and should never be used to test a food that has caused swelling or breathing symptoms.', ...ALLERGY_SOURCE,
  };
  if (id === 'inulin' || relatedTo('inulin', 'chicory root fibre', 'chicory root fiber')) return {
    triggerLevel: 'recognised', triggerSummary: 'A highly fermentable fibre that can trigger gut symptoms in some people.', commonSymptoms: FODMAP_SYMPTOMS,
    symptomContext: 'Inulin is fermented by gut bacteria. The amount eaten and how quickly fibre intake increased can strongly affect symptoms.', ...IBS_SOURCE,
  };
  if (id === 'sulphites' || relatedTo('sulphite', 'sulfite', 'sulphur dioxide', 'sulfur dioxide')) return {
    triggerLevel: 'recognised', triggerSummary: 'A recognised sensitivity trigger, particularly for some people with asthma.', commonSymptoms: ['Wheezing or cough', 'Chest tightness', 'Hives or flushing', 'Digestive upset'],
    symptomContext: 'This is not the same as a typical food intolerance. Breathing symptoms need medical advice, and sudden or severe breathing difficulty needs emergency help.', sourceTitle: 'NHS: Food intolerance', sourceUrl: 'https://www.nhs.uk/conditions/food-intolerance/',
  };
  if (id === 'carbonation' || relatedTo('carbonated water')) return {
    triggerLevel: 'possible', triggerSummary: 'Can cause upper-gut symptoms through swallowed carbon dioxide rather than an intolerance.', commonSymptoms: ['Belching', 'Bloating', 'Fullness or discomfort'],
    symptomContext: 'Serving size, drinking speed and other ingredients in the drink may matter more than carbonation alone.', sourceTitle: 'NHS: Bloating', sourceUrl: 'https://www.nhs.uk/conditions/bloating/',
  };
  if (id === 'chilli' || relatedTo('chilli', 'chili pepper')) return {
    triggerLevel: 'possible', triggerSummary: 'Spicy foods can aggravate digestive symptoms in some people, especially with IBS or reflux.', commonSymptoms: ['Heartburn or burning', 'Abdominal pain', 'Urgency or diarrhoea'],
    symptomContext: 'Capsaicin produces heat and irritation rather than a classic intolerance. Amount and an individual’s usual exposure can affect the response.', sourceTitle: 'NHS: IBS symptoms and triggers', sourceUrl: 'https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/symptoms/',
  };
  if (id === 'alcohol') return {
    triggerLevel: 'possible', triggerSummary: 'Alcohol can aggravate digestive and other symptoms in some people.', commonSymptoms: ['Abdominal pain or diarrhoea', 'Bloating', 'Flushing', 'Headache or nausea'],
    symptomContext: 'Amount matters, and wine, beer and mixed drinks contain other possible triggers such as sulphites, grains, fruit, carbonation or sweeteners.', sourceTitle: 'NHS: IBS symptoms and triggers', sourceUrl: 'https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/symptoms/',
  };
  if (/\boil\b/.test(normalizedName) || relatedTo('vegetable oil', 'oil', 'fat')) return {
    triggerLevel: 'possible', triggerSummary: 'The ingredient itself is not a common intolerance, although a high-fat meal can aggravate symptoms in some people.', commonSymptoms: ['Fullness or nausea', 'Abdominal discomfort', 'Diarrhoea in some people'],
    symptomContext: 'The total meal, portion and cooking method are usually more informative than a small amount of this ingredient.', sourceTitle: 'NHS: IBS diet advice', sourceUrl: 'https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/diet-lifestyle-and-medicines/',
  };
  if (relatedTo('dietary fibre', 'dietary fiber', 'vegetable fibre', 'vegetable fiber', 'fibre', 'fiber')) return {
    triggerLevel: 'possible', triggerSummary: 'Fibre can alter bowel symptoms, particularly when the amount changes quickly.', commonSymptoms: ['Wind', 'Bloating', 'Cramping', 'A change in stool frequency or consistency'],
    symptomContext: 'Different fibres behave differently. Portion size, fluid intake and a gradual increase can affect tolerance.', ...IBS_SOURCE,
  };
  if (MICRONUTRIENT_IDS.has(id)) return {
    triggerLevel: 'not-common', triggerSummary: 'Not widely recognised as an intolerance trigger at ordinary food-fortification amounts.', commonSymptoms: [],
    symptomContext: 'Concentrated supplements can have dose-related side effects that do not apply to the much smaller amounts normally present in food. Record a supplement separately if that is what you took.', sourceTitle: 'NHS: Vitamins and minerals', sourceUrl: 'https://www.nhs.uk/conditions/vitamins-and-minerals/',
  };
  if (!record) return {
    triggerLevel: 'unknown', triggerSummary: 'There is not enough reliable catalogue information to classify this personal ingredient.', commonSymptoms: [],
    symptomContext: 'Check the spelling and exact substance. Bellywise can still compare it with your diary, but it cannot provide a trustworthy general symptom profile for an unrecognised entry.',
  };
  return {
    triggerLevel: 'not-common', triggerSummary: `${record.name} is not widely recognised as a common food-intolerance trigger at normal food amounts.`, commonSymptoms: [],
    symptomContext: 'No characteristic intolerance symptom pattern is established for this ingredient itself. If your diary repeatedly links it with symptoms, consider the portion, preparation and other ingredients eaten alongside it.',
  };
}

export function getIngredientInfo(id: string, fallbackName?: string): IngredientInfo {
  const record = byId.get(id) ?? ingredientCatalog.find(item => item.name === fallbackName);
  const profile = PROFILE[id] ?? inferredProfile(id, record);
  const name = record?.name ?? fallbackName ?? id;
  return {
    id, name, aliases: record?.aliases ?? [],
    whatItIs: profile?.whatItIs ?? record?.description ?? `${name} is a recognised entry in the Open Food Facts ingredient taxonomy.`,
    whereFound: profile?.whereFound ?? (record?.parents?.length ? `Related ingredient groups: ${record.parents.join(', ')}.` : 'Where it appears depends on the product and recipe. Check the exact label.'),
    triggerLevel: profile.triggerLevel, triggerSummary: profile.triggerSummary, commonSymptoms: profile.commonSymptoms, symptomContext: profile.symptomContext,
    sourceTitle: profile?.sourceTitle, sourceUrl: profile?.sourceUrl,
  };
}

export const ingredientCatalogMetadata = { source: taxonomy.source, license: taxonomy.license, revision: taxonomy.revision, count: ingredientCatalog.length };
