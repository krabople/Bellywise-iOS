import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureApp as App, type CaptureState } from './App';
import { configureLocale, getLocale, t, type AppLocale } from './src/i18n';
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
 const [selection,setSelection]=useState<{locale:AppLocale;scene:Scene;state:CaptureState;sequence:number}|null>(null);
 const seen=useRef(-1);
 const device=Dimensions.get('window').width>=760?'ipad':'iphone';
 useEffect(()=>{
  let live=true,busy=false;
  const apply=(locale:unknown,scene:unknown,sequence:number)=>{if(!isAppLocale(locale)||!scenes.includes(scene as Scene)||seen.current===sequence)return;seen.current=sequence;configureLocale({language:locale,region:'FR'});setSelection({locale,scene:scene as Scene,state:stateFor(locale,scene as Scene),sequence});};
  if(Platform.OS==='web'){const query=new URL(window.location.href).searchParams;apply(query.get('locale'),query.get('scene'),0);return;}
  const poll=async()=>{if(busy)return;busy=true;try{const response=await fetch('http://localhost:8769/fixture?device='+device,{cache:'no-store'});const fixture=await response.json();if(live&&fixture)apply(fixture.locale,fixture.scene,fixture.sequence);}catch{}finally{busy=false;}};
  void poll();const timer=setInterval(()=>void poll(),350);return()=>{live=false;clearInterval(timer);};
 },[]);
 useEffect(()=>{if(!selection||Platform.OS==='web')return;const timer=setTimeout(()=>{void fetch('http://localhost:8769/ready?device='+device+'&sequence='+selection.sequence+'&locale='+encodeURIComponent(getLocale())+'&scene='+selection.scene).catch(()=>{});},350);return()=>clearTimeout(timer);},[selection]);
 const photo=Platform.OS==='web'?require('./marketing/assets/recorded-label.png'):Image.resolveAssetSource(require('./marketing/assets/recorded-label.png'));
 const photoUri=typeof photo==='string'?photo:photo.uri;
 return <SafeAreaProvider><App key={selection?selection.locale+':'+selection.scene+':'+selection.sequence:'welcome'} capture={selection?.state}/>{selection?.scene==='photo'&&<PhotoRegion uri={photoUri} width={700} height={1304} onCancel={()=>{}} onConfirm={()=>{}}/>}{selection?.scene==='ingredient'&&<IngredientDetails id="milk" onClose={()=>{}}/>}</SafeAreaProvider>;
}

registerRootComponent(CaptureRoot);
