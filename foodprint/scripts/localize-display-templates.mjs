import fs from 'node:fs';import ts from 'typescript';
const files=['App.tsx',...fs.readdirSync('src/components').filter(x=>x.endsWith('.tsx')&&x!=='ui.tsx').map(x=>'src/components/'+x)];
for(const file of files){let source=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 const visit=node=>{
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='t')return;
  if(ts.isTemplateExpression(node)){
   let context=node.parent,display=false;
   while(context&&!ts.isSourceFile(context)){
    if(ts.isJsxAttribute(context)){display=['label','title','subtitle','accessibilityLabel','placeholder'].includes(context.name.getText(ast));break;}
    if(ts.isJsxElement(context)){display=['T','Heading','Notice'].includes(context.openingElement.tagName.getText(ast));break;}
    if(ts.isArrowFunction(context)||ts.isFunctionDeclaration(context))break;
    context=context.parent;
   }
   if(display){let key=node.head.text,values=[];for(const span of node.templateSpans){key+='{'+values.length+'}'+span.literal.text;values.push(span.expression.getText(ast));}
    edits.push([node.getStart(ast),node.end,`t(${JSON.stringify(key)}, [${values.join(', ')}])`]);return;
   }
  }ts.forEachChild(node,visit);
 };visit(ast);for(const[start,end,text]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,start)+text+source.slice(end);fs.writeFileSync(file,source);
}
