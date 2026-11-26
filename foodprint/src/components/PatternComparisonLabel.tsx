import {t, tx } from '../i18n';
import React, { useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { CircleHelp } from 'lucide-react-native';
import type { PatternResult } from '../domain/types';
import { C, Row, Sheet, T } from './ui';

export function PatternComparisonLabel({ label, pattern, exposed }: { label: string; pattern: PatternResult; exposed: boolean }) {
  const [open, setOpen] = useState(false);
  const total = exposed ? pattern.exposedDays : pattern.unexposedDays;
  const hits = exposed ? pattern.exposedSymptomDays : pattern.unexposedSymptomDays;
  const denominator = exposed
    ? t('The number after the slash ({0}) is the number of days when you logged {1} and there was enough information for this comparison.', [total, pattern.ingredientName])
    : t('The number after the slash ({0}) is the number of days when you did not log {1} and there was enough information for this comparison.', [total, pattern.ingredientName]);
  const numerator = pattern.window === 'next-day'
    ? t('The number before the slash ({0}) shows how many of those days were followed by a day when you logged {1}.', [hits, pattern.symptomName])
    : exposed
      ? t('The number before the slash ({0}) shows how many of those days you logged {1} after eating {2}.', [hits, pattern.symptomName, pattern.ingredientName])
      : t('The number before the slash ({0}) shows how many of those days you logged {1}.', [hits, pattern.symptomName]);
  const explanation = [denominator, numerator,
    t('So {0}/{1} means the symptom was logged in {0} of the {1} comparison days.', [hits, total]),
    t('Each pattern can use a different set of days. The ingredient, symptom and same-day or following-day timing affect which days have enough information. These totals are not the total number of days in your diary.'),
    t('Open the pattern and look under “Which days count in this pattern?” to see the dates included or left out, and why.'),
    t('These numbers show whether the symptom occurred. Symptom severity is compared separately.'),
  ].join('\n\n');
  return <Row style={{ gap: 2, flex: 1 }}><T style={{ fontSize: 11, flexShrink: 1 }}>{label}</T><Pressable accessibilityRole="button" accessibilityLabel={t("Explain the numbers for {0}", [label.toLowerCase()])} hitSlop={4} onPress={event => { event.stopPropagation(); if (Platform.OS === 'web') setOpen(true); else Alert.alert(label, explanation); }} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><CircleHelp size={15} color={C.muted} /></Pressable>{open && <Sheet title={t("What do these numbers mean?")} subtitle={tx(label)} onClose={() => setOpen(false)}><T>{explanation}</T></Sheet>}</Row>;
}
