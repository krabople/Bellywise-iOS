import translations from './labelContext.json';
export const CONTEXT_SOURCES = [
  'Ingredients', 'May contain', 'Allergy advice', 'Nutrition information', 'Storage instructions', 'Best before',
  'Manufactured by', 'Distributed by', 'Made in', 'Contact us', 'Website', 'Email',
  'Gluten free', 'Lactose free', 'Dairy free', 'Milk free', 'Without gluten', 'Without lactose',
  'No added sugar', 'Sugar free', 'Alcohol free', 'Caffeine free', 'Vegan', 'Vegetarian',
] as const;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Phrases are matched as a whole; a claim such as “sans gluten” must not turn
// into a positive gluten exposure. CJK has no word-space boundary requirement.
const entries = Object.values(translations as Record<string, Record<string, string>>).flatMap(row => Object.entries(row))
  .filter(([source, local]) => source.toLowerCase() !== local.toLowerCase());
const fold = (text: string) => text.normalize('NFKC').toLowerCase();
const byPhrase = new Map<string, string>();
for (const [source, local] of entries) if (!byPhrase.has(fold(local))) byPhrase.set(fold(local), source);
const phrases = [...new Set(entries.map(([, local]) => local))].sort((a,b) => b.length-a.length);
const alternatives = phrases.map(local => `${/[\u3000-\u9fff\uac00-\ud7af]/.test(local) ? '' : '(?<![\\p{L}\\p{M}\\p{N}])'}${escape(local)}${/[\u3000-\u9fff\uac00-\ud7af]/.test(local) ? '' : '(?![\\p{L}\\p{M}\\p{N}])'}`);
const replacements = alternatives.length ? new RegExp(alternatives.join('|'), 'giu') : undefined;
// Common real packaging headings are not always a literal translation of
// “ingredients” (for example Russian “composition” and Japanese “raw materials”).
const HEADER_ALIASES = /(^|\n)\s*(?:原材料名?|配料表?|成分表?|원재료명|المكونات|مكونات|רכיבים|רכיביו|Состав|Склад|İçindekiler|Συστατικά|Sastojci|Sestavine|Složení|Zloženie|Składniki|Összetevők|Ainesosat|Ingredienser|Ingrédients|Ingredientes|Ingredienti|Zutaten|Ingrediënten|Thành phần|ส่วนประกอบ|Bahan-bahan|Bahan|सामग्री|উপাদান|اجزاء)\s*[:：、]\s*/gimu;
export function canonicalLabelContext(text: string): string {
  let result = text.replace(HEADER_ALIASES, '$1Ingredients: ')
    .replace(/无麸质|無麩質|無麸質|无谷蛋白|不含麩質|グルテンフリー|グルテン不使用|グルテンを含まない|글루텐\s*프리|글루텐\s*무첨가|무글루텐/giu, 'Gluten free ')
    .replace(/无乳糖|無乳糖|不含乳糖|乳糖不使用|ラクトースフリー|유당\s*무첨가|락토프리/giu, 'Lactose free ')
    .replace(/\bglutenfrei(?:e[nmrs]?)?\b/giu, 'Gluten free')
    .replace(/\blaktosefrei(?:e[nmrs]?)?\b/giu, 'Lactose free')
    .replace(/\bglutenvrij(?:e)?\b|\bglutenfri(?:tt|a|e)?\b/giu, 'Gluten free')
    .replace(/\blactosevrij(?:e)?\b|\blaktosefri(?:tt|a|e)?\b/giu, 'Lactose free');
  if (replacements) result = result.replace(replacements, phrase => byPhrase.get(fold(phrase)) ?? phrase);
  // Ingredients headings can have language-specific punctuation or no colon.
  return result.replace(/\bWithout (gluten|lactose)\b/gi, '$1 free').replace(/(^|\n)\s*Ingredients\s*(?:[:：、]|\n)/gi, '$1Ingredients:\n');
}
