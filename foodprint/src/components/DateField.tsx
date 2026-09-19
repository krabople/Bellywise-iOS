import React from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { View } from 'react-native';
import { T } from './ui';
export function DateField({ value, onChange, label = 'When' }: { value: Date; onChange: (date: Date) => void; label?: string }) {
  return <View style={{ gap: 8, alignItems: 'flex-start' }}><T style={{ fontSize: 12 }}>{label}</T><DateTimePicker value={value} onChange={(_, date) => date && onChange(date)} mode="datetime" maximumDate={new Date()} themeVariant="light" /></View>;
}
