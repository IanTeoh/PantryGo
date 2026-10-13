import { toIsoDate } from "@/utils/dates";

// ---------------------------------------------------------------------------
// Planning expiry reminders. Plain functions (no phone APIs), so they're easy
// to test. lib/notifications.ts does the actual scheduling.
// ---------------------------------------------------------------------------

export type ReminderPrefs = {
  enabled: boolean; // expiry reminders on?
  daysBefore: 0 | 1 | 2; // how early to warn: 0 = on the day only
  hour: number; // what time of day (24-hour clock)
  asked: boolean; // have we offered to turn them on yet? (for the Home card)
};

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  enabled: true,
  daysBefore: 1,
  hour: 8,
  asked: false,
};

export type ExpiringItem = {
  name: string;
  expiry: string; // "YYYY-MM-DD"
  householdId: string;
  householdName: string;
};

export type PlannedReminder = {
  at: Date;
  title: string;
  body: string;
  householdId: string; // the household to open when it's tapped
};

// How many days ahead to schedule. Phones only keep a limited number of
// scheduled notifications, and the app re-plans every time it's opened anyway.
export const DAYS_AHEAD = 7;

// One reminder per day at most: what to use today, and (if you want warning)
// what goes off in the next day or two.
export function planReminders(
  items: ExpiringItem[],
  prefs: ReminderPrefs,
  now: Date,
): PlannedReminder[] {
  if (!prefs.enabled) return [];
  const severalHouseholds = new Set(items.map((i) => i.householdId)).size > 1;
  const label = (i: ExpiringItem) =>
    severalHouseholds ? `${i.name} (${i.householdName})` : i.name;

  const plans: PlannedReminder[] = [];
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const at = new Date(now);
    at.setDate(at.getDate() + d);
    at.setHours(prefs.hour, 0, 0, 0);
    if (at.getTime() <= now.getTime()) continue; // today's time has already passed

    const day = (offset: number) => {
      const x = new Date(at);
      x.setDate(x.getDate() + offset);
      return toIsoDate(x);
    };
    const today = items.filter((i) => i.expiry === day(0));
    const later =
      prefs.daysBefore > 0 ? items.filter((i) => i.expiry === day(prefs.daysBefore)) : [];
    if (today.length + later.length === 0) continue;

    const parts: string[] = [];
    if (today.length) parts.push(`Use today: ${listOf(today.map(label))}`);
    if (later.length) {
      const when = prefs.daysBefore === 1 ? "Tomorrow" : "In 2 days";
      parts.push(`${when}: ${listOf(later.map(label))}`);
    }
    const count = today.length + later.length;
    plans.push({
      at,
      title:
        today.length > 0
          ? `${count} ${count === 1 ? "thing" : "things"} to use up`
          : `${count} ${count === 1 ? "thing goes" : "things go"} off soon`,
      body: parts.join("\n"),
      // Open the household with the most going off
      householdId: mostCommon([...today, ...later].map((i) => i.householdId)),
    });
  }
  return plans;
}

// ["a", "b", "c", "d", "e"] → "a, b, c and 2 more"
function listOf(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

function mostCommon(ids: string[]): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}
