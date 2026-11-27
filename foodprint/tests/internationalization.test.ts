import test from 'node:test';
import assert from 'node:assert/strict';
import { configureLocale, getLocale, parseLocalizedNumber, resolveLocale, t } from '../src/i18n';
import { LOCALES, isRTL } from '../src/i18n/locales';
import { countryForRegion } from '../src/i18n/regions';
import { findIngredientRecord, ingredientFromText, ingredientsFromNames, expandIngredientExposuresForAnalysis } from '../src/domain/ingredients';
import { resolveFood } from '../src/domain/foods';
import { analyzePatterns } from '../src/domain/analysis';
import { getDemoData } from '../src/domain/demo';
import { parseDiary, emptyDiary } from '../src/storage/schema';
import { normalizeCatalogProduct } from '../src/services/products';
import { parseIngredientLabel } from '../src/services/labelParser';

test('supports every App Store localisation, including script and regional variants', () => {
  assert.equal(LOCALES.length, 50);
  assert.equal(resolveLocale(['zh-TW']), 'zh-Hant');
  assert.equal(resolveLocale(['zh-SG']), 'zh-Hans');
  assert.equal(resolveLocale(['es-AR']), 'es-MX');
  assert.equal(resolveLocale(['pt-PT']), 'pt-PT');
  assert.equal(resolveLocale(['no-NO']), 'nb');
  assert.equal(resolveLocale(['zz', 'de-CH']), 'de');
  assert.equal(isRTL('ur'), true);
  assert.equal(isRTL('he'), true);
  assert.equal(isRTL('ja'), false);
});

test('country and language are independent and do not default a foreign device to the UK', () => {
  configureLocale({ language: 'fr', region: 'US' }, { languages: ['de-DE'], region: 'DE' });
  assert.equal(getLocale(), 'fr');
  assert.equal(countryForRegion('AU'), 'Australia');
  assert.equal(countryForRegion('US'), 'United States');
  assert.equal(countryForRegion('unknown'), '');
  configureLocale({}, { languages: ['en-GB'], region: 'GB' });
});

test('localised numeric input is accepted without changing calendar-day storage', () => {
  configureLocale({ language: 'fr' }); assert.equal(parseLocalizedNumber('7,5'), 7.5);
  assert.ok(Number.isNaN(parseLocalizedNumber('7,5 hours')));
  configureLocale({ language: 'ar' }); assert.equal(parseLocalizedNumber('٧٫٥'), 7.5);
  configureLocale({ language: 'en-GB' });
});

test('known ingredient names across scripts keep the existing diary IDs', () => {
  for (const name of ['milk', 'lait', 'leche', 'Milch', 'latte', '牛乳']) assert.equal(findIngredientRecord(name)?.id, 'milk', name);
  assert.equal(findIngredientRecord('eau')?.id, 'water');
  assert.equal(findIngredientRecord('agua')?.id, 'water');
  assert.equal(findIngredientRecord('niacine')?.id, 'niacin');
  const first = ingredientFromText('नया पदार्थ');
  const second = ingredientFromText('दूसरा पदार्थ');
  assert.notEqual(first.id, second.id, 'different non-Latin custom ingredients must not collapse into custom-ingredient');
});

test('product lookup preserves published local label text and canonical ingredient evidence', () => {
  const product = normalizeCatalogProduct({ code: '1234567890123', lang: 'fr', product_name: 'Yaourt', product_name_en: 'Yoghurt', ingredients_text_fr: 'Lait, sucre', ingredients_text_en: 'Milk, sugar', ingredients: [{id:'en:milk',text:'Lait'}]}, 'fr');
  assert.equal(product?.name, 'Yaourt');
  assert.equal(product?.ingredientsText, 'Lait, sucre');
  assert.equal(findIngredientRecord(product!.ingredients[0].name)?.id, 'milk');
});

test('upstream canonical IDs cannot override negated ingredients or trace-only branches', () => {
  const product = normalizeCatalogProduct({code:'1234567890123',ingredients:[
    {id:'en:gluten',text:'gluten-free'},
    {id:'en:gluten',text:'无麸质'},
    {id:'en:milk',text:'May contain milk',ingredients:[{id:'en:milk',text:'Milk'}]},
    {id:'en:milk',text:'lactose-free milk'},
  ]});
  assert.equal(product?.ingredients.length,1);
  const exposures=ingredientsFromNames(product!.ingredients.map(item=>item.name));
  assert.equal(exposures[0].id,'milk');
  assert.ok(!expandIngredientExposuresForAnalysis(exposures).some(item=>item.id==='lactose'));
});

