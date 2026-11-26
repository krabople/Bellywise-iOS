/** Build-time translation of PUBLIC STATIC copy only. No runtime network translation. */
import fs from 'node:fs/promises';
const sources=JSON.parse(await fs.readFile('localization/source-messages.json','utf8'));
const localeText=await fs.readFile('src/i18n/locales.ts','utf8');
const locales=[...localeText.split('] as const')[0].matchAll(/\['([^']+)', '/g)].map(m=>m[1]);
let catalogs={};try{catalogs=JSON.parse(await fs.readFile('src/i18n/messages.json','utf8'));}catch{}
try{const next=JSON.parse(await fs.readFile('src/i18n/messages.next.json','utf8'));for(const [locale,rows]of Object.entries(next))catalogs[locale]={...catalogs[locale],...rows};}catch{}
const target=locale=>({'zh-Hans':'zh-CN','zh-Hant':'zh-TW','nb':'no','pt-PT':'pt','pt-BR':'pt','fr-CA':'fr','es-MX':'es','es-ES':'es'}[locale]??locale.split('-')[0]);
let failures=[];
try{failures=JSON.parse(await fs.readFile('localization/translation-failures.json','utf8'));}catch{}
// Some translation models accidentally absorb a closing brace into a word.
// Protect interpolations with non-translatable spans on a retry, then remove
// the spans before bundling plain text. The app never renders this as HTML.
const restorePlaceholders=value=>value.replace(/[｛{]\s*([\p{Nd}\s]+)\s*[｝}]/gu,(_,number)=>'{'+Array.from(number.trim()).map(ch=>{
 const code=ch.codePointAt(0);for(const base of [0x0660,0x06f0,0x0966,0x09e6,0x0a66,0x0ae6,0x0b66,0x0be6,0x0c66,0x0ce6,0x0d66,0x0e50,0xff10])if(code>=base&&code<base+10)return String(code-base);return ch;
}).join('').replace(/\s/g,'')+'}');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let requestQueue=Promise.resolve(),nextRequest=0;
async function translationResponse(url){
 let release;const previous=requestQueue;requestQueue=new Promise(resolve=>{release=resolve;});await previous;
 try{
  for(let attempt=0;attempt<8;attempt++){
   if(nextRequest>Date.now())await sleep(nextRequest-Date.now());
   const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
   nextRequest=Date.now()+1200;
   if(response.status!==429)return response;
   const delay=Math.max(60000,Number(response.headers.get('retry-after')??0)*1000,Math.min(300000,60000*2**attempt));
   nextRequest=Date.now()+delay;
   console.log(`Translation provider asked to slow down; backing off ${Math.round(delay/1000)} seconds.`);
  }
  throw new Error('Translation provider is still rate limited after backoff. Progress has been saved.');
 }finally{release();}
}
const placeholderSet=text=>[...new Set([...text.matchAll(/\{\d+\}/g)].map(x=>x[0]))].sort().join('|');
async function translate(items,locale){
 if(items.length===1){
  for(let attempt=0;attempt<4;attempt++){
   try{
    const url=new URL('https://translate.googleapis.com/translate_a/single');
    const q=attempt>=1?items[0].replace(/\{\d+\}/g,token=>`<span translate="no">${token}</span>`):items[0];
    for(const [k,v] of Object.entries({client:'gtx',sl:'en',tl:target(locale),dt:'t',q}))url.searchParams.set(k,v);
    const response=await translationResponse(url);if(!response.ok)throw new Error(`Translation ${response.status}`);
    const body=await response.json();const value=restorePlaceholders(body[0].map(row=>row[0]??'').join('').replace(/<\/?span\b[^>]*>/gi,''));
    if(!value.trim()||placeholderSet(value)!==placeholderSet(items[0]))throw new Error('Single message placeholder mismatch');
    return {[items[0]]:value};
   }catch(error){if(attempt===3){
     failures.push({locale,source:items[0],error:error.message});await fs.writeFile('localization/translation-failures.json',JSON.stringify(failures,null,2)+'\n');
     console.log(`REVIEW REQUIRED ${locale}: ${JSON.stringify(items[0])}: ${error.message}`);return {[items[0]]:items[0]};
   }await sleep(1000*(attempt+1));}
  }
 }
 const q=items.map((text,i)=>`<span translate="no">[BW${String(i).padStart(5,'0')}]</span> ${text.replace(/\n/g,' ⏎ ').replace(/\{\d+\}/g,token=>`<span translate="no">${token}</span>`)}`).join('\n');
 for(let attempt=0;attempt<5;attempt++){
  try{
   const url=new URL('https://translate.googleapis.com/translate_a/single');
   for(const [k,v]of Object.entries({client:'gtx',sl:'en',tl:target(locale),dt:'t',q}))url.searchParams.set(k,v);
   const response=await translationResponse(url);if(!response.ok)throw new Error(`Translation ${response.status}`);
   const body=await response.json(); const text=body[0].map(row=>row[0]??'').join('').replace(/<\/?span\b[^>]*>/gi,'')
     .replace(/(\[BW\d{5}\])(?:[\s\u200e\u200f]*\1)+/gi,'$1');
   const matches=[...text.matchAll(/\[\s*BW\s*(\d{5})\s*\]\s*/gi)];
   if(matches.length!==items.length || new Set(matches.map(match=>Number(match[1]))).size!==items.length || matches.some(match=>Number(match[1])>=items.length))throw new Error('Translation boundaries missing');
   const result={}, retry=[];
   for(let i=0;i<matches.length;i++){
    const index=Number(matches[i][1]); let value=restorePlaceholders(text.slice(matches[i].index+matches[i][0].length,matches[i+1]?.index??text.length).trim().replace(/\s*⏎\s*/g,'\n'));
    if(!value || placeholderSet(value)!==placeholderSet(items[index]))retry.push(index);
    else result[items[index]]=value;
   }
   for(const index of retry)Object.assign(result,await translate([items[index]],locale));
   return result;
  }catch(error){if(attempt===4){if(items.length>1){const mid=Math.floor(items.length/2);return {...await translate(items.slice(0,mid),locale),...await translate(items.slice(mid),locale)};}throw error;}await sleep(800*(attempt+1));}
 }
}
let saveQueue=Promise.resolve();
const save = () => { saveQueue=saveQueue.then(async()=>{
 await fs.writeFile('src/i18n/messages.next.json',JSON.stringify(catalogs)+'\n');
 for(let attempt=0;;attempt++){
  try{await fs.rename('src/i18n/messages.next.json','src/i18n/messages.json');break;}
  catch(error){if(attempt>=30)throw error;await sleep(100+attempt*30);}
 }
}); return saveQueue; };
const completed = new Map();
async function processLocale(locale){
 if(locale.startsWith('en')){catalogs[locale]??={};return;}
 const equivalent=Object.keys(catalogs).find(key=>key!==locale&&target(key)===target(locale)&&sources.every(source=>catalogs[key]?.[source]));
 if(equivalent){catalogs[locale]={...catalogs[equivalent]};return;}
 catalogs[locale]??={};
 const missing=sources.filter(source=>!catalogs[locale][source]);
 const chunks=[];let chunk=[],length=0;
 for(const source of missing){const cost=source.length+80+(source.match(/\{\d+\}/g)?.length??0)*40;if(chunk.length&&length+cost>3800){chunks.push(chunk);chunk=[];length=0;}chunk.push(source);length+=cost;}if(chunk.length)chunks.push(chunk);
 for(let i=0;i<chunks.length;i++){
   Object.assign(catalogs[locale],await translate(chunks[i],locale));
   await save();
   if(i%10===0||i===chunks.length-1)console.log(`${locale} ${i+1}/${chunks.length} (${Object.keys(catalogs[locale]).length} messages)`);
   await sleep(180);
 }
}
const work=locales.filter(locale=>!['fr-CA','es-MX','pt-PT'].includes(locale));let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<work.length)await processLocale(work[cursor++]);}));
for(const locale of ['fr-CA','es-MX','pt-PT'])await processLocale(locale);
await save();
console.log('All translation catalogs generated.');
