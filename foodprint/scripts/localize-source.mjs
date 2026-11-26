// One-time source migration. Only presentation nodes are changed; database IDs,
// comparisons, diary strings, URLs and ingredient inference remain untouched.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const files = ['App.tsx', ...fs.readdirSync('src/components').filter(x=>x.endsWith('.tsx')).map(x=>'src/components/'+x)];
const displayTags = new Set(['T','Heading','Notice']);
for (const file of files) {
  if (file === 'src/components/ui.tsx') continue;
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const translate = (text, values=[]) => `t(${JSON.stringify(text)}${values.length ? ', ['+values.join(', ')+']' : ''})`;
  const visit = node => {
    if (ts.isJsxElement(node) && displayTags.has(node.openingElement.tagName.getText(ast))) {
      if (node.children.every(child=>ts.isJsxText(child)||ts.isJsxExpression(child))) {
        let key = '', values=[];
        for (const child of node.children) {
          if (ts.isJsxText(child)) key += child.getText(ast).replace(/\r?\n\s*/g,' ').replace(/&amp;/g,'&').replace(/&gt;/g,'>').replace(/&lt;/g,'<');
          else if (child.expression) {
            if (ts.isStringLiteral(child.expression)) key += child.expression.text;
            else { key += '{'+values.length+'}'; values.push(child.expression.getText(ast)); }
          }
        }
        if (/[a-z]/i.test(key) && key.replace(/\{\d+\}/g,'').trim()) {
          edits.push([node.openingElement.end,node.closingElement.getStart(ast),'{'+translate(key,values)+'}']);
          ts.forEachChild(node.openingElement,visit); return;
        }
      }
    }
    if (ts.isJsxAttribute(node) && ['title','subtitle','label','placeholder','accessibilityLabel','action'].includes(node.name.getText(ast)) && node.initializer) {
      const init=node.initializer;
      if(ts.isStringLiteral(init) && /[a-z]/i.test(init.text)) { edits.push([init.getStart(ast),init.end,'{'+translate(init.text)+'}']); return; }
    }
    // Error and toast text is translated when created, not by examining user data.
    if (ts.isCallExpression(node) && /^(setError|setNotice|Alert\.alert)$/.test(node.expression.getText(ast))) {
      for (const arg of node.arguments) if(ts.isStringLiteral(arg) && /[a-z]/i.test(arg.text)) edits.push([arg.getStart(ast),arg.end,translate(arg.text)]);
    }
    if (ts.isNewExpression(node) && node.expression.getText(ast)==='Error') {
      const arg=node.arguments?.[0]; if(arg && ts.isStringLiteral(arg)) edits.push([arg.getStart(ast),arg.end,translate(arg.text)]);
    }
    ts.forEachChild(node,visit);
  };
  visit(ast);
  if (!edits.length) continue;
  let output=source;
  for(const [start,end,text] of edits.sort((a,b)=>b[0]-a[0])) output=output.slice(0,start)+text+output.slice(end);
  const relative=path.relative(path.dirname(file),'src/i18n').replaceAll('\\','/');
  output=`import { t } from '${relative.startsWith('.')?relative:'./'+relative}';\n`+output;
  fs.writeFileSync(file,output);
}
