// Public menu + the same ingredient API used by the official UK product pages.
import fs from 'node:fs/promises';
const root = 'https://www.mcdonalds.com';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const text = async url => {
  const result = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!result.ok) throw new Error(`${result.status}: ${url}`);
  return result.text();
};
const menu = await text(`${root}/gb/en-gb/menu.html`);
const categories = [...new Set(menu.match(/\/gb\/en-gb\/menu\/[-a-z0-9]+\.html/g))];
const pages = new Set(menu.match(/\/gb\/en-gb\/product\/[-a-z0-9]+\.html/g));
for (const category of categories) {
  const html = await text(root + category);
  for (const page of html.match(/\/gb\/en-gb\/product\/[-a-z0-9]+\.html/g) ?? []) pages.add(page);
  await pause(400);
}
const strip = value => typeof value === 'string' ? value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim() : '';
const records = [], seen = new Set();
for (const page of pages) {
  try {
    const html = await text(root + page);
    const id = html.match(/data-product-id="(\d+)"/)?.[1];
    if (!id || seen.has(id)) continue;
    const sourceApiUrl = `${root}/dnaapp/itemDetails?country=UK&language=en&showLiveData=true&item=${id}`;
    const product = JSON.parse(await text(sourceApiUrl)).item;
    if (!product) continue;
    const components = product.components?.component?.filter(c => c.is_default === 1) ?? [];
    const ingredientsText = strip(product.ingredient_statement) || components.map(c => strip(c.ingredient_statement)).filter(Boolean).join('\n');
    const name = strip(product.item_name || product.name || product.marketing_name) || strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]);
    if (!name) continue;
    seen.add(id);
    records.push({ id: `mcdonalds-uk-${id}`, name, brands: "McDonald's", country: 'United Kingdom', ingredientsText,
      sourceUrl: root + page, sourceApiUrl, fetchedAt: '2026-10-05', ingredientAlternatives: /\beither\b|\bor\s*:/i.test(ingredientsText) });
    console.log(`${records.length}: ${name} (${ingredientsText.length} ingredient characters)`);
    await pause(500);
  } catch (error) { console.warn(`Skipped ${page}: ${error.message}`); }
}
if (!records.some(p => /big mac/i.test(p.name))) throw new Error('No Big Mac found; refusing an incomplete menu import.');
await fs.writeFile('src/data/mcdonaldsUkProducts.json', JSON.stringify({ source: 'McDonald’s UK official menu and published ingredient API', generatedAt: '2026-10-05', records }) + '\n');
console.log(`Imported ${records.length} official UK menu items.`);
