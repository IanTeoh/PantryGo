import { useEffect, useRef } from "react";
import { Alert } from "react-native";

type DatabaseResult = PromiseLike<{ error: { message: string } | null }>;

// A custom hook: our own reusable piece of state + logic, built from React's hooks.
// Both the pantry and the shopping list save changes the same way, so it lives here once.
//
// "Optimistic" saving:
//   1. update the screen straight away, assuming it'll work
//   2. send the change to the database
//   3. once the last of a burst of changes has saved, reload to match the database exactly
export function useSaveQueue(reload: () => Promise<void>) {
  // How many saves are on their way right now. A ref: changing it shouldn't redraw anything.
  const pending = useRef(0);

  // Always call the newest `reload` (it changes on every render of the provider)
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  });

  async function save(updateScreen: () => void, sendToDatabase: () => DatabaseResult) {
    updateScreen();
    pending.current += 1;
    const { error } = await sendToDatabase();
    pending.current -= 1;

    if (error) {
      Alert.alert("Couldn't save that change", error.message);
    }
    if (pending.current === 0) {
      await reloadRef.current();
    }
  }

  // Loads should ignore their results while saves are still going (they'd be out of date)
  function isSaving() {
    return pending.current > 0;
  }

  return { save, isSaving };
}
