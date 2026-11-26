import fs from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
const files=['App.tsx',...fs.readdirSync('src/components').filter(x=>x.endsWith('.tsx')).map(x=>'src/components/'+x)];
for(const file of files){
 let original;try{original=execFileSync('git',['show',`HEAD:foodprint/${file}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{continue;}
 const ast=ts.createSourceFile(file,original,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let output=fs.readFileSync(file,'utf8');
 const visit=node=>{
  if(ts.isJsxElement(node)&&['T','Heading','Notice'].includes(node.openingElement.tagName.getText(ast))&&node.children.every(child=>ts.isJsxText(child)||ts.isJsxExpression(child))){
   const build=correct=>{let text='',i=0;for(const child of node.children){if(ts.isJsxText(child))text+=(correct?child.text:child.getText(ast)).replace(/\r?\n\s*/g,' ').replace(/&amp;/g,'&').replace(/&gt;/g,'>').replace(/&lt;/g,'<');else if(child.expression){if(ts.isStringLiteral(child.expression))text+=child.expression.text;else text+='{'+i+++'}';}}return text;};
   const before=build(false),after=build(true);if(before!==after)output=output.replaceAll('t('+JSON.stringify(before),'t('+JSON.stringify(after));
  }ts.forEachChild(node,visit);
 };visit(ast);fs.writeFileSync(file,output);
}