test('non-English comma separators preserve independent ingredients', () => {
  const parsed = parseIngredientLabel('Ingredients: lait、sucre، sel', { source: 'manual' });
  assert.equal(parsed.ingredients.length, 3);
});

test('translated dishes share recipes and free-from qualifiers stay attached', () => {
  assert.equal(resolveFood('spaghettis à la bolognaise').matched, true);
  const macaroni = resolveFood('macaroni au fromage');
  assert.equal(macaroni.matched, true);
  assert.ok(macaroni.ingredients.some(item => item.id === 'wheat'));
  const bread = resolveFood('glutenfreies Brot');
  assert.equal(bread.matched, true);
  assert.ok(!bread.ingredients.some(item => ['wheat','barley','rye','gluten'].includes(item.id)));
});

test('foreign labels preserve lactose exclusions without applying them to other milk', () => {
  const parsed = parseIngredientLabel('Ingrédients: lait sans lactose, sucre. Informations nutritionnelles: 10 g', { source:'catalog' });
  const ingredients = ingredientsFromNames(parsed.ingredients);
  assert.ok(ingredients.some(item => item.id === 'milk'));
  assert.ok(!expandIngredientExposuresForAnalysis(ingredients).some(item => item.id === 'lactose'));
  const withRegularMilk = ingredientsFromNames([...parsed.ingredients, 'Milk']);
  assert.ok(expandIngredientExposuresForAnalysis(withRegularMilk).some(item => item.id === 'lactose'));
  assert.deepEqual(ingredientFromText('not gluten-free wheat').excludedComponents, undefined);
});

test('changing interface language never changes numerical pattern evidence or diary values', () => {
  const now = new Date('2026-11-26T12:00:00'); const diary = getDemoData(now);
  const before = JSON.stringify(diary);
  const evidence = () => analyzePatterns(diary, { now }).patterns.map(pattern => [pattern.id,pattern.exposedDays,pattern.unexposedDays,pattern.exposedSymptomDays,pattern.unexposedSymptomDays,pattern.adjustedPValue,pattern.status]);
  configureLocale({ language:'en-GB' }); const english=evidence();
  for (const [language] of LOCALES) { configureLocale({ language }); assert.deepEqual(evidence(),english,language); }
  assert.equal(JSON.stringify(diary),before);
  configureLocale({ language:'en-GB' });
});

test('language preferences survive backups while older diaries remain compatible', () => {
  const diary = emptyDiary();
  assert.ok(parseDiary(JSON.stringify(diary)));
  diary.localePreferences = { language: 'ja', region: 'JP' };
  assert.deepEqual(parseDiary(JSON.stringify(diary)).localePreferences, diary.localePreferences);
  assert.throws(() => parseDiary(JSON.stringify({ ...diary, localePreferences: { language:'zz', region:'JP' } })));
  configureLocale({ language:'en-GB' });
  assert.equal(t('An unknown diary note'), 'An unknown diary note');
});

test('French decimal percentages preserve whole milk-powder and cocoa ingredient phrases', () => {
  configureLocale({ language: 'fr', region: 'FR' });
  const result = parseIngredientLabel('Sucre, cacao maigre 7,4%, LAIT écrémé en poudre 6,6%, LACTOSERUM en poudre.', { source: 'catalog' });
  const ids = ingredientsFromNames(result.ingredients).map(item => item.id);
  assert.ok(ids.includes('milk'));
  assert.ok(ids.includes('cocoa'));
  assert.ok(ids.includes('whey'));
  assert.equal(ids.some(id => id.startsWith('custom-')), false);
  configureLocale({ language: 'en-GB', region: 'GB' });
});

test('the real example diary uses localised meal names without changing ingredient evidence', () => {
  configureLocale({ language: 'en-GB', region: 'GB' });
  const english = getDemoData(new Date('2026-11-27T12:00:00'));
  configureLocale({ language: 'fr', region: 'FR' });
  const french = getDemoData(new Date('2026-11-27T12:00:00'));
  assert.notEqual(french.meals[0].name, english.meals[0].name);
  assert.equal(french.meals[1].name, t(english.meals[1].name));
  assert.deepEqual(french.meals.map(meal => meal.ingredients), english.meals.map(meal => meal.ingredients));
  const milkCounts = (data: typeof english) => analyzePatterns(data).patterns.filter(p => p.ingredientId === 'milk').map(p => [p.symptomId,p.window,p.exposedDays,p.exposedSymptomDays,p.unexposedDays,p.unexposedSymptomDays]);
  assert.deepEqual(milkCounts(french), milkCounts(english));
  configureLocale({ language: 'en-GB', region: 'GB' });
});
