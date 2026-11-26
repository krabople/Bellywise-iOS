import React, { useState } from 'react';
import { View } from 'react-native';
import { Chip, Field, T } from './ui';
import {getLocale, t, tx } from '../i18n';
import { MARKETS, marketName } from '../i18n/regions';

export function MarketPicker({ value, onChange }: { value: string; onChange: (country: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const current = MARKETS.find(item => item.country === value);
  return <View style={{ gap: 8 }}><T muted>{t('Product market')}</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
    <Chip label={tx(current ? marketName(current.code, getLocale()) : t('All countries'))} selected onPress={() => setExpanded(!expanded)} />
    {!!value && <Chip label={t('All countries')} onPress={() => onChange('')} />}
    <Chip label={t('Change country')} onPress={() => setExpanded(!expanded)} />
  </View>{expanded && <><Field label={t('Find a country')} value={query} onChangeText={setQuery} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{MARKETS.filter(item => `${item.code} ${item.country} ${marketName(item.code, getLocale())}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, query ? 250 : 10).map(item => <Chip key={item.code} label={marketName(item.code, getLocale())} selected={item.country === value} onPress={() => { onChange(item.country); setExpanded(false); }} />)}</View></>}
  </View>;
}
