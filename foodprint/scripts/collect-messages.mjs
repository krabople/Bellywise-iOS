import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const messages=new Set();
for(const word of ['feelings','symptoms','food','drink','less','more','lower','higher','confirmed','inferred','emerging','exploratory','unknown','not available','not recorded','yes','no'])messages.add(word);
const walk=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(folder,entry.name)):[path.join(folder,entry.name)]);
const files=['App.tsx',...walk('src').filter(x=>/\.tsx?$/.test(x)&&!/[\\/]i18n[\\/]/.test(x))];
for(const file of files){
 const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const visit=node=>{if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){
   const v=node.text;
   if(v.length>=2 && /[a-z]/i.test(v) && !/^(?:https?:|\.|#|[A-Z_]+$)/.test(v) && !/[\\/]/.test(v.slice(0,30)) && (v.includes(' ')||/^[A-Z][a-z]+$/.test(v))) messages.add(v);
 }ts.forEachChild(node,visit);};visit(ast);
}
// Single-word ingredient and curated dish names also need translations.
const ingredientSource=fs.readFileSync('src/domain/ingredients.ts','utf8');
const core=ingredientSource.slice(ingredientSource.indexOf('const CORE_ROWS'),ingredientSource.indexOf('const core ='));
for(const match of core.matchAll(/\['([^']+)', '([^']+)'/g)) messages.add(match[2]);
for(const file of ['src/domain/foods.ts','src/domain/extraRecipes.ts']){
 const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const visit=node=>{if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='names'&&ts.isArrayLiteralExpression(node.initializer))for(const item of node.initializer.elements)if(ts.isStringLiteral(item))messages.add(item.text);ts.forEachChild(node,visit);};visit(ast);
}
// Native UI and store text are public, static content, never diary entries.
for(const value of ['Food or drink','Log a feeling','Review day','Bellywise quick log','Log food or drinks, record how you feel, or review your day.',
'Scan product barcodes and photograph ingredient lists so Bellywise can help you log food and drinks.',
'Choose an ingredient-label photo to read privately on this device.'])messages.add(value);
const context=fs.readFileSync('src/i18n/labelContext.ts','utf8').split('] as const')[0];
for(const match of context.matchAll(/'([^']+)'/g))if(!match[1].includes('/'))messages.add(match[1]);
const store=JSON.parse(fs.readFileSync('../artifacts/app-store-listing/final-en-GB.json','utf8'));
for(const value of Object.values(store))if(typeof value==='string'&&value.length>15&&!/^https?:/.test(value))messages.add(value);
messages.add(fs.readFileSync('../artifacts/app-store-listing/description-en-GB-revised.txt','utf8').trim());
fs.mkdirSync('localization',{recursive:true});
if(fs.existsSync('localization/marketing-messages.json'))for(const text of JSON.parse(fs.readFileSync('localization/marketing-messages.json','utf8')))messages.add(text);
fs.writeFileSync('localization/source-messages.json',JSON.stringify([...messages].sort(),null,2)+'\n');
console.log(`Collected ${messages.size} static messages (${[...messages].join('').length} characters)`);
