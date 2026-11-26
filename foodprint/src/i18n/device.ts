import { getLocales } from 'expo-localization';
export function deviceLocale() {
  const locales = getLocales();
  return { languages: locales.map(item => item.languageTag), region: locales[0]?.regionCode };
}
