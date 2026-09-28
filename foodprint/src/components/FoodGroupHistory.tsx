import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { foodGroupHistory } from '../domain/foodGroups';
import type { AppData } from '../domain/types';
import { Card, C, F, Notice, T } from './ui';

export function FoodGroupHistory({ data }: { data: AppData }) {
  const history = useMemo(() => foodGroupHistory(data), [data]);
  const [detail, setDetail] = useState('');
  return <Card style={{ marginTop: 24 }}><T style={{ fontFamily: F.semi }}>Your food variety over six months</T><T muted style={{ fontSize: 12 }}>Each square is a week, oldest to newest. Darker green means the group appeared on more days. A dashed border means fewer than five completed daily reviews. Tap for dates and counts.</T>
    {history.map(group => <View key={group.name} style={{ marginTop: 12, gap: 8 }}><T style={{ fontFamily: F.medium }}>{group.name}</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{group.weeks.map(week => <Pressable key={week.from} accessibilityRole="button" accessibilityLabel={`${group.name}, ${week.from}: present on ${week.presentDays} days, ${week.loggedDays} days logged, ${week.completeDays} complete`} onPress={() => setDetail(`${group.name} · ${week.from} to ${week.to}: logged on ${week.presentDays} days. ${week.loggedDays} days have food entries; ${week.completeDays} daily reviews are complete.`)} style={{ width: 15, height: 25, borderRadius: 3, borderWidth: 1, borderStyle: week.completeDays >= 5 ? 'solid' : 'dashed', borderColor: C.muted, backgroundColor: week.presentDays ? `rgba(49,91,67,${.15 + week.presentDays / 7 * .85})` : C.bg }} />)}</View></View>)}
    {!!detail && <View style={{ marginTop: 12 }}><Notice>{detail}</Notice></View>}
    <T muted style={{ fontSize: 11, marginTop: 12 }}>This shows recorded variety, not portions, nutrients or a diagnosis of deficiency. An unlogged food may still have been eaten, and a tiny ingredient is not a serving. Use longer-term gaps as a discussion point with a dietitian; Bellywise does not claim they caused a symptom.</T>
  </Card>;
}
