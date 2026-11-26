import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Field, Heading, T } from './ui';
import {LOCALES, getLocale, t, type LocalePreferences, tx } from '../i18n';
import { MARKETS, marketName } from '../i18n/regions';

export function LocaleSettings({ value, onSave }: { value?: LocalePreferences; onSave: (next: LocalePreferences) => Promise<void> }) {
  const [languageSearch, setLanguageSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preferences = value ?? { language: 'system', region: 'system' };
  const save = async (next: LocalePreferences) => {
    setBusy(true); setError('');
    try { await onSave(next); } catch { setError(t('Your language and country choices could not be saved. Please try again.')); } finally { setBusy(false); }
  };
  return <Card><Heading size={22}>{t('Language & country')}</Heading>
    <T muted style={{ marginVertical: 12 }}>{t('Choose your interface language and the country where you buy food. These can be different. Your saved diary stays unchanged.')}</T>
    <T muted style={{ fontSize: 11, marginBottom: 12 }}>{t('The Home Screen widget and iOS permission prompts follow the language selected in iOS Settings.')}</T>
    <Button label={tx(expanded ? t('Close language & country settings') : t('Choose language & country'))} variant="secondary" onPress={() => setExpanded(!expanded)} />
    {expanded && <View style={{ gap: 14, marginTop: 16 }}>
      <T>{t('Language')}</T><Chip label={t('Follow device settings')} selected={preferences.language === 'system'} onPress={() => !busy && void save({ ...preferences, language: 'system' })} />
      <Field label={t('Find a language')} value={languageSearch} onChangeText={setLanguageSearch} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{LOCALES.filter(([code, name]) => `${code} ${name}`.toLocaleLowerCase().includes(languageSearch.toLocaleLowerCase())).map(([code, name]) => <Chip key={code} label={tx(name)} selected={preferences.language === code} onPress={() => !busy && void save({ ...preferences, language: code })} />)}</View>
      <T>{t('Shopping country')}</T><Chip label={t('Follow device settings')} selected={preferences.region === 'system'} onPress={() => !busy && void save({ ...preferences, region: 'system' })} />
      <Field label={t('Find a country')} value={countrySearch} onChangeText={setCountrySearch} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{MARKETS.filter(item => `${item.code} ${item.country} ${marketName(item.code, getLocale())}`.toLocaleLowerCase().includes(countrySearch.toLocaleLowerCase())).slice(0, countrySearch ? 250 : 8).map(item => <Chip key={item.code} label={marketName(item.code, getLocale())} selected={preferences.region === item.code} onPress={() => !busy && void save({ ...preferences, region: item.code })} />)}</View>
      {!!error && <T>{error}</T>}
    </View>}
  </Card>;
}
