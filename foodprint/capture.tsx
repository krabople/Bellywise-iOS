import React, { useEffect, useState } from 'react';
import { Image, Linking, Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureApp as App, type CaptureState } from './App';
import { configureLocale, t, type AppLocale } from './src/i18n';
import { isAppLocale } from './src/i18n/locales';
import { getDemoData, analyzePatterns, BUILT_IN_SYMPTOMS, ingredientsFromNames } from './src/domain';
import { ingredientDisplayName } from './src/domain/ingredients';
import { parseIngredientLabel } from './src/services/labelParser';
import { emptyDiary } from './src/storage/schema';
import { PhotoRegion } from './src/components/PhotoRegion';
import { IngredientDetails } from './src/components/IngredientDetails';
import fixture from './marketing/product-fixture.json';

// Separate visual-test entry point. package.json in the shipped app stays index.ts.
const scenes = ['journal','ingredients','patterns','symptom','photo','ingredient','repeat','checkin','notifications','privacy','discover'] as const;
type Scene = typeof scenes[number];
function stateFor(locale: AppLocale, scene: Scene): CaptureState {
 const date='2026-11-26';
 const data=getDemoData(new Date('2026-11-27T12:00:00'));
 data.meals=data.meals.map(meal=>({...meal,name:t(meal.name),ingredients:meal.ingredients.map(item=>({...item,name:ingredientDisplayName(item.id,item.name)}))}));
 data.notificationPreferences={foodRemindersEnabled:true,foodReminderTimes:[{key:'breakfast',hour:8,minute:0},{key:'lunch',hour:13,minute:0},{key:'dinner',hour:19,minute:0}],dayReviewReminderEnabled:true,dayReviewReminderHour:20,dayReviewReminderMinute:30,patternAlertsEnabled:true,notifiedPatternKeys:[]};
 const diary={...emptyDiary(),welcomed:true,selectedSymptoms:BUILT_IN_SYMPTOMS.map(s=>s.id),localePreferences:{language:locale,region:'FR'} as const,data};
 const result:CaptureState={diary,date,tab:'journal',modal:null};
 if(scene==='ingredients')result.modal={type:'meal',meal:{id:'catalog-fixture',name:'Nutella',eatenAt:date+'T12:30:00',source:'label',productCode:fixture.code,labelText:fixture.product.ingredients_text_fr,ingredients:ingredientsFromNames([...parseIngredientLabel(fixture.product.ingredients_text_fr,{source:'catalog'}).ingredients, 'Soy lecithin'])}};
 if(scene==='patterns') {result.tab='patterns';const pattern=analyzePatterns(data).patterns.find(p=>p.ingredientId==='milk'&&p.symptomId==='bloating'&&p.window==='same-day');if(pattern)result.modal={type:'pattern',pattern};}
 if(scene==='symptom')result.modal={type:'symptom',symptom:{id:'illustrative-feeling',symptomId:'bloating',occurredAt:date+'T11:00:00',severity:4}};
 if(scene==='repeat')result.modal={type:'repeat',ids:[data.meals.find(m=>m.id==='demo-lunch-41')!.id],day:date};
 if(scene==='checkin')result.modal={type:'checkin',date};
 if(scene==='notifications'){result.tab='you';result.modal={type:'notifications'};}
 if(scene==='privacy'){result.tab='you';result.modal={type:'privacy'};}
 if(scene==='discover')result.tab='learn';
 return result;
}
function CaptureRoot(){
 const [selection,setSelection]=useState<{locale:AppLocale;scene:Scene;state:CaptureState}|null>(null);
 useEffect(()=>{
  const open=(url:string)=>{const query=new URL(url).searchParams;const locale=query.get('locale'),scene=query.get('scene');if(!isAppLocale(locale)||!scenes.includes(scene as Scene))return;configureLocale({language:locale,region:'FR'});setSelection({locale,scene:scene as Scene,state:stateFor(locale,scene as Scene)});};
  if(Platform.OS==='web')open(window.location.href);else void Linking.getInitialURL().then(url=>{if(url)open(url);});
  const listener=Linking.addEventListener('url',event=>open(event.url));return()=>listener.remove();
 },[]);
 const photo=Platform.OS==='web'?require('./marketing/assets/recorded-label.png'):Image.resolveAssetSource(require('./marketing/assets/recorded-label.png'));
 const photoUri=typeof photo==='string'?photo:photo.uri;
 return <SafeAreaProvider><App key={selection?`${selection.locale}:${selection.scene}`:'welcome'} capture={selection?.state}/>{selection?.scene==='photo'&&<PhotoRegion uri={photoUri} width={700} height={1304} onCancel={()=>{}} onConfirm={()=>{}}/>}{selection?.scene==='ingredient'&&<IngredientDetails id="milk" onClose={()=>{}}/>}</SafeAreaProvider>;
}
registerRootComponent(CaptureRoot);
