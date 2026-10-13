import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { PlannedReminder } from "@/utils/reminders";

// ---------------------------------------------------------------------------
// The phone side of reminders: permission, and scheduling local notifications.
// "Local" = scheduled on this phone, no server needed. They still arrive when
// the app is closed.
// ---------------------------------------------------------------------------

const CHANNEL = "expiry"; // Android groups notifications into "channels" people can mute
const KIND = "pantrygo-expiry"; // marks our notifications, so we only cancel our own

// Run once when the app starts
export async function setUpNotifications() {
  // While the app is open, still show the banner (by default it would be hidden)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Expiry reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export type PermissionState = "granted" | "denied" | "undetermined";

export async function permissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

// Shows the phone's "Allow notifications?" prompt (only the first time; after a
// "Don't allow", only the phone's Settings app can change it)
export async function askPermission(): Promise<PermissionState> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionState;
}

// Replace all our scheduled reminders with these
export async function scheduleReminders(plans: PlannedReminder[]) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  for (const plan of plans) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: plan.title,
        body: plan.body,
        data: { kind: KIND, householdId: plan.householdId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: plan.at,
        channelId: CHANNEL,
      },
    });
  }
}

// "Send a test reminder": arrives in a few seconds
export async function sendTestReminder() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "PantryGo reminders are on",
      body: "This is what a reminder looks like. You'll get one on days something's going off.",
      data: { kind: "pantrygo-test" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: CHANNEL,
    },
  });
}

// Call `onOpen` with the household id when someone taps one of our reminders
export function onReminderTapped(onOpen: (householdId: string | null) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.kind === KIND || data?.kind === "pantrygo-test") {
      onOpen(typeof data.householdId === "string" ? data.householdId : null);
    }
  });
  return () => sub.remove();
}
