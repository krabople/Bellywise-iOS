/** App Store Connect's complete metadata-language list, checked 26 November 2026. */
export const LOCALES = [
  ['ar', 'العربية'], ['bn', 'বাংলা'], ['ca', 'Català'], ['zh-Hans', '简体中文'], ['zh-Hant', '繁體中文'],
  ['hr', 'Hrvatski'], ['cs', 'Čeština'], ['da', 'Dansk'], ['nl', 'Nederlands'],
  ['en-AU', 'English (Australia)'], ['en-CA', 'English (Canada)'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'],
  ['fi', 'Suomi'], ['fr', 'Français'], ['fr-CA', 'Français (Canada)'], ['de', 'Deutsch'], ['el', 'Ελληνικά'],
  ['gu', 'ગુજરાતી'], ['he', 'עברית'], ['hi', 'हिन्दी'], ['hu', 'Magyar'], ['id', 'Bahasa Indonesia'],
  ['it', 'Italiano'], ['ja', '日本語'], ['kn', 'ಕನ್ನಡ'], ['ko', '한국어'], ['ms', 'Bahasa Melayu'],
  ['ml', 'മലയാളം'], ['mr', 'मराठी'], ['nb', 'Norsk bokmål'], ['or', 'ଓଡ଼ିଆ'], ['pl', 'Polski'],
  ['pt-BR', 'Português (Brasil)'], ['pt-PT', 'Português (Portugal)'], ['pa', 'ਪੰਜਾਬੀ'], ['ro', 'Română'],
  ['ru', 'Русский'], ['sk', 'Slovenčina'], ['sl', 'Slovenščina'], ['es-MX', 'Español (México)'], ['es-ES', 'Español (España)'],
  ['sv', 'Svenska'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['th', 'ไทย'], ['tr', 'Türkçe'], ['uk', 'Українська'],
  ['ur', 'اردو'], ['vi', 'Tiếng Việt'],
] as const;
export type AppLocale = typeof LOCALES[number][0];
export const isAppLocale = (value: unknown): value is AppLocale => LOCALES.some(([code]) => code === value);
export function resolveLocale(preferences: readonly string[]): AppLocale {
  for (const preference of preferences) {
    const tag = preference.replace(/_/g, '-');
    const exact = LOCALES.find(([code]) => code.toLowerCase() === tag.toLowerCase());
    if (exact) return exact[0];
    const base = tag.split('-')[0].toLowerCase();
    if (base === 'zh') return /(?:Hant|TW|HK|MO)/i.test(tag) ? 'zh-Hant' : 'zh-Hans';
    if (base === 'pt') return /-(?:PT|AO|MZ)$/i.test(tag) ? 'pt-PT' : 'pt-BR';
    if (base === 'es') return /(?:^es$|-ES$)/i.test(tag) ? 'es-ES' : 'es-MX';
    if (base === 'no' || base === 'nn') return 'nb';
    if (base === 'en') return 'en-GB';
    const generic = LOCALES.find(([code]) => code.split('-')[0] === base);
    if (generic) return generic[0];
  }
  return 'en-GB';
}
export const isRTL = (locale: string) => /^(ar|he|ur)(-|$)/.test(locale);
export const offLanguage = (locale: string) => locale.startsWith('zh') ? 'zh' : locale.split('-')[0] === 'nb' ? 'no' : locale.split('-')[0];
