import fs from 'node:fs/promises';
const catalogs=JSON.parse(await fs.readFile('src/i18n/messages.json','utf8'));
const overrides=JSON.parse(await fs.readFile('localization/terminology-overrides.json','utf8'));
const sources=new Set(JSON.parse(await fs.readFile('localization/source-messages.json','utf8')));
let failures=[];try{failures=JSON.parse(await fs.readFile('localization/translation-failures.json','utf8'));}catch{}
const unique=[...new Map(failures.map(row=>[`${row.locale}:${row.source}`,row])).values()];
const keys=text=>[...new Set([...text.matchAll(/\{\d+\}/g)].map(match=>match[0]))].sort().join('|');
const remaining=[];let repaired=0;
for(const failure of unique){
 const {locale,source}=failure;
 if(!sources.has(source))continue;
 if(overrides[locale]?.[source]){catalogs[locale][source]=overrides[locale][source];repaired++;continue;}
 const target={'zh-Hans':'zh-CN','zh-Hant':'zh-TW','nb':'no','pt-PT':'pt','pt-BR':'pt','fr-CA':'fr','es-MX':'es','es-ES':'es'}[locale]??locale.split('-')[0];
 const url=new URL('https://translate.googleapis.com/translate_a/single');
 try{
  let translated='';
  for(let attempt=0;attempt<2;attempt++){
   const q=attempt===0?source:source.replace(/\{\d+\}/g,token=>`<span translate="no">${token}</span>`);
   for(const [key,value]of Object.entries({client:'gtx',sl:'en',tl:target,dt:'t',q}))url.searchParams.set(key,value);
   const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const body=await response.json();translated=body[0].map(row=>row[0]??'').join('').replace(/<\/?span\b[^>]*>/gi,'').replace(/\{\s*(\d+)\s*\}/g,'{$1}').trim();
   if(keys(translated)===keys(source)&&!/<\/?span\b|translate\s*=|(?:अनुवाद|ଅନୁବାଦ|ترجمہ|翻译|翻譯|翻訳)\s*=/iu.test(translated))break;
   if(attempt===1)throw new Error('Interpolation or formatting mismatch');
  }
  catalogs[locale][source]=translated;repaired++;
 }catch(error){remaining.push({...failure,error:error.message});}
 await new Promise(resolve=>setTimeout(resolve,1400));
}
await fs.writeFile('src/i18n/messages.repaired.json',JSON.stringify(catalogs)+'\n');
await fs.rename('src/i18n/messages.repaired.json','src/i18n/messages.json');
await fs.writeFile('localization/translation-failures.json',JSON.stringify(remaining,null,2)+'\n');
console.log(`${repaired} placeholder translations repaired; ${remaining.length} remain.`);
if(remaining.length)process.exitCode=1;
