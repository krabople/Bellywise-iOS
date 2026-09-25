import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let handlerConfigured = false;

export function configureLocalNotifications() {
  if (handlerConfigured || Platform.OS === 'web') return;
  // Belt-and-braces: this app intentionally uses only iOS local scheduling.
  void Notifications.setAutoServerRegistrationEnabledAsync(false).catch(() => {});
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
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
  if (!enabled) return [];
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

export async function notifyNewPatterns(patterns: { ingredientName: string; symptomName: string }[]): Promise<void> {
  if (Platform.OS === 'web' || patterns.length === 0) return;
  const body = patterns.length === 1
    ? `${patterns[0].ingredientName} and ${patterns[0].symptomName.toLowerCase()} are now worth a closer look in your diary.`
    : `${patterns.length} diary comparisons are now worth a closer look.`;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Bellywise noticed a new pattern', body, sound: 'default', data: { kind: 'new-pattern' } },
    trigger: null,
  });
}
