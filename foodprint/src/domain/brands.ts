import usda from '../data/brandCatalog.json';
import off from '../data/openFoodFactsBrands.json';
import burgerking from '../data/burgerkingUkProducts.json';
import { normalizeIngredientText } from './ingredients';
import { spellingDistance } from './catalogMatching';

export interface BrandRecord { key: string; name: string; aliases: string[]; productsInSource: number }
const curated: BrandRecord[] = [
  { key: 'mcdonalds', name: "McDonald's", aliases: ['mc donalds', 'mc donald s', 'mcdonald', 'maccies'], productsInSource: 136 },
  { key: 'kfc', name: 'KFC', aliases: ['kentucky fried chicken', 'k f c'], productsInSource: 137 },
  { key: 'burger king', name: 'Burger King', aliases: ['burgerking', 'bk'], productsInSource: burgerking.records.length },
  ...['Dolmio', 'Tesco', "Sainsbury's", 'Morrisons', 'Waitrose', 'Asda', 'Aldi', 'Lidl', 'Alpro', 'Bisto', 'Quorn', 'Linda McCartney', 'Greggs', 'KFC', "Nando's", 'Heinz', 'Cadbury', 'Nestlé', "Kellogg's", 'Weetabix', 'Hovis', 'Warburtons', 'Walkers', 'Birds Eye', 'Young’s', 'Innocent', 'Oatly', 'Violife'].map(name => ({ key: normalizeIngredientText(name), name, aliases: [], productsInSource: 0 })),
];
const records = new Map<string, BrandRecord>();
for (const row of [...curated, ...off.records.map(r => ({ ...r, key: normalizeIngredientText(r.name), productsInSource: 0 })), ...usda.records]) {
  const key = normalizeIngredientText(row.name);
  const prior = records.get(key);
  if (prior) { prior.aliases = [...new Set([...prior.aliases, row.name, ...row.aliases])]; prior.productsInSource = Math.max(prior.productsInSource, row.productsInSource); }
  else records.set(key, { ...row, key, aliases: [...row.aliases] });
}
export const brandCatalog = [...records.values()];
export const brandCatalogSize = brandCatalog.length;
const indexedBrands = brandCatalog.map(brand => ({ brand, names: [...new Set([brand.name, ...brand.aliases].map(normalizeIngredientText))] }));
const aliases = new Map<string, BrandRecord>();
for (const brand of brandCatalog) for (const name of [brand.name, ...brand.aliases]) aliases.set(normalizeIngredientText(name), brand);
export function findBrand(query: string): BrandRecord | undefined { return aliases.get(normalizeIngredientText(query)); }
export function brandInQuery(query: string): { brand: BrandRecord; remaining: string } | undefined {
  const words = normalizeIngredientText(query).split(' ');
  for (let n = words.length; n >= 1; n--) {
    const brand = aliases.get(words.slice(0, n).join(' '));
    if (brand) return { brand, remaining: words.slice(n).join(' ') };
  }
}
export function suggestBrands(query: string, limit = 6): BrandRecord[] {
  const key = normalizeIngredientText(query); if (key.length < 2) return [];
  const candidates = indexedBrands.flatMap(({ brand, names }) => {
    const score = names.includes(key) ? 4 : names.some(name => name.startsWith(key)) ? 3 : names.some(name => spellingDistance(key, name, 2) <= Math.min(2, Math.floor(key.length / 5))) ? 2 : names.some(name => name.includes(key)) ? 1 : 0;
    return score ? [{ brand, score }] : [];
  });
  return candidates.sort((a, b) => b.score - a.score || b.brand.productsInSource - a.brand.productsInSource || a.brand.name.localeCompare(b.brand.name)).slice(0, limit).map(row => row.brand);
}
