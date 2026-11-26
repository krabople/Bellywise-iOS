/** Curated display terminology; never alters ingredient IDs or diary records. */
export function normalizeTranslation(locale: string, source: string, translated: string): string {
  if (source === translated) return translated;
  if (locale.startsWith('fr')) {
    if (/\bpatterns?\b/i.test(source)) translated = translated.replace(/modèles|patrons/gi, word => word[0] === word[0].toUpperCase() ? 'Liens' : 'liens').replace(/modèle|patron/gi, word => word[0] === word[0].toUpperCase() ? 'Lien' : 'lien');
    if (/\bfeelings?\b/i.test(source)) translated = translated.replace(/émotions positives/gi,'ressentis positifs').replace(/sentiments|émotions/gi,'ressentis');
    if (/daily review|day.review/i.test(source)) translated = translated.replace(/critiques quotidiennes|révisions quotidiennes|évaluations quotidiennes/gi,'bilans quotidiens');
  }
  if (locale === 'ar' && /\bjournal\b/i.test(source)) translated = translated.replace(/مجلتي/g,'يومياتي').replace(/مجلتك/g,'يومياتك').replace(/مجلة/g,'يوميات');
  return translated;
}
