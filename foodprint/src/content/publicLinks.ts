/** Public support and privacy pages for the App Store release. */
import { getLocale } from '../i18n';
export const BELLYWISE_PRIVACY_URL = 'https://krabople.github.io/Bellywise-iOS/privacy.html';
export const BELLYWISE_SUPPORT_URL = 'https://krabople.github.io/Bellywise-iOS/support.html';
export const BELLYWISE_DATA_SOURCES_URL = 'https://krabople.github.io/Bellywise-iOS/data-sources.html';
export function localizedPublicUrl(url: string): string {
  const locale = getLocale();
  return locale.startsWith('en') || url === BELLYWISE_DATA_SOURCES_URL ? url : url.replace(/\/([^/]+\.html)$/, `/languages/${locale}/$1`);
}
