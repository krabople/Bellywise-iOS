import React from 'react';
import { View } from 'react-native';
import type { PatternResult } from '../domain/types';
import { C, F, T, Row, Card } from './ui';

export function PatternSeverityComparison({ pattern: p, compact = false }: { pattern: PatternResult; compact?: boolean }) {
  const s = p.severity;
  if (!s) return null;
  const positive = p.symptomKind === 'positive';
  const describeDifference = (value: number) => Math.abs(value) < .05 ? 'there was no average rating difference with and without this ingredient' : `the average rating was ${Math.abs(value).toFixed(1)} points ${value < 0 ? 'lower' : 'higher'} with this ingredient`;
  const content = <View style={{ gap: compact ? 10 : 16 }}>
    <T style={{ fontFamily: F.semi, fontSize: compact ? 12 : 14 }}>{positive ? 'Strength of this feeling' : 'Symptom intensity'} · average out of 5</T>
    {[{ label: `With ${p.ingredientName}`, average: s.exposedAverage, days: s.exposedDays, color: C.green },
      { label: 'Without it', average: s.unexposedAverage, days: s.unexposedDays, color: '#AEBEA2' }].map(row => <View key={row.label} style={{ gap: 7 }}>
      <Row style={{ justifyContent: 'space-between', gap: 8 }}>
        <T style={{ fontSize: compact ? 11 : 13, flex: 1 }}>{row.label}</T>
        <T style={{ fontFamily: F.semi, fontSize: compact ? 12 : 14 }}>{row.average === undefined ? 'No ratings' : `${row.average.toFixed(1)}/5`}</T>
      </Row>
      {row.average !== undefined && <View accessible accessibilityRole="progressbar" accessibilityLabel={`${row.label}: average strongest daily rating`} accessibilityValue={{ min: 1, max: 5, now: row.average, text: `${row.average.toFixed(1)} out of 5 across ${row.days} rated days` }} style={{ height: compact ? 7 : 14, backgroundColor: C.paper, borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${row.average / 5 * 100}%`, backgroundColor: row.color, borderRadius: 8 }} />
      </View>}
      {!compact && <T muted style={{ fontSize: 11 }}>{row.days} rated {positive ? 'feeling' : 'symptom'} day{row.days === 1 ? '' : 's'}</T>}
    </View>)}
    <T muted style={{ fontSize: compact ? 10 : 12 }}>{compact ? 'Highest logged rating per day, on days this feeling occurred.' : `For each day when ${p.symptomName.toLowerCase()} was logged, Bellywise takes the highest ${p.window === 'next-day' ? 'following-day ' : ''}rating and averages those daily scores. Repeated entries do not count as extra days. Days without this feeling are excluded from this intensity comparison.`}</T>
    {!compact && <>
      {p.window === 'same-day' && <T muted style={{ fontSize: 12 }}>On days with this ingredient, only ratings logged at or after its first recorded consumption time are included.</T>}
      <T style={{ fontSize: 12 }}>{s.status === 'emerging' ? 'The intensity finding passed the stricter checks for enough rated days, repeated exposure and differences that might appear by chance. It remains a clue, not proof of a cause.' : s.status === 'not-enough-data' ? 'More rated days are needed before this can receive a stronger evidence label. Rate this feeling whenever it occurs, including on days without the ingredient.' : 'These ratings have not met the stricter checks for a stronger intensity pattern.'}</T>
      <T muted style={{ fontSize: 12 }}>Stress, sleep and uncertain ingredients are also checked before an intensity finding can receive a stronger label.</T>
      {s.lowStressDifference !== undefined && <T muted style={{ fontSize: 12 }}>On lower-stress days, {describeDifference(s.lowStressDifference)}.</T>}
      {s.restedDifference !== undefined && <T muted style={{ fontSize: 12 }}>After nights with at least seven recorded hours of sleep, {describeDifference(s.restedDifference)}.</T>}
    </>}
  </View>;
  return compact ? content : <Card style={{ backgroundColor: C.bg }}>{content}</Card>;
}
