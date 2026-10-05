import fs from 'node:fs/promises';
const sourceUrl = 'https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/brands.txt';
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Brand taxonomy returned ${response.status}`);
const text = await response.text();
const records = text.split(/\r?\n\s*\r?\n/).flatMap(block => {
  const line = block.split(/\r?\n/).find(row => /^(?:xx|en):/.test(row));
  if (!line) return [];
  const [name, ...aliases] = line.replace(/^[a-z]{2}:\s*/, '').split(',').map(value => value.trim()).filter(Boolean);
  return name ? [{ name, aliases }] : [];
});
if (records.length < 1000) throw new Error('Refusing an unexpectedly small taxonomy import.');
await fs.writeFile('src/data/openFoodFactsBrands.json', JSON.stringify({ source: 'Open Food Facts brands taxonomy (ODbL)', sourceUrl, generatedAt: '2026-10-05', records }) + '\n');
console.log(`Imported ${records.length} brand taxonomy names.`);
