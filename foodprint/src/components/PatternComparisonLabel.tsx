import React, { useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { CircleHelp } from 'lucide-react-native';
import type { PatternResult } from '../domain/types';
import { C, Row, Sheet, T } from './ui';

export function PatternComparisonLabel({ label, pattern, exposed }: { label: string; pattern: PatternResult; exposed: boolean }) {
  const [open, setOpen] = useState(false);
  const total = exposed ? pattern.exposedDays : pattern.unexposedDays;
  const hits = exposed ? pattern.exposedSymptomDays : pattern.unexposedSymptomDays;
  const foodDays = exposed ? 'you logged ' + pattern.ingredientName : 'you did not log ' + pattern.ingredientName;
  const timing = pattern.window === 'next-day' ? ' on the following day' : exposed ? ' later that day, after eating it' : ' that same day';
  const explanation = `The number after the slash (${total}) is the number of days when ${foodDays} that Bellywise has enough information to compare.\n\nThe number before the slash (${hits}) tells you how many of those days you logged ${pattern.symptomName.toLowerCase()}${timing}.\n\nSo ${hits}/${total} means: out of ${total} days when ${foodDays}, you logged ${pattern.symptomName.toLowerCase()}${timing} on ${hits} of them.\n\nEach pattern has its own total. A different ingredient, feeling or same-day/following-day timing can make different days usable. Missing or uncertain information is left out, so these totals are not the total number of days in your diary.\n\nOpen this pattern and look under “Which days count in this pattern?” to see the dates used or left out, and why.`;
  return <Row style={{ gap: 2, flex: 1 }}><T style={{ fontSize: 11, flexShrink: 1 }}>{label}</T><Pressable accessibilityRole="button" accessibilityLabel={`Explain the numbers for ${label.toLowerCase()}`} hitSlop={4} onPress={event => { event.stopPropagation(); if (Platform.OS === 'web') setOpen(true); else Alert.alert(label, explanation); }} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><CircleHelp size={15} color={C.muted} /></Pressable>{open && <Sheet title="What do these numbers mean?" subtitle={label} onClose={() => setOpen(false)}><T>{explanation}</T></Sheet>}</Row>;
}
