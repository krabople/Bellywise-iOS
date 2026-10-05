import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { isCompletedReviewNotification, plannedDayReviews, reviewReminderChanges } from '../domain/dayReviewReminders';
import type { DayCheckIn, NotificationPreferences } from '../domain/types';

let handlerConfigured = false;

export function configureLocalNotifications(getCheckIns: () => DayCheckIn[] = () => []) {
  if (handlerConfigured || Platform.OS === 'web') return;
  // Belt-and-braces: this app intentionally uses only iOS local scheduling.
  void Notifications.setAutoServerRegistrationEnabledAsync(false).catch(() => {});
  Notifications.setNotificationHandler({
    handleNotification: async notification => {
      const show = !isCompletedReviewNotification(notification.request.content.data ?? {}, getCheckIns());
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
  handlerConfigured = true;
}

export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return requested.granted;
}

export async function replaceLocalReminders(previousIds: (string | undefined)[], times: { hour: number; minute: number }[], enabled: boolean, kind: 'food' | 'day-review'): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  for (const previousId of previousIds) {
    if (!previousId) continue;
    try { await Notifications.cancelScheduledNotificationAsync(previousId); } catch { /* It may have been removed in iOS Settings. */ }
  }
  // The review scheduler below owns date-specific reminders, never a daily repeat.
  if (!enabled || kind === 'day-review') return [];
  const content = kind === 'food'
    ? { title: 'Time to log food or drink', body: 'Add what you ate or drank while it is still fresh in your mind.' }
    : { title: 'How was your day?', body: 'Log any feelings, or confirm that today was symptom-free.' };
  const ids: string[] = [];
  try {
    for (const time of times) ids.push(await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: 'default', data: { kind: `${kind}-reminder` } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: time.hour, minute: time.minute },
    }));
  } catch (error) {
    for (const id of ids) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* Best-effort rollback. */ }
    }
    throw error;
  }
  return ids;
}

let reviewQueue = Promise.resolve();
/** Reconcile the local iOS queue after saving reviews/preferences and on launch/resume.
 * 45 one-off reviews + at most 3 repeating food reminders stay below iOS's 64 limit.
 * Completed dates are physically cancelled, so no background JavaScript is needed. */
export function reconcileDayReviewReminders(checkIns: DayCheckIn[], preferences: NotificationPreferences, now = new Date()): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  const operation = reviewQueue.then(async () => {
    const plan = preferences.dayReviewReminderEnabled ? plannedDayReviews(checkIns, { hour: preferences.dayReviewReminderHour, minute: preferences.dayReviewReminderMinute }, now) : [];
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const changes = reviewReminderChanges(plan, scheduled.map(row => ({ identifier: row.identifier, kind: row.content.data?.kind })), preferences.dayReviewReminderId);
    for (const identifier of changes.cancel) await Notifications.cancelScheduledNotificationAsync(identifier);
    for (const reminder of changes.add) await Notifications.scheduleNotificationAsync({
      identifier: reminder.id, content: { title: 'How was your day?', body: 'Log any feelings, or confirm that the day was symptom-free.', sound: 'default', data: { kind: 'day-review-reminder', date: reminder.date } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
    });
  });
  reviewQueue = operation.catch(() => {});
  return operation;
}

export async function notifyNewPatterns(patterns: { id?: string; ingredientName: string; symptomName: string }[]): Promise<void> {
  if (Platform.OS === 'web' || patterns.length === 0) return;
  const body = patterns.length === 1
    ? `${patterns[0].ingredientName} and ${patterns[0].symptomName.toLowerCase()} are now worth a closer look in your diary.`
    : `${patterns.length} diary comparisons are now worth a closer look.`;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Bellywise noticed a new pattern', body, sound: 'default', data: { kind: 'new-pattern', patternId: patterns.length === 1 ? patterns[0].id : undefined } },
    trigger: null,
  });
}

/** Register only after diary loading so a cold-start tap cannot be overwritten by onboarding. */
export function listenForLocalNotificationTaps(onTap: (data: Record<string, unknown>) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  let active = true;
  const handled = new Set<string>();
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!active || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier + ':' + response.notification.date;
    if (handled.has(id)) return;
    handled.add(id);
    onTap(response.notification.request.content.data ?? {});
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  const listener = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => { active = false; listener.remove(); };
}
