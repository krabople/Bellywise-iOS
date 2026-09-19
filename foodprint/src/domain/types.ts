export type Confidence = 'confirmed' | 'inferred';
export type SymptomKind = 'negative' | 'positive';
export type Level = 1 | 2 | 3 | 4 | 5;

export interface IngredientExposure {
  id: string;
  name: string;
  confidence: Confidence;
}

export interface Meal {
  id: string;
  name: string;
  eatenAt: string;
  ingredients: IngredientExposure[];
  source: 'typed' | 'label';
  /** Missing on older diaries means food. */
  kind?: 'food' | 'drink';
  /** Original reviewed label text retained for audit and later ingredient correction. */
  labelText?: string;
  notes?: string;
}

export interface SymptomDefinition {
  id: string;
  name: string;
  kind: SymptomKind;
  icon?: string;
}

export interface SymptomLog {
  id: string;
  symptomId: string;
  occurredAt: string;
  /** For positive entries, severity means strength of the positive feeling. */
  severity: Level;
  notes?: string;
}

export interface DayCheckIn {
  /** Calendar date in the device's local time, YYYY-MM-DD. */
  date: string;
  /** User explicitly confirms that all meals AND symptoms have been logged. */
  complete: boolean;
  /** Snapshot of feelings actively checked for, including any feeling logged that day. */
  trackedSymptomIds?: string[];
  stress: Level;
  sleepHours?: number;
  notes?: string;
}

export interface AppData {
  meals: Meal[];
  symptoms: SymptomLog[];
  checkIns: DayCheckIn[];
  customSymptoms: SymptomDefinition[];
}

export interface FoodQuestion {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
}

export interface FoodResolution {
  name: string;
  ingredients: IngredientExposure[];
  questions: FoodQuestion[];
  matched: boolean;
  description: string;
}

export type ExposureWindow = 'same-day' | 'next-day';
export interface PatternResult {
  id: string;
  ingredientId: string;
  ingredientName: string;
  symptomId: string;
  symptomName: string;
  symptomKind: SymptomKind;
  window: ExposureWindow;
  windowLabel: string;
  exposedDays: number;
  unexposedDays: number;
  exposedSymptomDays: number;
  unexposedSymptomDays: number;
  exposedRate: number;
  unexposedRate: number;
  riskDifference: number;
  interval: [number, number];
  pValue: number;
  adjustedPValue: number;
  status: 'not-enough-data' | 'exploratory' | 'emerging';
  headline: string;
  summary: string;
  cautions: string[];
  coOccursWith: string[];
  inferredFraction: number;
  confirmedExposedDays: number;
  lowStressRiskDifference?: number;
}

export interface AnalysisResult {
  patterns: PatternResult[];
  completeDays: number;
  minimumDays: number;
  message: string;
}
