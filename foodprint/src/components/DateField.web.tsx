import React, { useState } from 'react';
import { Field } from './ui';
const localValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export function DateField({ value, onChange, label = 'When' }: { value: Date; onChange: (date: Date) => void; label?: string }) {
  const [raw, setRaw] = useState(localValue(value));
  return <Field label={`${label} · YYYY-MM-DD HH:mm`} value={raw} onChangeText={text => { setRaw(text); const d = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text) ? new Date(text.replace(' ', 'T')) : new Date(NaN); onChange(d); }} />;
}
