import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const root=path.resolve('..');
const output=path.join(root,'artifacts/international-listing');
const catalogs=JSON.parse(await fs.readFile('src/i18n/messages.json','utf8'));
const overrides=JSON.parse(await fs.readFile('localization/terminology-overrides.json','utf8'));
for(const [locale,rows]of Object.entries(overrides))Object.assign(catalogs[locale]??={},rows);
const source=JSON.parse(await fs.readFile('localization/marketing-source.json','utf8'));
const localeSource=await fs.readFile('src/i18n/locales.ts','utf8');
const allLocales=[...localeSource.split('] as const')[0].matchAll(/\['([^']+)', '/g)].map(m=>m[1]);
const requested=process.argv.find(arg=>arg.startsWith('--locales='))?.split('=')[1].split(',');
const locales=requested?allLocales.filter(locale=>requested.includes(locale)):allLocales;
const description=(await fs.readFile('../artifacts/app-store-listing/description-en-GB-revised.txt','utf8')).trim();
const english=JSON.parse(await fs.readFile('../artifacts/app-store-listing/final-en-GB.json','utf8'));
const escape=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function fontFor(locale){
 if(/^(bn|gu|hi|kn|ml|mr|or|pa|ta|te)$/.test(locale))return ['Nirmala UI','Nirmala.ttc'];
 if(locale==='zh-Hans')return ['Microsoft YaHei','msyh.ttc'];
 if(locale==='zh-Hant')return ['Microsoft JhengHei','msjh.ttc'];
 if(locale==='ja')return ['Yu Gothic','YuGothR.ttc'];
 if(locale==='ko')return ['Malgun Gothic','malgun.ttf'];
 if(locale==='th')return ['Leelawadee UI','LeelawUI.ttf'];
 if(/^(ar|he|ur)$/.test(locale))return ['Tahoma','tahoma.ttf'];
 return ['Segoe UI','segoeui.ttf'];
}
async function textImage(text,locale,color,width,maxHeight,size){
 const [family,file]=fontFor(locale);const rtl=/^(ar|he|ur)$/.test(locale);
 for(let point=size;point>=16;point-=2){
  const {data,info}=await sharp({text:{text:`<span foreground="${color}">${escape(text.replace(/\n/g,' '))}</span>`,font:`${family} ${point}`,fontfile:`C:/Windows/Fonts/${file}`,width,rgba:true,align:rtl?'right':'left',spacing:Math.round(point*.15)}}).png().toBuffer({resolveWithObject:true});
  if(info.height<=maxHeight)return {input:data,width:info.width,height:info.height};
 }
 throw new Error(`Caption does not fit: ${locale}: ${text}`);
}
async function cropTabletPopup(raw){
 const {data,info}=await sharp(raw).removeAlpha().raw().toBuffer({resolveWithObject:true});
 let minX=info.width,minY=info.height,maxX=-1,maxY=-1;
 for(let y=0;y<info.height;y++){
  let count=0,left=info.width,right=-1;
  for(let x=0;x<info.width;x++){const i=(y*info.width+x)*info.channels;if(data[i]>=250&&data[i+1]>=250&&data[i+2]>=250){count++;left=Math.min(left,x);right=x;}}
  if(count>500){minX=Math.min(minX,left);maxX=Math.max(maxX,right);minY=Math.min(minY,y);maxY=y;}
 }
 if(maxX<minX||maxY<minY)throw new Error('No actual tablet popup bounds found');
 const left=Math.max(0,minX-16),top=Math.max(0,minY-16),width=Math.min(info.width-left,maxX-minX+33),height=Math.min(info.height-top,maxY-minY+33);
 return sharp(raw).extract({left,top,width,height}).png().toBuffer();
}
async function screenshot(locale,device,item,translate){
 const ipad=device==='ipad',width=ipad?2048:1320,height=ipad?2732:2868;
 const filename=String(item.order).padStart(2,'0')+'-'+item.slug+'.png';
 const dest=path.join(output,locale,device);await fs.mkdir(dest,{recursive:true});
 if(locale.startsWith('en')){
  const folder=ipad?'App Store iPad/screenshots':'App Store screenshots/iPhone-6.9';
  await fs.copyFile(path.join(root,folder,filename),path.join(dest,filename));return filename;
 }
 const folder=path.join(root,'artifacts/localized-captures',locale,device);
 const files=await fs.readdir(folder);
 const file=files.find(name=>name.startsWith(String(item.order).padStart(2,'0')+'-')&&name.endsWith('.png'));
 if(!file)throw new Error('Missing actual localised iOS capture: '+locale+'/'+device+'/'+item.order);
 const raw=await fs.readFile(path.join(folder,file));
 const bg=item.theme==='dark'?'#254838':item.theme==='sage'?'#E9EEDC':item.theme==='sand'?'#F0E9DB':'#F8F6EF';
 const fg=item.theme==='dark'?'#F8F6EF':'#254838',muted=item.theme==='dark'?'#C7D4BA':'#5B7063';
 const margin=ipad?134:110,available=width-margin*2,patches=[];
 const brand=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="180"><text x="'+margin+'" y="130" font-family="Georgia" font-size="'+(ipad?76:61)+'" fill="'+fg+'">bellywise</text><path d="M'+margin+' 169 H'+(width-margin)+'" stroke="'+muted+'" opacity=".3"/></svg>');
 patches.push({input:brand,left:0,top:0});
 const place=async(text,top,size,maxHeight,color)=>{const image=await textImage(translate(text),locale,color,available,maxHeight,size);patches.push({input:image.input,left:/^(ar|he|ur)$/.test(locale)?width-margin-image.width:margin,top});};
 await place(item.eyebrow,ipad?218:208,ipad?32:26,55,muted);
 await place(item.title,ipad?300:280,ipad?114:96,250,fg);
 await place(item.subtitle,ipad?570:555,ipad?43:38,140,muted);
 const box={left:ipad?220:180,top:ipad?760:760,width:ipad?1608:960,height:ipad?1840:1980};
 const appPixels=ipad&&![1,8].includes(item.order)?await cropTabletPopup(raw):raw;
 const content=await sharp(appPixels).resize(box.width,box.height,{fit:'contain',background:bg}).png().toBuffer();
 const mask=Buffer.from('<svg width="'+box.width+'" height="'+box.height+'"><rect width="100%" height="100%" rx="'+(ipad?45:50)+'" fill="white"/></svg>');
 const framed=await sharp(content).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
 patches.push({input:framed,left:box.left,top:box.top});
 const footer=item.footers[0]?.text;
 if(footer)await place(footer,height-70,ipad?28:24,65,muted);
 const result=await sharp({create:{width,height,channels:3,background:bg}}).composite(patches).flatten({background:bg}).removeAlpha().png({compressionLevel:7}).toBuffer();
 await fs.writeFile(path.join(dest,filename),result);return filename;
}
const manifest=[];
for(const locale of locales){
 let captureSource;
 if(!locale.startsWith('en')){
  const captureRoot=path.join(root,'artifacts/localized-captures');
  const capture=JSON.parse(await fs.readFile(path.join(captureRoot,locale,'capture-manifest.json'),'utf8'));
  if(capture.locale!==locale||!/^[a-f0-9]{40}$/.test(capture.source)||capture.screenshots.length!==20)throw Error('Incomplete native capture manifest: '+locale);
  for(const device of ['iphone','ipad']){
   const records=capture.screenshots.filter(record=>record.device===device);
   if(records.length!==10||new Set(records.map(record=>record.order)).size!==10)throw Error('Incomplete device captures: '+locale+'/'+device);
   for(const record of records){
    const expectedPrefix=locale+'/'+device+'/';
    if(!record.file.startsWith(expectedPrefix)||record.file.includes('..'))throw Error('Invalid capture path');
    const pixels=await fs.readFile(path.join(captureRoot,record.file));
    if(createHash('sha256').update(pixels).digest('hex')!==record.sha256)throw Error('Native capture hash differs: '+record.file);
   }
  }
  captureSource=capture.source;
 }
 const dictionary=catalogs[locale]??{};
 const translate=text=>dictionary[text]??text;
 let localizedDescription=translate(description);
 const omittedDescriptionParagraphs=[];
 if(localizedDescription.length>4000){
  const paragraphs=localizedDescription.split(/\n\s*\n/);
  // Preserve the purpose, needle-in-a-haystack explanation, barcode logging,
  // symptom logging, privacy and the complete safety statement. If needed,
  // omit whole optional feature paragraphs, never cut a sentence or warning.
  if(paragraphs.length>=10){
   for(const index of [7,5,4]){
    omittedDescriptionParagraphs.push(index);
    localizedDescription=paragraphs.filter((_,i)=>!omittedDescriptionParagraphs.includes(i)).join('\n\n');
    if(localizedDescription.length<=4000)break;
   }
  }
 }
 const subtitleCandidates=[translate('Intolerance & trigger tracker'),translate('Track possible food triggers'),translate('Find ingredient patterns')];
 const subtitle=overrides[locale]?.['App Store subtitle'] ?? subtitleCandidates.find(x=>[...x].length<=30);
 const title=`Bellywise ${translate('Food & symptom diary')}`;
 const keywordCandidates=translate(english.keywords).split(/[,،、，;]/).map(word=>word.trim()).filter(Boolean);
 const keywords=[];for(const word of keywordCandidates)if(Buffer.byteLength([...keywords,word].join(','))<=100&&!keywords.includes(word))keywords.push(word);
 const metadata={locale:locale==='nb'?'no':locale,appLocale:locale,name:locale.startsWith('en')?english.name:[...title].length<=30?title:'Bellywise',subtitle:subtitle??'Bellywise',description:localizedDescription,promotionalText:translate('Spot possible food triggers. Scan barcodes to log ingredients quickly, record symptoms, reuse meals and explore patterns. Your diary stays on your device.'),keywords:keywords.join(','),supportUrl:locale.startsWith('en')?english.supportUrl:english.supportUrl.replace('/support.html',`/languages/${locale}/support.html`),privacyUrl:locale.startsWith('en')?english.privacyUrl:english.privacyUrl.replace('/privacy.html',`/languages/${locale}/privacy.html`),previewPolicy:locale.startsWith('en')?'include-existing-English-preview':'remove-any-inherited-preview-and-leave-empty',translationReview:locale.startsWith('en')?'English source':'Machine translation; review pending',issues:[]};
 if(localizedDescription.length>4000)metadata.issues.push('Description exceeds 4000 characters');
 metadata.descriptionCondensed=omittedDescriptionParagraphs.length>0;
 if(!subtitle)metadata.issues.push('Subtitle needs a shorter local wording');
 if(metadata.promotionalText.length>170)metadata.promotionalText='';
 const files={iphone:[],ipad:[]};
 for(const [device,items]of Object.entries(source))for(const item of items)files[device].push(await screenshot(locale,device,item,translate));
 await fs.writeFile(path.join(output,locale,'metadata.json'),JSON.stringify(metadata,null,2)+'\n');
 manifest.push({locale,preview:metadata.previewPolicy,captureSource,screenshots:files,issues:metadata.issues});
 console.log(`Prepared ${locale}: 20 screenshots; description ${metadata.description.length} characters.`);
}
let previous=[];try{previous=JSON.parse(await fs.readFile(path.join(output,'manifest.json'),'utf8'));}catch{}
const merged=new Map([...previous,...manifest].map(item=>[item.locale,item]));
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(allLocales.map(locale=>merged.get(locale)).filter(Boolean),null,2)+'\n');
