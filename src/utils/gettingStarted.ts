import { useSyncExternalStore } from "react";
import { Storage } from "expo-sqlite/kv-store";

// The "Getting started" checklist on Home: whether it's shown, and which steps
// have been done. Kept on this phone.
//
//   mode "auto"   → shown for new accounts (under NEW_FOR_DAYS old) until done or closed
//   mode "hidden" → closed with ✕, or finished
//   mode "shown"  → turned back on in Profile (even for older accounts)
//
// Steps are remembered once done, so emptying the shopping list later doesn't un-tick it.

export type GettingStartedMode = "auto" | "hidden" | "shown";
export type StepId = "add" | "use" | "shop" | "recipe" | "invite";

export const NEW_FOR_DAYS = 14;

const MODE_KEY = "pantrygo.gettingStarted";
const DONE_KEY = "pantrygo.gettingStarted.done";

type State = { mode: GettingStartedMode; done: StepId[] };

function read(): State {
  try {
    const mode = Storage.getItemSync(MODE_KEY);
    const done = JSON.parse(Storage.getItemSync(DONE_KEY) ?? "[]");
    return {
      mode: mode === "hidden" || mode === "shown" ? mode : "auto",
      done: Array.isArray(done) ? done : [],
    };
  } catch {
    return { mode: "auto", done: [] };
  }
}

let current = read();
const listeners = new Set<() => void>();

function write(next: State) {
  current = next;
  try {
    Storage.setItemSync(MODE_KEY, next.mode);
    Storage.setItemSync(DONE_KEY, JSON.stringify(next.done));
  } catch {
    // not remembered this time: fine
  }
  listeners.forEach((l) => l());
}

export function setGettingStartedMode(mode: GettingStartedMode) {
  write({ ...current, mode });
}

export function rememberDone(steps: StepId[]) {
  const added = steps.filter((s) => !current.done.includes(s));
  if (added.length > 0) write({ ...current, done: [...current.done, ...added] });
}

export function useGettingStarted(): State {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

// Is this account new enough to be shown the checklist without asking?
export function isNewAccount(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const age = Date.now() - Date.parse(createdAt);
  return age >= 0 && age < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;
}
