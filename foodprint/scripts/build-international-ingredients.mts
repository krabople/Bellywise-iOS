/** Reuse the SAME taxonomy revision as the English database; keep every diary ID stable. */
import fs from 'node:fs/promises';
import { findIngredientRecord } from '../src/domain/ingredients';
const meta = JSON.parse(await fs.readFile('src/data/openFoodFactsIngredients.json','utf8'));
const url=`https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/${meta.revision}/taxonomies/food/ingredients.txt`;
const response=await fetch(url); if(!response.ok)throw new Error(`Taxonomy download: ${response.status}`);
const text=await response.text();
const records: {id:string; names:Record<string,string[]>}[]=[];
for(const block of text.replace(/\r/g,'').split(/\n\s*\n/)){
  const lines=block.split('\n'); const english=lines.find(line=>line.startsWith('en:'))?.slice(3).split(',').map(x=>x.trim());
  if(!english?.length)continue;
  const owner=english.map(name=>findIngredientRecord(name)).find(Boolean); if(!owner)continue;
  const names:Record<string,string[]>={};
  for(const line of lines){const match=/^([a-z]{2,3}(?:_[a-z]{2})?):\s*(.+)$/.exec(line);if(!match||match[1]==='en')continue;
    names[match[1]]=match[2].split(',').map(x=>x.trim()).filter(x=>x.length>=2&&x.length<=160);
  }
  if(Object.keys(names).length)records.push({id:owner.id,names});
}
await fs.writeFile('src/data/internationalIngredients.json',JSON.stringify({source:meta.source,license:meta.license,sourceUrl:meta.sourceUrl,revision:meta.revision,generatedAt:'2026-11-26',records})+'\n');
console.log(JSON.stringify({records:records.length,aliases:records.reduce((n,row)=>n+Object.values(row.names).flat().length,0),languages:new Set(records.flatMap(row=>Object.keys(row.names))).size}));
