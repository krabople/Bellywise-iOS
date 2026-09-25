import type { AppData } from '../domain/types';
import { BUILT_IN_SYMPTOMS } from '../domain/symptoms';
import { localDateKey } from '../domain/dates';

export interface SavedDiary {
  version: 1;
  data: AppData;
  selectedSymptoms: string[];
  welcomed: boolean;
}

export const emptyData = (): AppData => ({ meals: [], symptoms: [], checkIns: [], customSymptoms: [], customIngredients: [] });
export const emptyDiary = (): SavedDiary => ({ version: 1, data: emptyData(), selectedSymptoms: ['bloating', 'abdominal-pain', 'nausea', 'fatigue', 'energy', 'comfortable'], welcomed: false });

const record = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (v: unknown, max = 10000): v is string => typeof v === 'string' && v.length <= max;
const list = (v: unknown): v is unknown[] => Array.isArray(v) && v.length <= 100000;
const calendarDate = (v: unknown): v is string => text(v, 10) && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const date = (v: unknown): boolean => text(v, 40) && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && calendarDate(v.slice(0, 10)) && Number.isFinite(Date.parse(v)) && Date.parse(v) <= Date.now();
const identifier = (v: unknown): v is string => text(v, 120) && v.trim().length > 0;
const name = (v: unknown, max: number): v is string => text(v, max) && v.trim().length > 0;
const level = (v: unknown): boolean => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 5;
const optionalText = (v: unknown): boolean => v === undefined || text(v);

/** Imports and disk reads are validated before they can replace the current diary. */
export function parseDiary(raw: string): SavedDiary {
  if (raw.length > 20_000_000) throw new Error('This backup is too large (maximum 20 MB).');
  const value: unknown = JSON.parse(raw);
  if (!record(value) || value.version !== 1 || !record(value.data) || !list(value.selectedSymptoms) ||
    !value.selectedSymptoms.every(identifier) || typeof value.welcomed !== 'boolean') throw new Error('This is not a supported diary backup.');
  const d = value.data;
  if (!list(d.meals) || !list(d.symptoms) || !list(d.checkIns) || !list(d.customSymptoms)) throw new Error('The backup is incomplete.');
  const validIngredients = (v: unknown) => list(v) && v.length <= 500 && v.every(i => record(i) && identifier(i.id) && name(i.name, 300) && ['confirmed', 'inferred'].includes(i.confidence));
  if (!d.meals.every(m => record(m) && identifier(m.id) && name(m.name, 300) && date(m.eatenAt) && validIngredients(m.ingredients) && ['typed', 'label'].includes(m.source) && (m.kind === undefined || ['food', 'drink'].includes(m.kind)) && (m.labelText === undefined || text(m.labelText, 40000)) && optionalText(m.notes))) throw new Error('The backup contains an invalid food entry.');
  if (!d.symptoms.every(s => record(s) && identifier(s.id) && identifier(s.symptomId) && date(s.occurredAt) && level(s.severity) && optionalText(s.notes))) throw new Error('The backup contains an invalid symptom entry.');
  if (!d.checkIns.every(c => record(c) && calendarDate(c.date) && c.date <= localDateKey(new Date()) && typeof c.complete === 'boolean' && (c.trackedSymptomIds === undefined || (list(c.trackedSymptomIds) && c.trackedSymptomIds.every(identifier) && new Set(c.trackedSymptomIds).size === c.trackedSymptomIds.length)) && level(c.stress) && (c.sleepHours === undefined || (Number.isFinite(c.sleepHours) && c.sleepHours >= 0 && c.sleepHours <= 24)) && optionalText(c.notes))) throw new Error('The backup contains an invalid check-in.');
  if (!d.customSymptoms.every(s => record(s) && identifier(s.id) && name(s.name, 80) && ['negative', 'positive'].includes(s.kind) && (s.icon === undefined || text(s.icon, 120)))) throw new Error('The backup contains an invalid custom symptom.');
  if (d.customIngredients !== undefined && (!list(d.customIngredients) || !d.customIngredients.every(i => record(i) && identifier(i.id) && name(i.name, 160) && list(i.aliases) && i.aliases.every((alias: unknown) => name(alias, 160))))) throw new Error('The backup contains an invalid custom ingredient.');
  for (const rows of [d.meals, d.symptoms, d.customSymptoms]) {
    if (new Set(rows.map((r: any) => r.id)).size !== rows.length) throw new Error('This backup contains duplicate entry IDs.');
  }
  if (d.customIngredients !== undefined && new Set(d.customIngredients.map((ingredient: any) => ingredient.id)).size !== d.customIngredients.length) throw new Error('This backup contains duplicate custom ingredient IDs.');
  if (new Set(d.checkIns.map((row: any) => row.date)).size !== d.checkIns.length) throw new Error('This backup contains more than one check-in for the same date.');
  const symptomIds = new Set(BUILT_IN_SYMPTOMS.map(symptom => symptom.id));
  for (const symptom of d.customSymptoms as AppData['customSymptoms']) {
    if (symptomIds.has(symptom.id)) throw new Error('A custom symptom uses the ID of an existing symptom.');
    symptomIds.add(symptom.id);
  }
  if (!value.selectedSymptoms.every((id: string) => symptomIds.has(id)) || !d.symptoms.every((symptom: any) => symptomIds.has(symptom.symptomId))) throw new Error('The backup refers to an unknown symptom.');
  if (!d.checkIns.every((checkIn: any) => checkIn.trackedSymptomIds === undefined || checkIn.trackedSymptomIds.every((id: string) => symptomIds.has(id)))) throw new Error('A daily check-in refers to an unknown tracked symptom.');
  if (new Set(value.selectedSymptoms).size !== value.selectedSymptoms.length) throw new Error('The backup selects the same symptom more than once.');
  return value as unknown as SavedDiary;
}
