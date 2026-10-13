import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";
import type { Diet } from "@/utils/recipeMeta";

import { useAuth } from "./AuthContext";

// ---------------------------------------------------------------------------
// Your food preferences (cuisines you like, how you eat) and whether you've
// been through the setup flow. Private to you (see supabase/13_preferences.sql).
// ---------------------------------------------------------------------------

export type Preferences = {
  cuisines: string[]; // e.g. ["italian", "indian"]
  diet: Diet;
  onboarded: boolean; // finished (or skipped) the setup flow
};

const EMPTY: Preferences = { cuisines: [], diet: "any", onboarded: false };

type PreferencesContextValue = {
  prefs: Preferences;
  loading: boolean;
  savePrefs: (patch: Partial<Omit<Preferences, "onboarded">>) => Promise<string | null>;
  finishOnboarding: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

type PrefsRow = { cuisines: string[] | null; diet: Diet | null; onboarded_at: string | null };

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [prefs, setPrefs] = useState<Preferences>(EMPTY);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setPrefs(EMPTY);
      setLoadedFor(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("cuisines, diet, onboarded_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        // Most likely 13_preferences.sql hasn't been run yet. Don't trap anyone in
        // the setup flow over it: carry on as if it's done.
        console.warn("Couldn't load preferences:", error.message);
        setPrefs({ ...EMPTY, onboarded: true });
      } else {
        const row = data as PrefsRow | null;
        setPrefs({
          cuisines: row?.cuisines ?? [],
          diet: row?.diet ?? "any",
          onboarded: !!row?.onboarded_at,
        });
      }
      setLoadedFor(userId);
    })();
  }, [userId]);

  // upsert = add your row, or update it if you already have one
  async function write(fields: Record<string, unknown>) {
    if (!userId) return "You're not signed in.";
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() });
    return error ? error.message : null;
  }

  async function savePrefs(patch: Partial<Omit<Preferences, "onboarded">>) {
    setPrefs((p) => ({ ...p, ...patch })); // show it straight away
    return write(patch);
  }

  async function finishOnboarding() {
    setPrefs((p) => ({ ...p, onboarded: true })); // the app opens right away…
    // Upsert only touches the columns sent, so cuisines/diet saved earlier are kept
    await write({ onboarded_at: new Date().toISOString() }); // …and it's remembered on every phone
  }

  return (
    <PreferencesContext.Provider
      value={{
        prefs,
        loading: userId !== null && loadedFor !== userId,
        savePrefs,
        finishOnboarding,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (value === null) throw new Error("usePreferences() must be used inside <PreferencesProvider>");
  return value;
}
