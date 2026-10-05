// Official public UK menu pages. Menu/allergen prose is never substituted for ingredients.
import fs from 'node:fs/promises';
const root = 'https://www.kfc.co.uk';
const fetchPage = async path => {
  const response = await fetch(root + path, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${path}`);
  const html = await response.text();
  return JSON.parse(html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)[1]).props.pageProps.data.mainContent;
};
const links = value => {
  const rows = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.button_link === 'string' && node.button_link.startsWith('/our-menu/') && typeof node.heading === 'string') rows.push({ path: node.button_link, name: node.heading });
    for (const child of Object.values(node)) if (typeof child === 'object') visit(child);
  }; visit(value); return rows;
};
const menu = await fetchPage('/our-menu');
const categories = [...new Set(JSON.stringify(menu).match(/\/our-menu\/[a-z0-9-]+/g))];
const records = new Map();
for (const category of categories) {
  try {
    for (const row of links(await fetchPage(category))) records.set(row.path, { id: `kfc-uk-${row.path.split('/').at(-1)}`, name: row.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), brands: 'KFC', country: 'United Kingdom', sourceUrl: root + row.path, fetchedAt: '2026-10-05' });
    console.log(`${category}: ${records.size} distinct menu items`);
  } catch (error) { console.warn(`${category}: ${error.message}`); }
  await new Promise(resolve => setTimeout(resolve, 400));
}
if (!records.size) throw new Error('No menu items found.');
await fs.writeFile('src/data/kfcUkProducts.json', JSON.stringify({ source: 'KFC UK official menu', generatedAt: '2026-10-05', records: [...records.values()] }) + '\n');
