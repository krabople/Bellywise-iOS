import { compareOrdinalRatings } from './statistics';
import type { SeverityComparison } from './types';

export interface SeverityObservation {
  exposed: boolean;
  confirmed: boolean;
  complete: boolean;
  peakSeverity?: number;
  stress?: number;
  sleep?: number;
}

const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
const values = (rows: SeverityObservation[], exposed: boolean) => rows.filter(row => row.exposed === exposed && row.peakSeverity !== undefined).map(row => row.peakSeverity!);
const compare = (rows: SeverityObservation[]) => {
  const x = values(rows, true), y = values(rows, false);
  const exposedAverage = average(x), unexposedAverage = average(y);
  return { exposedDays: x.length, unexposedDays: y.length, exposedAverage, unexposedAverage,
    difference: exposedAverage !== undefined && unexposedAverage !== undefined ? exposedAverage - unexposedAverage : undefined,
    ...compareOrdinalRatings(x, y) };
};

/** Symptoms that weren't logged never receive a fabricated severity rating. */
export function compareSeverity(rows: SeverityObservation[]) {
  const overall = compare(rows), completeRows = rows.filter(row => row.complete);
  const complete = compare(completeRows);
  const confirmed = compare(completeRows.filter(row => !row.exposed || row.confirmed));
  const sensitivity = (subset: SeverityObservation[]) => {
    const result = compare(subset);
    return result.exposedDays >= 3 && result.unexposedDays >= 3 ? result.difference : undefined;
  };
  const lowStressDifference = sensitivity(rows.filter(row => row.stress !== undefined && row.stress <= 3));
  const restedDifference = sensitivity(rows.filter(row => row.sleep !== undefined && row.sleep >= 7));
  const confounded = [lowStressDifference, restedDifference].some(effect => effect !== undefined && (overall.difference ?? 0) - effect >= .75);
  const comparison: SeverityComparison = { ...overall, pValue: complete.pValue, adjustedPValue: 1,
    completeExposedDays: complete.exposedDays, completeUnexposedDays: complete.unexposedDays,
    status: complete.exposedDays >= 6 && complete.unexposedDays >= 6 ? 'exploratory' : 'not-enough-data', lowStressDifference, restedDifference };
  return { comparison, complete, confirmed, confounded };
}

/** Product display threshold, not a clinically validated severity cutoff. */
export function isSeverityCandidate(severity?: SeverityComparison): boolean {
  return Boolean(severity && severity.exposedDays >= 3 && severity.unexposedDays >= 3 && (severity.difference ?? 0) >= 1 && (severity.probabilityOfHigher ?? .5) >= .65);
}
