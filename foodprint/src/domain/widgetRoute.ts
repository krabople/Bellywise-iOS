/** Only explicitly supported local widget actions can open a form. */
export function widgetRoute(url: string): 'meal' | 'symptom' | 'checkin' | undefined {
  const match = /^bellywise:\/\/quick-log\/(food|feeling|review)\/?$/i.exec(url);
  if (!match) return undefined;
  return ({ food: 'meal', feeling: 'symptom', review: 'checkin' } as const)[match[1].toLowerCase() as 'food' | 'feeling' | 'review'];
}
