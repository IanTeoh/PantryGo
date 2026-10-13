import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/state/HouseholdContext";
import { toEvent, type EventRow, type PantryEvent } from "@/state/PantryContext";
import { useLiveUpdates } from "@/state/useLiveUpdates";
import { startOfMonth } from "@/utils/impact";

export const INSIGHT_MONTHS = 6;

// The last 6 months of "used" and "thrown out" log entries, for the Insights tab and
// its details page. (The Home tab only needs the latest 50, so it loads its own.)
export function useInsightsEvents() {
  const { household } = useHousehold();
  const householdId = household?.id ?? null;
  const [events, setEvents] = useState<PantryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!householdId) return;
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("household_id", householdId)
      .in("type", ["used", "wasted"]) // the only kinds Insights counts
      .gte("at", startOfMonth(INSIGHT_MONTHS - 1).toISOString()) // gte = "greater than or equal"
      .order("at", { ascending: false })
      .limit(5000);
    if (error) console.warn("Couldn't load insights:", error.message);
    else setEvents((data as EventRow[]).map(toEvent));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [householdId]);

  // New log entries refresh the numbers
  useLiveUpdates("impact", ["events"], householdId, load);

  return { events, loading, reload: load };
}
