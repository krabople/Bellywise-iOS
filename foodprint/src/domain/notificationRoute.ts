export function notificationRoute(data: Record<string, unknown>): { screen: 'meal' | 'checkin' | 'patterns'; patternId?: string } | undefined {
  if (data.kind === 'food-reminder') return { screen: 'meal' };
  if (data.kind === 'day-review-reminder') return { screen: 'checkin' };
  if (data.kind === 'new-pattern') return { screen: 'patterns', patternId: typeof data.patternId === 'string' ? data.patternId : undefined };
  return undefined;
}
