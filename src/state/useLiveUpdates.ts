import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { supabase } from "@/lib/supabase";
import { makeId } from "@/utils/ids";

// A custom hook: call `onChange` whenever any of these tables change for this household,
// on ANY phone. Returns whether we're connected right now (for the "Live" dot).
export function useLiveUpdates(
  channelName: string,
  tables: string[],
  householdId: string | null,
  onChange: () => void,
): boolean {
  const [live, setLive] = useState(false);
  // A name only this use of the hook has. Two screens listening to the same thing
  // (Insights and its Food page, say) would otherwise share one connection, and
  // Supabase refuses to add listeners to a connection that's already running.
  const instance = useRef(makeId()).current;

  // Keep a ref to the newest `onChange`, so the connection below doesn't have to be
  // torn down and rebuilt every time the provider re-renders with a new function.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (householdId === null) return;

    // Debounce: a burst of changes → one call, 300 ms after the last one
    let timer: ReturnType<typeof setTimeout> | null = null;
    function changed() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), 300);
    }

    let channel = supabase.channel(`${channelName}-${householdId}-${instance}`);
    for (const table of tables) {
      channel = channel
        // New and edited rows, only for this household
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table, filter: `household_id=eq.${householdId}` },
          changed,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table, filter: `household_id=eq.${householdId}` },
          changed,
        )
        // Supabase can't filter deletions by household (a deleted row only reports its id),
        // so listen to all deletions in the table. We only reload; nothing private is shown.
        .on("postgres_changes", { event: "DELETE", schema: "public", table }, changed);
    }
    channel.subscribe((status) => setLive(status === "SUBSCRIBED"));

    // Coming back to the app: catch up on anything missed while it was in the background
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") onChangeRef.current();
    });

    // Cleanup: stop listening when the household changes or you sign out
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
      appState.remove();
      setLive(false);
    };
    // tables.join(): compare the list by its contents, not as a new array each render
  }, [channelName, tables.join(","), householdId, instance]);

  return live;
}
