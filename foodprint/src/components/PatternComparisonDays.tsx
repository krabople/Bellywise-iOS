import React, { useState } from 'react';
import { View } from 'react-native';
import type { PatternResult } from '../domain/types';
import { comparisonExclusionExplanation } from '../domain/comparisonDays';
import { Button, C, Card, F, T } from './ui';

const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function PatternComparisonDays({ pattern: p }: { pattern: PatternResult }) {
  const [open, setOpen] = useState(false);
  const [showIncluded, setShowIncluded] = useState(false);
  const [limit, setLimit] = useState(20);
  const days = p.comparisonDays ?? [];
  const excluded = days.filter(day => !day.included);
  const used = p.exposedDays + p.unexposedDays;
  const visibleDays = (showIncluded ? days : excluded).slice().reverse();
  return <Card style={{ gap: 12 }}>
    <T style={{ fontFamily: F.semi }}>Which days count in this pattern?</T>
    <T>{days.length ? `${used} of ${days.length} past diary days used: ${p.exposedDays} with ${p.ingredientName}, ${p.unexposedDays} without it. ${excluded.length} ${excluded.length === 1 ? 'day was' : 'days were'} left out.` : `${used} usable days: ${p.exposedDays} with ${p.ingredientName}, ${p.unexposedDays} without it.`}</T>
    <T muted style={{ fontSize: 12 }}>These totals are specific to this ingredient, this feeling and the timing shown above. Another pattern can use a different number of days from the same diary. A day with missing or uncertain information is left out, rather than counted as a day without the ingredient or feeling.</T>
    <T muted style={{ fontSize: 12 }}>{p.window === 'next-day' ? 'This pattern checks the following day. A food day cannot be used until there is enough information about that next day too.' : 'This pattern checks feelings at or after the first time this ingredient was eaten that day.'} Today is still in progress and is not counted in these past diary days.</T>
    {!!days.length && <Button variant="secondary" label={open ? 'Hide dates and reasons' : 'See dates and reasons'} onPress={() => setOpen(value => !value)} />}
    {open && <View style={{ gap: 14 }}>
      <T style={{ fontFamily: F.semi }}>{showIncluded ? 'All comparison dates' : 'Dates left out'}</T>
      {!showIncluded && !excluded.length && <T muted>Every past diary day considered was usable for this comparison.</T>}
      {visibleDays.slice(0, limit).map(day => <View key={day.date} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, gap: 5 }}>
        <T style={{ fontFamily: F.medium }}>{dateLabel(day.date)} · {day.included ? 'Used' : 'Left out'}</T>
        {p.window === 'next-day' && <T muted style={{ fontSize: 11 }}>Food: {dateLabel(day.date)} · Feeling: {dateLabel(day.symptomDate)}</T>}
        {day.included ? <T style={{ fontSize: 12 }}>{day.exposed ? `${p.ingredientName} logged` : `${p.ingredientName} not logged on a finished day`}. {day.symptom ? `${p.symptomName} logged${p.window === 'next-day' ? ' the following day' : day.exposed ? ' at or after the food' : ' that day'}.` : `${p.symptomName} not logged for this comparison; its tracking was confirmed in the daily review.`}</T> : day.reasons.map(reason => <T key={reason} style={{ fontSize: 12 }}>{comparisonExclusionExplanation(reason, p)}</T>)}
      </View>)}
      {visibleDays.length > limit && <Button variant="ghost" label="Show more dates" onPress={() => setLimit(value => value + 20)} />}
      <Button variant="ghost" label={showIncluded ? 'Show only dates left out' : 'Show used dates too'} onPress={() => { setShowIncluded(value => !value); setLimit(20); }} />
    </View>}
  </Card>;
}
