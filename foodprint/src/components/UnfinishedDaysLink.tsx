import React from 'react';
import { Pressable } from 'react-native';
import { C, T } from './ui';

export function UnfinishedDaysLink({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ paddingVertical: 10 }}><T style={{ color: C.green, fontSize: 12, textDecorationLine: 'underline' }}>What is an unfinished day? View and finish days</T></Pressable>;
}
