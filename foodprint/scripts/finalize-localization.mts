import fs from 'node:fs/promises';
import ts from 'typescript';
import { ingredientCatalog, findIngredientRecord } from '../src/domain/ingredients';
import { CONTEXT_SOURCES } from '../src/i18n/labelContext';
import { LOCALES, isRTL } from '../src/i18n/locales';
import { normalizeTranslation } from '../src/i18n/terminology';
const catalogs:Record<string,Record<string,string>>=JSON.parse(await fs.readFile('src/i18n/messages.json','utf8'));
const sourceMessages:string[]=JSON.parse(await fs.readFile('localization/source-messages.json','utf8'));
const americanise=(text:string)=>text.replace(/\bdiarrhoea\b/gi,word=>word[0]==='D'?'Diarrhea':'diarrhea').replace(/\bcoeliac\b/gi,word=>word[0]==='C'?'Celiac':'celiac')
 .replace(/\byoghurt\b/gi,word=>word[0]==='Y'?'Yogurt':'yogurt').replace(/\bfibre\b/gi,word=>word[0]==='F'?'Fiber':'fiber')
 .replace(/\bcatalogue\b/gi,word=>word[0]==='C'?'Catalog':'catalog').replace(/\bpersonalise\b/gi,word=>word[0]==='P'?'Personalize':'personalize')
 .replace(/\brecognis/gi,word=>word[0]==='R'?'Recogniz':'recogniz').replace(/\banalys(e|ed|es|ing)\b/gi,word=>word.replace(/analys/i,word[0]==='A'?'Analyz':'analyz')).replace(/\ba GP\b/g,'a doctor');
