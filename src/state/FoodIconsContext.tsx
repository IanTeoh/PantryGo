import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { FOOD_ART, type FoodArtName } from "@/data/foodArt";
import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/state/HouseholdContext";
import { useLiveUpdates } from "@/state/useLiveUpdates";
import { nameKey } from "@/utils/foodArt";

// ---------------------------------------------------------------------------
// The drawings people in your household have picked for foods, remembered by
// name ("tofu" → the tofu block). See supabase/21_food_icons.sql.
// ---------------------------------------------------------------------------

type FoodIconsValue = {
  // The picked drawing for this name, or null to use the app's own guess
  chosenArt: (name: string) => FoodArtName | null;
  // Pick a drawing for a name (null = go back to the app's guess). Returns an error message or null.
  chooseArt: (name: string, art: FoodArtName | null) => Promise<string | null>;
};

const FoodIconsContext = createContext<FoodIconsValue | null>(null);

type Row = { name_key: string; art: string };

export function FoodIconsProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household?.id ?? null;
  const [chosen, setChosen] = useState<Map<string, FoodArtName>>(new Map());

  async function refresh() {
    if (householdId === null) return setChosen(new Map());
    const { data, error } = await supabase
      .from("food_icons")
      .select("name_key, art")
      .eq("household_id", householdId);
    if (error) return; // most likely 21_food_icons.sql hasn't been run yet: just use the guesses
    const map = new Map<string, FoodArtName>();
    for (const row of data as Row[]) {
      // Ignore drawings this version of the app doesn't have (e.g. picked on a newer version)
      if (row.art in FOOD_ART) map.set(row.name_key, row.art as FoodArtName);
    }
    setChosen(map);
  }

  useEffect(() => {
    refresh();
  }, [householdId]);

  // A housemate picks a drawing → it changes on this phone too
  useLiveUpdates("food-icons", ["food_icons"], householdId, refresh);

  function chosenArt(name: string): FoodArtName | null {
    return chosen.get(nameKey(name)) ?? null;
  }

  async function chooseArt(name: string, art: FoodArtName | null): Promise<string | null> {
    if (householdId === null) return "Join a household first.";
    const key = nameKey(name);
    if (key === "") return null;

    // Show it straight away; undo if saving fails
    const before = chosen;
    const next = new Map(chosen);
    if (art) next.set(key, art);
    else next.delete(key);
    setChosen(next);

    const { error } = art
      ? await supabase
          .from("food_icons")
          .upsert(
            { household_id: householdId, name_key: key, art, updated_at: new Date().toISOString() },
            { onConflict: "household_id,name_key" },
          )
      : await supabase
          .from("food_icons")
          .delete()
          .eq("household_id", householdId)
          .eq("name_key", key);
    if (error) {
      setChosen(before);
      return error.message.includes("food_icons")
        ? "Changing drawings needs a quick database update (supabase/21_food_icons.sql)."
        : "Couldn't save that. Check your connection and try again.";
    }
    return null;
  }

  return (
    <FoodIconsContext.Provider value={{ chosenArt, chooseArt }}>
      {children}
    </FoodIconsContext.Provider>
  );
}

// Not throwing outside the provider on purpose: a FoodIcon anywhere just falls back to the guess
export function useFoodIcons(): FoodIconsValue {
  return (
    useContext(FoodIconsContext) ?? {
      chosenArt: () => null,
      chooseArt: async () => "Not available here.",
    }
  );
}
