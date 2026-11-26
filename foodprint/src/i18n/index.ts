import catalogs from './messages.json';
import overrides from '../../localization/terminology-overrides.json';
import { normalizeTranslation } from './terminology';
import { resolveLocale, isAppLocale, type AppLocale } from './locales';
export { LOCALES, resolveLocale, isRTL, offLanguage, type AppLocale } from './locales';
export interface LocalePreferences { language: AppLocale | 'system'; region: string | 'system' }
let locale: AppLocale = 'en-GB';
let region = '';
let revision = 0;
const listeners = new Set<() => void>();
export const getLocale = () => locale;
export const getRegion = () => region;
export const getLocaleRevision = () => revision;
export function subscribeLocale(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; }
export function configureLocale(preferences: Partial<LocalePreferences> = {}, device: { languages: string[]; region?: string | null } = { languages: ['en-GB'] }) {
  const next = isAppLocale(preferences.language) ? preferences.language : resolveLocale(device.languages);
  const nextRegion = preferences.region && preferences.region !== 'system' ? preferences.region : device.region ?? '';
  if (next === locale && nextRegion === region) return;
  locale = next; region = nextRegion; revision++;
  listeners.forEach(listener => listener());
}
/** Static, bundled messages only. Never sends diary text to a translation service. */
export function t(source: string, values: readonly (string | number | undefined)[] = []): string {
  let translated = (overrides as Record<string, Record<string, string>>)[locale]?.[source] ?? (catalogs as Record<string, Record<string, string>>)[locale]?.[source] ?? source;
  translated = normalizeTranslation(locale, source, translated);
  if (translated !== source) translated = (source.match(/^\s*/)?.[0] ?? '') + translated.trim() + (source.match(/\s*$/)?.[0] ?? '');
  return translated.replace(/\{(\d+)\}/g, (token, index) => {
    if (Number(index) >= values.length) return token;
    const value = values[Number(index)];
    return typeof value === 'number' ? formatNumber(value) : ((catalogs as Record<string, Record<string, string>>)[locale]?.[String(value ?? '')] ?? String(value ?? ''));
  });
}
export function tx(value: string): string;
export function tx(value: string | undefined): string | undefined;
export function tx(value: string | undefined): string | undefined { return value === undefined ? undefined : t(value); }
export function formatNumber(value: number, options?: Intl.NumberFormatOptions) { return new Intl.NumberFormat(locale, options).format(value); }
export function parseLocalizedNumber(value: string): number {
  const digits = new Map(Array.from({ length: 10 }, (_, i) => [formatNumber(i, { useGrouping: false }), String(i)]));
  for (const base of [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0e50]) {
    for (let i = 0; i < 10; i++) digits.set(String.fromCodePoint(base + i), String(i));
  }
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.';
  const normalized = Array.from(value.trim()).map(character => digits.get(character) ?? character).join('').replace(decimal, '.').replace(/\u066b/g, '.');
  return /^[+-]?\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}
