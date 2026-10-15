import { useSyncExternalStore } from "react";
import { Storage } from "expo-sqlite/kv-store";

// Whether lists show a little food drawing next to each item (on by default).
// Chosen in Profile → Features or during setup, and kept on this phone.
//
// It's a tiny "store": screens call useFoodPictures(), and when the setting
// changes every screen showing food drawings redraws straight away, with no restart.
const KEY = "pantrygo.foodPictures";

function read(): boolean {
  try {
    return Storage.getItemSync(KEY) !== "off";
  } catch {
    return true;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function setFoodPictures(on: boolean) {
  current = on;
  try {
    Storage.setItemSync(KEY, on ? "on" : "off");
  } catch {
    // not remembered this time: fine
  }
  listeners.forEach((l) => l());
}

export function useFoodPictures(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
