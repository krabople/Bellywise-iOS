import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
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
async function screenshot(locale,device,item,translate){
 const ipad=device==='ipad',width=ipad?2048:1320,height=ipad?2732:2868;
 const folder=ipad?'App Store iPad/screenshots':'App Store screenshots/iPhone-6.9';
 const filename=`${String(item.order).padStart(2,'0')}-${item.slug}.png`;
 const original=await fs.readFile(path.join(root,folder,filename));
 if(locale.startsWith('en')) {
  const dest=path.join(output,locale,device);await fs.mkdir(dest,{recursive:true});
  await fs.writeFile(path.join(dest,filename),original);return filename;
 }
 const bg=item.theme==='dark'?'#254838':item.theme==='sage'?'#E9EEDC':item.theme==='sand'?'#F0E9DB':'#F8F6EF';
 const fg=item.theme==='dark'?'#F8F6EF':'#254838';const muted=item.theme==='dark'?'#C7D4BA':'#5B7063';
 const margin=ipad?134:110,available=width-margin*2;
 const patches=[{input:await sharp({create:{width,height:540,channels:3,background:bg}}).png().toBuffer(),left:0,top:200}];
 const place=async(text,top,size,maxHeight,color,left=margin,w=available)=>{
  const image=await textImage(translate(text),locale,color,w,maxHeight,size);
  patches.push({input:image.input,left:/^(ar|he|ur)$/.test(locale)?left+w-image.width:left,top});
 };
 await place(item.eyebrow,ipad?226:213,ipad?33:27,50,muted);
 await place(item.title,ipad?294:281,ipad?134:108,250,fg);
 await place(item.subtitle,ipad?606:565,ipad?46:41,130,muted);
 for(const label of item.labels){
  const [x,y]=label.xy;const h=ipad?58:48,w=width-x-margin;
  patches.push({input:await sharp({create:{width:w,height:h,channels:3,background:bg}}).png().toBuffer(),left:x,top:y});
  await place(label.text,y,label.size,h,muted,x,w);
 }
 for(const footer of item.footers){
  const top=footer.y-3,h=Math.min(height-top,ipad?90:72);
  patches.push({input:await sharp({create:{width,height:h,channels:3,background:bg}}).png().toBuffer(),left:0,top});
  await place(footer.text,footer.y,ipad?34:29,h-4,muted);
 }
 if(!locale.startsWith('en')) await place('App shown in English.',105,ipad?25:19,50,muted,Math.round(width*.55),Math.round(width*.36));
 const dest=path.join(output,locale,device);await fs.mkdir(dest,{recursive:true});
 const result=await sharp(original).composite(patches).flatten({background:bg}).removeAlpha().png({compressionLevel:7}).toBuffer();
 const meta=await sharp(result).metadata();if(meta.width!==width||meta.height!==height||meta.hasAlpha)throw new Error('Invalid screenshot export');
 await fs.writeFile(path.join(dest,filename),result);
 return filename;
}
const manifest=[];
for(const locale of locales){
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
 manifest.push({locale,preview:metadata.previewPolicy,screenshots:files,issues:metadata.issues});
 console.log(`Prepared ${locale}: 20 screenshots; description ${metadata.description.length} characters.`);
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
