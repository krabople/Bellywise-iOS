import fs from 'node:fs';
const text=fs.readFileSync('src/i18n/locales.ts','utf8');
const locales=[...text.split('] as const')[0].matchAll(/\['([^']+)', '/g)].map(m=>m[1]);
const messages=JSON.parse(fs.readFileSync('src/i18n/messages.json','utf8'));
const overrides=JSON.parse(fs.readFileSync('localization/terminology-overrides.json','utf8'));
const source=JSON.parse(fs.readFileSync('localization/source-messages.json','utf8'));
const placeholders=value=>[...new Set([...value.matchAll(/\{\d+\}/g)].map(x=>x[0]))].sort().join('|');
const failures=[];
for(const locale of locales){
 if(locale.startsWith('en'))continue;
 const rows={...messages[locale],...overrides[locale]};
 for(const key of source){
  if(!rows[key])failures.push({locale,key,problem:'missing translation'});
  else if(placeholders(key)!==placeholders(rows[key]))failures.push({locale,key,problem:'invalid interpolation'});
  else if(/<\/?span\b|translate\s*=|(?:अनुवाद|ଅନୁବାଦ|ترجمہ|翻译|翻譯|翻訳)\s*=/iu.test(rows[key]))failures.push({locale,key,problem:'translation markup residue'});
  else if(/\[BW\d{5}\]/i.test(rows[key]) || (!key.includes('=') && /=\s*["“”']/u.test(rows[key])))failures.push({locale,key,problem:'translation boundary or attribute residue'});
 }
 const native=JSON.parse(fs.readFileSync(`localization/native/${locale}.json`,'utf8'));
 if(!native.ios?.NSCameraUsageDescription||!native.ios?.NSPhotoLibraryUsageDescription)failures.push({locale,problem:'missing native permissions'});
}
fs.writeFileSync('localization/validation.json',JSON.stringify({locales:locales.length,sourceMessages:source.length,failures},null,2)+'\n');
console.log(`${locales.length} locales, ${source.length} source messages, ${failures.length} outstanding translation problems.`);
if(failures.length){console.log(JSON.stringify(failures.slice(0,5),null,2));process.exitCode=1;}
