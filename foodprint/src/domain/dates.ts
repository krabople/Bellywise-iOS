/** Use local calendar days: an ISO UTC timestamp may belong to yesterday locally. */
export function localDateKey(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (!Number.isFinite(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

/** Calendar arithmetic avoids the 23/25-hour daylight-saving day pitfall. */
export function addDays(key: string, days: number): string {
  if (!isDateKey(key)) return '';
  const [year, month, day] = key.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days, 12));
}
