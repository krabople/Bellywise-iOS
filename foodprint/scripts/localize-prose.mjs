import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const files=['App.tsx',...['src/components','src/services','src/domain'].flatMap(dir=>fs.readdirSync(dir).filter(name=>/\.tsx?$/.test(name)).map(name=>dir+'/'+name))];
for(const file of files){
 if(/(?:statistics|types|demo|catalogMatching|dates|ui|extraRecipes)\.tsx?$/.test(file))continue;
 let source=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const edits=[];
 const visit=node=>{
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='t')return;
  if(ts.isTemplateExpression(node)){
   const prose=node.head.text+node.templateSpans.map(s=>s.literal.text).join('');
   if(/[a-z]{2}.*\s|\s.*[a-z]{2}/i.test(prose)&&!/(?:https?:|[\\]|SELECT |INSERT |CREATE )/.test(prose)){
    let key=node.head.text,values=[];
    for(const span of node.templateSpans){key+='{'+values.length+'}'+span.literal.text;values.push(span.expression.getText(ast));}
    edits.push([node.getStart(ast),node.end,`t(${JSON.stringify(key)}, [${values.join(', ')}])`]);return;
   }
  }
  ts.forEachChild(node,visit);
 };visit(ast);
 if(!edits.length)continue;
 for(const [start,end,text]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,start)+text+source.slice(end);
 if(!/import \{[^}]*\bt\b[^}]*\} from ['"][^'"]*i18n['"]/.test(source)){
  const relative=path.relative(path.dirname(file),'src/i18n').replaceAll('\\','/');source=`import { t } from '${relative.startsWith('.')?relative:'./'+relative}';\n`+source;
 }
 fs.writeFileSync(file,source);
}
