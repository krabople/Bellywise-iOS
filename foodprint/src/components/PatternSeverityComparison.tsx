import {t, formatNumber } from '../i18n';
import React from 'react';
import { View } from 'react-native';
import type { PatternResult } from '../domain/types';
import { C, F, T, Row, Card } from './ui';

export function PatternSeverityComparison({ pattern: p, compact = false }: { pattern: PatternResult; compact?: boolean }) {
  const s = p.severity;
  if (!s) return null;
  const positive = p.symptomKind === 'positive';
  const describeDifference = (value: number) => Math.abs(value) < .05 ? 'there was no average rating difference with and without this ingredient' : t("the average rating was {0} points {1} with this ingredient", [formatNumber(Math.abs(value), { minimumFractionDigits: 1, maximumFractionDigits: 1 }), value < 0 ? 'lower' : 'higher']);
  const content = <View style={{ gap: compact ? 10 : 16 }}>
    <T style={{ fontFamily: F.semi, fontSize: compact ? 12 : 14 }}>{t("{0} · average out of 5", [positive ? 'Strength of this feeling' : 'Symptom intensity'])}</T>
    {[{ label: t("With {0}", [p.ingredientName]), average: s.exposedAverage, days: s.exposedDays, color: C.green },
      { label: 'Without it', average: s.unexposedAverage, days: s.unexposedDays, color: '#AEBEA2' }].map(row => <View key={row.label} style={{ gap: 7 }}>
      <Row style={{ justifyContent: 'space-between', gap: 8 }}>
        <T style={{ fontSize: compact ? 11 : 13, flex: 1 }}>{row.label}</T>
        <T style={{ fontFamily: F.semi, fontSize: compact ? 12 : 14 }}>{row.average === undefined ? 'No ratings' : t("{0}/5", [formatNumber(row.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })])}</T>
      </Row>
      {row.average !== undefined && <View accessible accessibilityRole="progressbar" accessibilityLabel={t("{0}: average strongest daily rating", [row.label])} accessibilityValue={{ min: 1, max: 5, now: row.average, text: t("{0} out of 5 across {1} rated days", [formatNumber(row.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), row.days]) }} style={{ height: compact ? 7 : 14, backgroundColor: C.paper, borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${row.average / 5 * 100}%`, backgroundColor: row.color, borderRadius: 8 }} />
      </View>}
      {!compact && <T muted style={{ fontSize: 11 }}>{t("{0} rated {1} day{2}", [row.days, positive ? 'feeling' : 'symptom', row.days === 1 ? '' : 's'])}</T>}
    </View>)}
    <T muted style={{ fontSize: compact ? 10 : 12 }}>{compact ? 'Highest logged rating per day, on days this feeling occurred.' : t("For each day when {0} was logged, Bellywise takes the highest {1}rating and averages those daily scores. Repeated entries do not count as extra days. Days without this feeling are excluded from this intensity comparison.", [t(p.symptomName).toLowerCase(), p.window === 'next-day' ? 'following-day ' : ''])}</T>
    {!compact && <>
      {p.window === 'same-day' && <T muted style={{ fontSize: 12 }}>{t("On days with this ingredient, only ratings logged at or after its first recorded consumption time are included.")}</T>}
      <T style={{ fontSize: 12 }}>{s.status === 'emerging' ? 'The intensity finding passed the stricter checks for enough rated days, repeated exposure and differences that might appear by chance. It remains a clue, not proof of a cause.' : s.status === 'not-enough-data' ? 'More rated days are needed before this can receive a stronger evidence label. Rate this feeling whenever it occurs, including on days without the ingredient.' : 'These ratings have not met the stricter checks for a stronger intensity pattern.'}</T>
      <T muted style={{ fontSize: 12 }}>{t("Stress, sleep and uncertain ingredients are also checked before an intensity finding can receive a stronger label.")}</T>
      {s.lowStressDifference !== undefined && <T muted style={{ fontSize: 12 }}>{t("On lower-stress days, {0}.", [describeDifference(s.lowStressDifference)])}</T>}
      {s.restedDifference !== undefined && <T muted style={{ fontSize: 12 }}>{t("After nights with at least seven recorded hours of sleep, {0}.", [describeDifference(s.restedDifference)])}</T>}
    </>}
  </View>;
  return compact ? content : <Card style={{ backgroundColor: C.bg }}>{content}</Card>;
}
