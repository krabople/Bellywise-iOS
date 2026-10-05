import products from '../data/brandedProducts.json';
import mcdonalds from '../data/mcdonaldsUkProducts.json';
import kfc from '../data/kfcUkProducts.json';
import burgerking from '../data/burgerkingUkProducts.json';
import { brandInQuery } from '../domain/brands';
import { normalizeIngredientText } from '../domain/ingredients';
import { spellingDistance } from '../domain/catalogMatching';
import type { CatalogProduct } from './products';

const rows: CatalogProduct[] = [
  ...[...kfc.records, ...burgerking.records].map(row => ({ ...row, barcode: '', ingredients: [], allergens: [], traces: [], labels: [], sourceLabel: `${row.brands} UK`,
    attribution: `Menu name: ${row.brands} UK official menu`,
    warnings: ['UK menu snapshot from 5 October 2026. A complete ingredients list is not published in this menu source. Scan a label or enter verified ingredients; allergen advice alone is not a full list.'] })),
  ...mcdonalds.records.map(row => ({ ...row, barcode: '', ingredients: [], allergens: [], traces: [], labels: [], sourceLabel: 'McDonald’s UK',
    attribution: 'Ingredients: McDonald’s UK official menu', ingredientConfidence: row.ingredientAlternatives ? 'inferred' as const : 'confirmed' as const,
    warnings: ['UK menu snapshot from 5 October 2026. The current official ingredient list is retrieved when selected.', ...(row.ingredientAlternatives ? ['The manufacturer lists alternative supplier recipes. Possible components remain estimates; check the version you ate.'] : [])] })),
  ...products.records.map(row => ({ ...row, id: `usda-${row.fdcId}`, ingredients: [], allergens: [], traces: [], labels: [], sourceLabel: 'USDA', sourceUrl: `https://fdc.nal.usda.gov/food-details/${row.fdcId}/nutrients`, attribution: 'Published label data: USDA FoodData Central · public domain',
    warnings: [`Label record for ${row.country}, last updated ${row.updatedAt}. Recipes can differ by country and change over time. Check the exact packet.`] })),
];
export const localProductCount = rows.length;
const indexed = rows.map(product => ({ product, name: normalizeIngredientText(product.name), brand: normalizeIngredientText(product.brands ?? '') }));
const byBrand = new Map<string, typeof indexed>();
for (const row of indexed) { const key = row.brand; const bucket = byBrand.get(key) ?? []; bucket.push(row); byBrand.set(key, bucket); }
export function searchLocalProducts(query: string, options: { limit?: number; country?: string } = {}): { products: CatalogProduct[]; total: number } {
  const key = normalizeIngredientText(query); if (key.length < 2) return { products: [], total: 0 };
  const parsed = brandInQuery(query), terms = (parsed?.remaining ?? key).split(' ').filter(Boolean);
  const candidates = parsed ? byBrand.get(parsed.brand.key) ?? [] : indexed;
  const hits = candidates.flatMap(row => {
    if (options.country && row.product.country !== options.country) return [];
    const words = row.name.split(' ');
    const matches = !terms.length || terms.every(term => words.some(word => word.startsWith(term) || (term.length >= 5 && spellingDistance(term, word, 1) <= 1)));
    if (!matches) return [];
    const core = /^(?:big mac|mcplant|mcchicken sandwich|cheeseburger|hamburger|filet o fish|fries medium|whopper|double whopper|chicken royale|fillet burger|zinger burger|fillet tower burger|bbq fillet tower burger)$/.test(row.name);
    return [{ product: row.product, score: (row.product.country === 'United Kingdom' ? 10 : 0) + (core ? 5 : 0) + (row.name === terms.join(' ') ? 4 : 0) }];
  }).sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
  return { products: hits.slice(0, options.limit ?? 12).map(hit => hit.product), total: hits.length };
}
