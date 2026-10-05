export function notificationRoute(data: Record<string, unknown>): { screen: 'meal' | 'checkin' | 'patterns'; patternId?: string; date?: string } | undefined {
  if (data.kind === 'food-reminder') return { screen: 'meal' };
  if (data.kind === 'day-review-reminder') return { screen: 'checkin', ...(typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? { date: data.date } : {}) };
  if (data.kind === 'new-pattern') return { screen: 'patterns', patternId: typeof data.patternId === 'string' ? data.patternId : undefined };
  return undefined;
}
