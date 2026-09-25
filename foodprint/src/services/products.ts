/** Public product records only. Diary entries, symptoms and photographs never enter this API. */
export interface CatalogProduct {
  barcode: string;
  name: string;
  brands?: string;
  ingredientsText?: string;
  /** Ingredient nodes parsed by Open Food Facts from the product's published label. */
  ingredients: { id: string; name: string }[];
  allergens: string[];
  traces: string[];
  labels: string[];
  sourceUrl: string;
  attribution: string;
  warnings: string[];
}

export type CatalogErrorCode = 'invalid-input' | 'rate-limited' | 'timeout' | 'network' | 'unavailable';

export class CatalogError extends Error {
  constructor(public readonly code: CatalogErrorCode, message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}

export const PRODUCT_ATTRIBUTION = 'Product data: Open Food Facts contributors · Open Database License (ODbL)';
const API_ROOT = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_en,brands,ingredients_text,ingredients_text_en,ingredients,allergens_tags,traces_tags,labels_tags';
const USER_AGENT = 'Bellywise/1.0';
const TIMEOUT_MS = 12000;
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { savedAt: number; value: CatalogProduct[] }>();
const pending = new Map<string, Promise<CatalogProduct[]>>();
const nextRequestAt = { barcode: 0, search: 0 };

function stringField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
  return text || undefined;
}

function tagList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string')
    .map(item => item.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')) : [];
}

function structuredIngredientList(value: unknown): { id: string; name: string }[] {
  const rows: { id: string; name: string }[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const item = node as Record<string, unknown>;
    const rawId = stringField(item.id)?.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ');
    const name = stringField(item.text) ?? rawId;
    if (name) rows.push({ id: stringField(item.id) ?? name, name });
    if (Array.isArray(item.ingredients)) item.ingredients.forEach(visit);
  };
  if (Array.isArray(value)) value.forEach(visit);
  const seen = new Set<string>();
  return rows.filter(item => {
    const key = `${item.id.toLowerCase()}|${item.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Exported for deterministic schema tests. Untrusted server data never becomes executable markup. */
export function normalizeCatalogProduct(value: unknown): CatalogProduct | null {
  if (!value || typeof value !== 'object') return null;
  const product = value as Record<string, unknown>;
  const barcode = typeof product.code === 'number' ? String(product.code) : stringField(product.code);
  if (!barcode || !/^\d{4,24}$/.test(barcode)) return null;
  const ingredientsText = stringField(product.ingredients_text_en) ?? stringField(product.ingredients_text);
  const warnings = ['Community product records may be incomplete or out of date. Check your exact product and its current packet.'];
  if (!ingredientsText) warnings.push('This record has no ingredient list. Scan the packet or enter its ingredients yourself.');
  if (!product.ingredients_text_en && product.ingredients_text) warnings.push('The ingredient text may be in the product’s local language. English ingredient matching can miss terms.');
  return {
    barcode,
    name: stringField(product.product_name_en) ?? stringField(product.product_name) ?? `Product ${barcode}`,
    brands: stringField(product.brands), ingredientsText, ingredients: structuredIngredientList(product.ingredients),
    allergens: tagList(product.allergens_tags), traces: tagList(product.traces_tags), labels: tagList(product.labels_tags),
    sourceUrl: `${API_ROOT}/product/${encodeURIComponent(barcode)}`,
    attribution: PRODUCT_ATTRIBUTION, warnings,
  };
}

async function requestJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (response.status === 429) throw new CatalogError('rate-limited', 'Open Food Facts is receiving too many requests. Wait a minute and try again.');
    if (response.status === 404) return { status: 0 };
    if (!response.ok) throw new CatalogError('unavailable', 'The product catalog is temporarily unavailable. You can still enter or scan ingredients.');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CatalogError('unavailable', 'The product catalog returned an unreadable response.');
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    if (controller.signal.aborted) throw new CatalogError('timeout', 'The product search took too long. Check your connection and try again.');
    throw new CatalogError('network', 'Could not reach Open Food Facts. Check your connection, or enter ingredients manually.');
  } finally {
    clearTimeout(timeout);
  }
}

async function cachedRequest(key: string, kind: 'barcode' | 'search', load: () => Promise<CatalogProduct[]>): Promise<CatalogProduct[]> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_MS) return cached.value;
  const existing = pending.get(key);
  if (existing) return existing;
  if (Date.now() < nextRequestAt[kind]) {
    throw new CatalogError('rate-limited', 'Please wait a few seconds before another product search.');
  }
  // OFF documents per-IP rate limits. Submit only; no automatic keystroke requests.
  nextRequestAt[kind] = Date.now() + (kind === 'search' ? 6500 : 4500);
  const request = load().then(value => {
    if (cache.size >= 50) cache.delete(cache.keys().next().value!);
    cache.set(key, { savedAt: Date.now(), value });
    return value;
  }).finally(() => { pending.delete(key); });
  pending.set(key, request);
  return request;
}

/** Explicit user action only. Supports EAN-8, UPC-A, EAN-13 and GTIN-14. */
export async function lookupBarcode(barcode: string): Promise<CatalogProduct | null> {
  const code = barcode.replace(/[\s-]/g, '');
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) {
    throw new CatalogError('invalid-input', 'Enter the 8, 12, 13 or 14 digits printed beneath the barcode.');
  }
  const products = await cachedRequest(`barcode:${code}`, 'barcode', async () => {
    const body = await requestJson(`${API_ROOT}/api/v2/product/${encodeURIComponent(code)}.json?fields=${encodeURIComponent(FIELDS)}`);
    if (body.status === 0) return [];
    const product = normalizeCatalogProduct(body.product);
    return product ? [product] : [];
  });
  return products[0] ?? null;
}

/** OFF v2 does not support plain-text search; use its documented legacy search endpoint. */
export async function searchProducts(query: string): Promise<CatalogProduct[]> {
  const terms = query.replace(/\s+/g, ' ').trim();
  if (terms.length < 2 || terms.length > 120) throw new CatalogError('invalid-input', 'Enter a product name between 2 and 120 characters.');
  return cachedRequest(`search:${terms.toLocaleLowerCase()}`, 'search', async () => {
    const params = new URLSearchParams({ search_terms: terms, search_simple: '1', action: 'process', json: '1', page_size: '12', page: '1', fields: FIELDS });
    const body = await requestJson(`${API_ROOT}/cgi/search.pl?${params.toString()}`);
    if (!Array.isArray(body.products)) throw new CatalogError('unavailable', 'The catalog could not return product results. Try again later.');
    return body.products.map(normalizeCatalogProduct).filter((product): product is CatalogProduct => product !== null);
  });
}
