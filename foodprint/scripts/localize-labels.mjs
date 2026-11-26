import fs from 'node:fs';import ts from 'typescript';
const files=['App.tsx',...fs.readdirSync('src/components').filter(x=>x.endsWith('.tsx')&&x!=='ui.tsx').map(x=>'src/components/'+x)];
for(const file of files){let source=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 const visit=node=>{
  if(ts.isJsxAttribute(node)&&['label','title','subtitle','placeholder','accessibilityLabel','action'].includes(node.name.getText(ast))&&node.initializer&&ts.isJsxExpression(node.initializer)&&node.initializer.expression){
   const expression=node.initializer.expression;if(ts.isCallExpression(expression)&&['t','tx','ingredientDisplayName','marketName'].includes(expression.expression.getText(ast)))return;
   edits.push([expression.getStart(ast),expression.end,'tx('+expression.getText(ast)+')']);return;
  }
  ts.forEachChild(node,visit);
 };visit(ast);
 if(!edits.length)continue;
 for(const[start,end,text]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,start)+text+source.slice(end);
 source=source.replace(/import \{([^}]*\bt\b[^}]*)\} from ('[^']*i18n');/,(_,members,from)=>`import {${members.trim()}, tx } from ${from};`);
 fs.writeFileSync(file,source);
}
