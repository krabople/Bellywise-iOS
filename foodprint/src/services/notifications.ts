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

export async function replaceDailyReminder(previousId: string | undefined, hour: number, minute: number, enabled: boolean): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;
  if (previousId) {
    try { await Notifications.cancelScheduledNotificationAsync(previousId); } catch { /* It may have been removed in iOS Settings. */ }
  }
  if (!enabled) return undefined;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'A quick Bellywise check-in',
      body: 'Log today’s food, drinks and feelings while they are still fresh in your mind.',
      sound: 'default',
      data: { kind: 'daily-reminder' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
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
