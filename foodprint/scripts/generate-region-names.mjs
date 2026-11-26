/** Bundle ICU/CLDR region names so native runtimes need not implement Intl.DisplayNames. */
import fs from 'node:fs/promises';
const regions=await fs.readFile('src/i18n/regions.ts','utf8');
const codes=regions.match(/REGION_CODES = '([^']+)'/)[1].split(' ');
const localeSource=await fs.readFile('src/i18n/locales.ts','utf8');
const locales=[...localeSource.split('] as const')[0].matchAll(/\['([^']+)', '/g)].map(match=>match[1]);
const names={};
for(const locale of locales){const display=new Intl.DisplayNames([locale],{type:'region'});names[locale]=Object.fromEntries(codes.map(code=>[code,display.of(code)]));}
await fs.writeFile('src/i18n/regionNames.json',JSON.stringify(names)+'\n');
console.log(`Bundled ${codes.length} region names in ${locales.length} locales.`);