catalogs['en-US']=Object.fromEntries(sourceMessages.map(source=>[source,americanise(source)]));
catalogs['en-CA']=Object.fromEntries(sourceMessages.map(source=>[source,source.replace(/\bdiarrhoea\b/gi,word=>word[0]==='D'?'Diarrhea':'diarrhea').replace(/\byoghurt\b/gi,word=>word[0]==='Y'?'Yogurt':'yogurt')]));
Object.assign(catalogs['en-US'],{'Aubergine':'Eggplant','Courgette':'Zucchini','Wind':'Gas'});
const overrides=JSON.parse(await fs.readFile('localization/terminology-overrides.json','utf8'));
const sourceSet=new Set(sourceMessages);
for(const [locale,rows]of Object.entries(catalogs))for(const key of Object.keys(rows))if(!sourceSet.has(key)&&!overrides[locale]?.[key])delete rows[key];
for(const [locale,rows]of Object.entries(overrides))Object.assign(catalogs[locale]??={},rows);
for(const [locale,rows]of Object.entries(catalogs))for(const [source,value]of Object.entries(rows))rows[source]=normalizeTranslation(locale,source,value);
await fs.writeFile('src/i18n/messages.finalized.json',JSON.stringify(catalogs)+'\n');
for(let attempt=0;;attempt++){
 try{await fs.rename('src/i18n/messages.finalized.json','src/i18n/messages.json');break;}
 catch(error){if(attempt>=15)throw error;await new Promise(resolve=>setTimeout(resolve,150*(attempt+1)));}
}
const international=JSON.parse(await fs.readFile('src/data/internationalIngredients.json','utf8'));
const aliases=new Map<string,string>();const ambiguous=new Set<string>();
const recipeNames=new Set<string>();
const recipeCanonical=new Map<string,string>();
for(const file of ['src/domain/foods.ts','src/domain/extraRecipes.ts']){
 const ast=ts.createSourceFile(file,await fs.readFile(file,'utf8'),ts.ScriptTarget.Latest,true);
 const visit=(node:ts.Node)=>{if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='names'&&ts.isArrayLiteralExpression(node.initializer)){
   const names=node.initializer.elements.filter(ts.isStringLiteral).map(item=>item.text);
   for(const name of names){recipeNames.add(name);if(!recipeCanonical.has(name))recipeCanonical.set(name,names[0]);}
 }ts.forEachChild(node,visit);};visit(ast);
}
const contexts:Record<string,Record<string,string>>={};
for(const [locale]of LOCALES){
 const dictionary=catalogs[locale]??{}; contexts[locale]={};
 for(const phrase of CONTEXT_SOURCES)if(dictionary[phrase])contexts[locale][phrase]=dictionary[phrase];
 if(locale.startsWith('en'))continue;
 for(const original of recipeNames){
  const local=dictionary[original];if(!local||local===original)continue;
  const key=local.toLowerCase().normalize('NFKC').replace(/[’']/g,'').replace(/[-–—]/g,' ').replace(/\s+/g,' ').trim();
  const canonical=recipeCanonical.get(original)??original;
  if(aliases.has(key)&&aliases.get(key)!==canonical){ambiguous.add(key);continue;}aliases.set(key,canonical);
 }
 // Machine-translated core names supplement the licensed taxonomy, especially
 // for the newer App Store languages. They never supply product ingredients.
 const names:Record<string,string[]>={};
 for(const record of ingredientCatalog.filter(record=>!record.id.startsWith('off-'))){
  const local=dictionary[record.name];if(local&&local!==record.name)international.records.push({id:record.id,names:{[locale.split('-')[0]]:[local,...(record.name.includes('(')?[local.replace(/\([^)]*\)/g,'').trim()]:[])]}});
 }
}
for(const key of ambiguous)aliases.delete(key);
await fs.writeFile('src/i18n/foodNames.json',JSON.stringify(Object.fromEntries(aliases))+'\n');
await fs.writeFile('src/i18n/labelContext.json',JSON.stringify(contexts)+'\n');
// De-duplicate to keep this script idempotent.
international.records=[...new Map(international.records.map((row:any)=>[JSON.stringify(row),row])).values()];
await fs.writeFile('src/data/internationalIngredients.json',JSON.stringify(international)+'\n');
const app=JSON.parse(await fs.readFile('app.json','utf8'));
app.expo.ios.infoPlist.CFBundleLocalizations=LOCALES.map(([code])=>code);
app.expo.ios.infoPlist.CFBundleDevelopmentRegion='en-GB';
app.expo.locales={};
app.expo.plugins=app.expo.plugins.filter((plugin:any)=>(Array.isArray(plugin)?plugin[0]:plugin)!=='expo-localization');
app.expo.plugins.push(['expo-localization',{supportsRTL:true,supportedLocales:{ios:LOCALES.map(([code])=>code)}}]);
app.expo.extra={...app.expo.extra,supportsRTL:true};
for(const [locale]of LOCALES){
 const dictionary=catalogs[locale]??{};
 const translate=(text:string)=>dictionary[text]??text;
 const native={NSCameraUsageDescription:translate('Scan product barcodes and photograph ingredient lists so Bellywise can help you log food and drinks.'),NSPhotoLibraryUsageDescription:translate('Choose an ingredient-label photo to read privately on this device.')};
 await fs.mkdir('localization/native',{recursive:true});await fs.writeFile(`localization/native/${locale}.json`,JSON.stringify({ios:native},null,2)+'\n');
 app.expo.locales[locale]=`./localization/native/${locale}.json`;
 const widget:Record<string,string>={};
 for(const source of ['Food or drink','Log a feeling','Review day','Bellywise quick log','Log food or drinks, record how you feel, or review your day.'])widget[source]=translate(source);
 await fs.mkdir(`native/BellywiseQuickLog/${locale}.lproj`,{recursive:true});
 await fs.writeFile(`native/BellywiseQuickLog/${locale}.lproj/Localizable.strings`,Object.entries(widget).map(([key,value])=>`${JSON.stringify(key)} = ${JSON.stringify(value)};`).join('\n')+'\n');
}
await fs.writeFile('app.json',JSON.stringify(app,null,2)+'\n');
await fs.writeFile('localization/coverage.json',JSON.stringify({generatedAt:'2026-11-26',locales:LOCALES.map(([code])=>({code,messages:Object.keys(catalogs[code]??{}).length,rtl:isRTL(code)})),recipeAliases:aliases.size,ingredientAliasRows:international.records.length,reviewStatus:'Machine translations; not independently reviewed. Native device verification pending.'},null,2)+'\n');
console.log(`Finalised ${LOCALES.length} locales; ${aliases.size} translated meal aliases.`);
