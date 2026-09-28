export interface Recipe { names: string[]; ingredients: string[]; question?: 'grain' | 'milk' | 'cola' | 'cheese' }
/** Typical editable recipes, never a substitute for a scanned product's actual label. */
export const extraRecipes: Recipe[] = [
  { names: ['macaroni cheese', 'macaroni and cheese', 'mac and cheese', 'mac n cheese', 'mac cheese'], ingredients: ['wheat', 'milk', 'butter', 'cheese', 'lactose'], question: 'grain' },
  { names: ['fudge', 'vanilla fudge', 'butter fudge', 'clotted cream fudge', 'scottish tablet', 'tablet'], ingredients: ['sugar', 'milk', 'butter', 'lactose'] },
  { names: ['chocolate fudge'], ingredients: ['sugar', 'milk', 'butter', 'cocoa', 'lactose'] },
  { names: ['toffee', 'butterscotch', 'caramel sweets'], ingredients: ['sugar', 'butter', 'milk', 'lactose'] },
  { names: ['turkish delight'], ingredients: ['sugar', 'maize'] },
  { names: ['jelly sweets', 'gummy sweets', 'gummy bears', 'jelly babies', 'wine gums', 'fruit gums'], ingredients: ['sugar', 'gelatine'] },
  { names: ['marshmallow', 'marshmallows'], ingredients: ['sugar', 'gelatine', 'maize'] },
  { names: ['boiled sweets', 'hard candy', 'lollipop', 'lollipops'], ingredients: ['sugar'] },
  { names: ['baklava'], ingredients: ['wheat', 'butter', 'pistachio', 'walnut', 'honey'] },
  { names: ['rice pudding'], ingredients: ['rice', 'milk', 'sugar', 'lactose'] },
  { names: ['bread and butter pudding'], ingredients: ['wheat', 'butter', 'milk', 'egg', 'raisin', 'sugar', 'lactose'] },
  { names: ['sticky toffee pudding'], ingredients: ['wheat', 'date', 'egg', 'butter', 'cream', 'sugar', 'lactose'] },
  { names: ['apple crumble'], ingredients: ['apple', 'wheat', 'butter', 'sugar'] },
  { names: ['custard'], ingredients: ['milk', 'egg', 'sugar', 'maize', 'lactose'] },
  { names: ['cheesecake'], ingredients: ['cream-cheese', 'wheat', 'butter', 'sugar', 'lactose'] },
  { names: ['tiramisu'], ingredients: ['cream-cheese', 'wheat', 'egg', 'coffee', 'cocoa', 'sugar', 'lactose'] },
  { names: ['millionaires shortbread', 'caramel shortbread'], ingredients: ['wheat', 'butter', 'milk', 'sugar', 'cocoa', 'lactose'] },
  { names: ['shortbread'], ingredients: ['wheat', 'butter', 'sugar'] },
  { names: ['flapjack', 'flapjacks'], ingredients: ['oats', 'butter', 'sugar'] },
  { names: ['scone', 'scones'], ingredients: ['wheat', 'butter', 'milk', 'lactose'] },
  { names: ['doughnut', 'doughnuts', 'donut', 'donuts'], ingredients: ['wheat', 'milk', 'egg', 'sugar', 'yeast', 'vegetable-oil'] },
  { names: ['brownie', 'brownies'], ingredients: ['wheat', 'egg', 'butter', 'sugar', 'cocoa'] },
  { names: ['banana bread'], ingredients: ['banana', 'wheat', 'egg', 'butter', 'sugar'] },
  { names: ['carrot cake'], ingredients: ['carrot', 'wheat', 'egg', 'walnut', 'vegetable-oil', 'sugar'] },
  { names: ['victoria sponge', 'sponge cake'], ingredients: ['wheat', 'egg', 'butter', 'sugar', 'strawberry'] },
  { names: ['sausage roll', 'sausage rolls'], ingredients: ['wheat', 'pork', 'butter', 'egg'], question: 'grain' },
  { names: ['cornish pasty', 'beef pasty'], ingredients: ['wheat', 'beef', 'potato', 'onion', 'butter'], question: 'grain' },
  { names: ['steak pie', 'beef pie', 'steak and ale pie'], ingredients: ['wheat', 'beef', 'onion', 'butter'], question: 'grain' },
  { names: ['chicken pie', 'chicken and mushroom pie'], ingredients: ['wheat', 'chicken', 'mushroom', 'milk', 'butter', 'lactose'], question: 'grain' },
  { names: ['quiche', 'quiche lorraine'], ingredients: ['wheat', 'egg', 'cream', 'cheese', 'pork', 'lactose'], question: 'grain' },
  { names: ['cauliflower cheese'], ingredients: ['cauliflower', 'cheese', 'milk', 'butter', 'wheat', 'lactose'] },
  { names: ['fish pie'], ingredients: ['fish', 'potato', 'milk', 'butter', 'lactose'] },
  { names: ['bangers and mash', 'sausage and mash'], ingredients: ['pork', 'wheat', 'potato', 'milk', 'butter', 'onion'] },
  { names: ['toad in the hole'], ingredients: ['pork', 'wheat', 'egg', 'milk', 'lactose'] },
  { names: ['full english', 'english breakfast', 'fry up'], ingredients: ['pork', 'egg', 'wheat', 'bean', 'tomato', 'mushroom', 'vegetable-oil'] },
  { names: ['eggs benedict'], ingredients: ['wheat', 'egg', 'butter', 'pork'] },
  { names: ['shakshuka'], ingredients: ['egg', 'tomato', 'pepper', 'onion', 'garlic', 'cumin'] },
  { names: ['chilli con carne', 'chili con carne', 'beef chilli'], ingredients: ['beef', 'bean', 'tomato', 'onion', 'garlic', 'chilli', 'cumin'] },
  { names: ['chilli sin carne', 'vegetarian chilli'], ingredients: ['bean', 'tomato', 'pepper', 'onion', 'garlic', 'chilli'] },
  { names: ['chicken fajitas', 'fajitas'], ingredients: ['chicken', 'wheat', 'pepper', 'onion', 'chilli'], question: 'grain' },
  { names: ['beef burrito', 'burrito'], ingredients: ['beef', 'wheat', 'rice', 'bean', 'tomato', 'onion', 'cheese'], question: 'grain' },
  { names: ['nachos'], ingredients: ['maize', 'cheese', 'tomato', 'chilli'] },
  { names: ['quesadilla', 'cheese quesadilla'], ingredients: ['wheat', 'cheese'], question: 'grain' },
  { names: ['guacamole'], ingredients: ['avocado', 'lime', 'onion', 'tomato'] },
  { names: ['salsa'], ingredients: ['tomato', 'onion', 'chilli', 'lime'] },
  { names: ['chicken korma', 'korma'], ingredients: ['chicken', 'yoghurt', 'cream', 'almond', 'onion', 'garlic', 'ginger', 'lactose'] },
  { names: ['chicken tikka masala', 'tikka masala'], ingredients: ['chicken', 'tomato', 'yoghurt', 'cream', 'onion', 'garlic', 'ginger', 'lactose'] },
  { names: ['butter chicken', 'murgh makhani'], ingredients: ['chicken', 'butter', 'cream', 'tomato', 'onion', 'garlic', 'ginger', 'lactose'] },
  { names: ['dhal', 'dal', 'daal', 'tarka dal'], ingredients: ['lentil', 'onion', 'garlic', 'ginger', 'cumin', 'vegetable-oil'] },
  { names: ['chana masala', 'chickpea curry'], ingredients: ['chickpea', 'tomato', 'onion', 'garlic', 'ginger', 'cumin'] },
  { names: ['saag paneer', 'palak paneer'], ingredients: ['spinach', 'cheese', 'onion', 'garlic', 'cream', 'lactose'] },
  { names: ['onion bhaji', 'onion bhajis'], ingredients: ['onion', 'chickpea', 'cumin', 'vegetable-oil'] },
  { names: ['vegetable samosa', 'samosa'], ingredients: ['wheat', 'potato', 'pea', 'onion', 'vegetable-oil'] },
  { names: ['naan', 'naan bread'], ingredients: ['wheat', 'yoghurt', 'yeast'], question: 'grain' },
  { names: ['chapati', 'roti'], ingredients: ['wheat', 'vegetable-oil'], question: 'grain' },
  { names: ['egg fried rice', 'fried rice'], ingredients: ['rice', 'egg', 'soy', 'vegetable-oil'] },
  { names: ['chicken chow mein', 'chow mein'], ingredients: ['wheat', 'egg', 'chicken', 'soy', 'onion'], question: 'grain' },
  { names: ['sweet and sour chicken'], ingredients: ['chicken', 'wheat', 'sugar', 'vinegar', 'pepper', 'pineapple'] },
  { names: ['pad thai'], ingredients: ['rice', 'egg', 'peanut', 'shellfish', 'fish', 'soy'] },
  { names: ['thai green curry', 'green curry'], ingredients: ['chicken', 'coconut', 'chilli', 'garlic', 'ginger', 'fish'] },
  { names: ['thai red curry', 'red curry'], ingredients: ['chicken', 'coconut', 'chilli', 'garlic', 'ginger', 'fish'] },
  { names: ['ramen'], ingredients: ['wheat', 'soy', 'egg', 'pork', 'garlic'], question: 'grain' },
  { names: ['miso soup'], ingredients: ['soy', 'seaweed'] },
  { names: ['falafel'], ingredients: ['chickpea', 'onion', 'garlic', 'cumin', 'coriander'] },
  { names: ['hummus', 'houmous', 'humous'], ingredients: ['chickpea', 'sesame', 'garlic', 'lemon', 'olive-oil'] },
  { names: ['tzatziki'], ingredients: ['yoghurt', 'cucumber', 'garlic', 'lactose'] },
  { names: ['greek salad'], ingredients: ['tomato', 'cucumber', 'onion', 'cheese', 'olive-oil'] },
  { names: ['caesar salad', 'chicken caesar salad'], ingredients: ['lettuce', 'chicken', 'wheat', 'egg', 'fish', 'cheese'] },
  { names: ['coleslaw'], ingredients: ['cabbage', 'carrot', 'onion', 'egg', 'vinegar'] },
  { names: ['mushroom risotto', 'risotto'], ingredients: ['rice', 'mushroom', 'onion', 'garlic', 'butter', 'cheese'] },
  { names: ['tomato soup'], ingredients: ['tomato', 'onion', 'carrot', 'vegetable-oil'] },
  { names: ['leek and potato soup'], ingredients: ['leek', 'potato', 'onion', 'milk', 'lactose'] },
  { names: ['lentil soup'], ingredients: ['lentil', 'carrot', 'onion', 'celery'] },
];

