#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const [, , input, output = 'src/data/openFoodFactsIngredients.json', revision = 'unknown'] = process.argv;
if (!input) throw new Error('Usage: node scripts/generate-ingredient-catalog.mjs <ingredients.txt> [output.json] [revision]');

const normalize = value => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = value => normalize(value).replace(/ /g, '-');
const unique = values => [...new Set(values.map(value => value.trim()).filter(Boolean))];
const text = (await readFile(input, 'utf8')).replace(/\r\n?/g, '\n');
const records = [];

for (const block of text.split(/\n\s*\n/)) {
  const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
  const english = lines.find(line => line.startsWith('en:'));
  if (!english) continue;
  const names = unique(english.slice(3).split(',')).filter(name => name.length >= 2 && name.length <= 160);
  if (!names.length) continue;
  const name = names[0];
  const property = key => lines.find(line => line.toLowerCase().startsWith(`${key}:en:`))?.split(':').slice(2).join(':').trim();
  const parents = unique(lines.filter(line => line.startsWith('< en:')).flatMap(line => line.slice(5).split(','))).slice(0, 8);
  records.push({
    id: `off-${slug(name)}`,
    name,
    aliases: unique(names.map(normalize)).filter(Boolean),
    ...(parents.length ? { parents } : {}),
    ...(property('description') ? { description: property('description') } : {}),
    ...(property('wikipedia') ? { wikipedia: property('wikipedia') } : {}),
    ...(property('vegan') ? { vegan: property('vegan') } : {}),
    ...(property('vegetarian') ? { vegetarian: property('vegetarian') } : {}),
  });
}

const byId = new Map();
for (const record of records) {
  const prior = byId.get(record.id);
  if (!prior) byId.set(record.id, record);
  else prior.aliases = unique([...prior.aliases, ...record.aliases]);
}
const data = {
  source: 'Open Food Facts ingredients taxonomy (ODbL)',
  license: 'Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/',
  revision,
  generatedAt: new Date().toISOString().slice(0, 10),
  records: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')),
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(data)}\n`);
console.log(`Wrote ${data.records.length} canonical ingredients to ${output}.`);
