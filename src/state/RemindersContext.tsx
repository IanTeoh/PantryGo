import { Storage } from "expo-sqlite/kv-store";
import { router } from "expo-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import {
  askPermission,
  onReminderTapped,
  permissionState,
  scheduleReminders,
  sendTestReminder,
  setUpNotifications,
  type PermissionState,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { addDays } from "@/utils/dates";
import {
  DAYS_AHEAD,
  DEFAULT_REMINDER_PREFS,
  planReminders,
  type ExpiringItem,
  type ReminderPrefs,
} from "@/utils/reminders";

import { useHousehold } from "./HouseholdContext";
import { usePantry } from "./PantryContext";

// ---------------------------------------------------------------------------
// Expiry reminders: your settings (kept on this phone), the phone's permission,
// and keeping the scheduled notifications up to date as the pantry changes.
// Covers every household you're in, not just the one you're looking at.
// ---------------------------------------------------------------------------

const PREFS_KEY = "pantrygo.reminders";

function readPrefs(): ReminderPrefs {
  try {
    const saved = Storage.getItemSync(PREFS_KEY);
    return saved ? { ...DEFAULT_REMINDER_PREFS, ...JSON.parse(saved) } : DEFAULT_REMINDER_PREFS;
  } catch {
    return DEFAULT_REMINDER_PREFS;
  }
}

type RemindersContextValue = {
  prefs: ReminderPrefs;
  permission: PermissionState | null; // null = still checking
  updatePrefs: (patch: Partial<ReminderPrefs>) => void;
  turnOn: () => Promise<PermissionState>; // asks the phone for permission if needed
  sendTest: () => Promise<void>;
};

const RemindersContext = createContext<RemindersContextValue | null>(null);

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { households, switchHousehold } = useHousehold();
  const { items } = usePantry(); // only used to notice changes, so reminders stay current

  const [prefs, setPrefs] = useState<ReminderPrefs>(readPrefs);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [wake, setWake] = useState(0); // bumps when the app comes back to the front

  // ---- Once: set up, check permission, and handle taps on reminders ----
  useEffect(() => {
    setUpNotifications().catch(() => {});
    permissionState()
      .then(setPermission)
      .catch(() => setPermission("undetermined"));
    const stopTaps = onReminderTapped((householdId) => {
      if (householdId) switchHousehold(householdId);
      router.push("/pantry");
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        permissionState()
          .then(setPermission)
          .catch(() => {});
        setWake((w) => w + 1); // a new day may have started: plan again
      }
    });
    return () => {
      stopTaps();
      appState.remove();
    };
  }, []);

  // ---- Whenever anything relevant changes: plan the next week of reminders ----
  const householdIds = households.map((h) => h.id).join(",");
  const itemsSignature = items.map((i) => `${i.id}:${i.quantity}:${i.expiry}`).join("|");

  useEffect(() => {
    if (permission !== "granted") return;
    let cancelled = false;
    (async () => {
      let expiring: ExpiringItem[] = [];
      if (prefs.enabled && households.length > 0) {
        // Everything in any of your households that goes off in the next week or so.
        // (The rules only let you see households you're in.)
        const { data } = await supabase
          .from("items")
          .select("name, expiry, household_id, quantity")
          .in(
            "household_id",
            households.map((h) => h.id),
          )
          .not("expiry", "is", null)
          .gt("quantity", 0)
          .gte("expiry", addDays(0))
          .lte("expiry", addDays(DAYS_AHEAD + 2));
        expiring = (data ?? []).map((row) => ({
          name: row.name as string,
          expiry: row.expiry as string,
          householdId: row.household_id as string,
          householdName: households.find((h) => h.id === row.household_id)?.name ?? "",
        }));
      }
      if (cancelled) return;
      // With reminders off this schedules nothing, which clears any old ones
      await scheduleReminders(planReminders(expiring, prefs, new Date()));
    })().catch((e) => console.warn("Couldn't schedule reminders:", e));
    return () => {
      cancelled = true;
    };
  }, [permission, prefs, householdIds, itemsSignature, wake]);

  function updatePrefs(patch: Partial<ReminderPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        Storage.setItemSync(PREFS_KEY, JSON.stringify(next));
      } catch {
        // not saved on the phone; still works until the app closes
      }
      return next;
    });
  }

  async function turnOn() {
    const state = permission === "granted" ? "granted" : await askPermission();
    setPermission(state);
    updatePrefs({ enabled: state === "granted", asked: true });
    return state;
  }

  return (
    <RemindersContext.Provider
      value={{ prefs, permission, updatePrefs, turnOn, sendTest: sendTestReminder }}
    >
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders(): RemindersContextValue {
  const value = useContext(RemindersContext);
  if (value === null) throw new Error("useReminders() must be used inside <RemindersProvider>");
  return value;
}