// Regional names refer to the same editable recipe; longest whole dish matching happens first.
const fillings: [string[], string[]][] = [
  [['bacon'], ['pork']], [['sausage'], ['pork', 'wheat']], [['bacon and egg', 'egg and bacon'], ['pork', 'egg']],
  [['egg', 'egg mayo', 'egg mayonnaise'], ['egg']], [['ham'], ['pork']], [['ham and cheese'], ['pork', 'cheese']],
  [['cheese'], ['cheese']], [['cheese and pickle'], ['cheese', 'vinegar', 'onion']], [['tuna', 'tuna mayo'], ['fish', 'egg']],
  [['chicken'], ['chicken']], [['chicken and bacon'], ['chicken', 'pork']], [['prawn', 'prawn mayo'], ['shellfish', 'egg']],
  [['beef', 'roast beef'], ['beef']], [['turkey'], ['turkey']], [['hummus'], ['chickpea', 'sesame', 'garlic']],
  [['peanut butter'], ['peanut']], [['bacon lettuce and tomato', 'blt'], ['pork', 'lettuce', 'tomato']],
];
for (const [names, ingredients] of fillings) extraRecipes.push({
  names: names.flatMap(name => ['sandwich', 'roll', 'cob', 'bap', 'butty', 'bun', 'barm', 'baguette', 'bagel', 'panini', 'wrap'].map(bread => `${name} ${bread}`)),
  ingredients: ['wheat', ...ingredients], question: 'grain',
});
for (const [name, ingredients] of fillings.slice(0, 15)) extraRecipes.push({ names: name.map(n => `jacket potato with ${n}`), ingredients: ['potato', ...ingredients] });

export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = row;
  }
  return previous[b.length];
}
