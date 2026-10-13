import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { supabase } from "@/lib/supabase";
import { addDays, toIsoDate } from "@/utils/dates";
import { makeId } from "@/utils/ids";
import type { Macros } from "@/utils/nutrition";

import { useAuth } from "./AuthContext";
import { useSaveQueue } from "./useSaveQueue";

// ---------------------------------------------------------------------------
// Your calorie log. Private: the database only ever gives you your own rows
// (see supabase/08_nutrition.sql), so this doesn't need the household at all.
// ---------------------------------------------------------------------------

// How many days of history to keep loaded (enough for "this week" and a bit)
const DAYS_LOADED = 35;

export type FoodEntry = Macros & {
  id: string;
  day: string; // "YYYY-MM-DD": the day it counts towards
  at: number; // when it was logged (ms)
  name: string;
  amount: number | null; // e.g. 200 (null for "a slice of pizza")
  unit: string | null; // e.g. "ml"
  itemId: string | null; // the pantry item it came from, if any
};

// Daily targets. null = no goal for that one.
export type Goals = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const NO_GOALS: Goals = { kcal: null, protein: null, carbs: null, fat: null };

// What a screen passes to log something (the id, time and owner are filled in for it)
export type NewFoodEntry = Omit<FoodEntry, "id" | "at" | "day"> & { day?: string };

// Something you eat often, saved with its calories so it's one tap to log ("My foods")
export type SavedFood = Macros & {
  id: string;
  name: string; // "Breakfast shake"
  serving: string | null; // "1 glass"
  lastUsedAt: number;
};

type NutritionContextValue = {
  entries: FoodEntry[]; // newest first
  goals: Goals;
  loading: boolean;
  refresh: () => Promise<void>;
  logFood: (entry: NewFoodEntry) => void;
  deleteEntry: (id: string) => void;
  saveGoals: (goals: Goals) => void;
  savedFoods: SavedFood[]; // most recently used first
  saveFood: (food: Omit<SavedFood, "id" | "lastUsedAt">) => Promise<string | null>; // error or null
  deleteSavedFood: (id: string) => void;
  // Log `servings` of a saved food today (or on `day`)
  logSavedFood: (food: SavedFood, servings: number, day?: string) => void;
};

const NutritionContext = createContext<NutritionContextValue | null>(null);

// ---- Database rows → app types ----
type FoodRow = {
  id: string;
  eaten_on: string;
  at: string;
  name: string;
  amount: number | string | null;
  unit: string | null;
  kcal: number | string;
  protein: number | string | null;
  carbs: number | string | null;
  fat: number | string | null;
  item_id: string | null;
};

type GoalsRow = {
  kcal: number | string | null;
  protein: number | string | null;
  carbs: number | string | null;
  fat: number | string | null;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

type SavedFoodRow = {
  id: string;
  name: string;
  serving: string | null;
  kcal: number | string;
  protein: number | string | null;
  carbs: number | string | null;
  fat: number | string | null;
  last_used_at: string;
};

function toSavedFood(row: SavedFoodRow): SavedFood {
  return {
    id: row.id,
    name: row.name,
    serving: row.serving,
    kcal: Number(row.kcal),
    protein: num(row.protein) ?? 0,
    carbs: num(row.carbs) ?? 0,
    fat: num(row.fat) ?? 0,
    lastUsedAt: Date.parse(row.last_used_at),
  };
}

function toEntry(row: FoodRow): FoodEntry {
  return {
    id: row.id,
    day: row.eaten_on,
    at: Date.parse(row.at),
    name: row.name,
    amount: num(row.amount),
    unit: row.unit,
    kcal: Number(row.kcal),
    protein: num(row.protein) ?? 0,
    carbs: num(row.carbs) ?? 0,
    fat: num(row.fat) ?? 0,
    itemId: row.item_id,
  };
}

export function NutritionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<Goals>(NO_GOALS);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  async function load(forUser: string) {
    const [logResult, goalsResult] = await Promise.all([
      supabase
        .from("food_log")
        .select("*")
        .eq("user_id", forUser)
        .gte("eaten_on", addDays(-(DAYS_LOADED - 1)))
        .order("at", { ascending: false }),
      // maybeSingle(): zero rows is fine (no goals set yet)
      supabase.from("nutrition_goals").select("*").eq("user_id", forUser).maybeSingle(),
    ]);
    if (isSaving()) return; // newer changes are on their way; a reload follows them

    // Saved foods on their own: if 17_undo_and_saved_foods.sql hasn't been run yet,
    // the rest of the tracker still works
    supabase
      .from("saved_foods")
      .select("*")
      .eq("user_id", forUser)
      .order("last_used_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setSavedFoods((data as SavedFoodRow[]).map(toSavedFood));
      });

    if (logResult.error || goalsResult.error) {
      console.warn(
        "Couldn't load calories:",
        logResult.error?.message ?? goalsResult.error?.message,
      );
    } else {
      setEntries((logResult.data as FoodRow[]).map(toEntry));
      const g = goalsResult.data as GoalsRow | null;
      setGoals(
        g
          ? { kcal: num(g.kcal), protein: num(g.protein), carbs: num(g.carbs), fat: num(g.fat) }
          : NO_GOALS,
      );
    }
    setLoadedFor(forUser);
  }

  useEffect(() => {
    if (userId === null) {
      // Signed out: forget the last person's log straight away
      setEntries([]);
      setGoals(NO_GOALS);
      setSavedFoods([]);
      setLoadedFor(null);
      return;
    }
    load(userId);

    // Coming back to the app (maybe on a new day, or after logging on another phone): reload
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") load(userId);
    });
    return () => sub.remove();
  }, [userId]);

  async function refresh() {
    if (userId) await load(userId);
  }

  const { save, isSaving } = useSaveQueue(refresh);

  function logFood(entry: NewFoodEntry) {
    if (!userId) return;
    const day = entry.day ?? toIsoDate(new Date());
    const temp: FoodEntry = { ...entry, day, id: `temp-${makeId()}`, at: Date.now() };
    save(
      () => setEntries((prev) => [temp, ...prev]),
      () =>
        supabase.from("food_log").insert({
          eaten_on: day,
          name: entry.name.trim(),
          amount: entry.amount,
          unit: entry.unit,
          kcal: entry.kcal,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          item_id: entry.itemId,
        }),
    );
  }

  function deleteEntry(id: string) {
    save(
      () => setEntries((prev) => prev.filter((e) => e.id !== id)),
      () => supabase.from("food_log").delete().eq("id", id),
    );
  }

  function saveGoals(next: Goals) {
    // upsert = insert, or update if you already have a row
    save(
      () => setGoals(next),
      () =>
        supabase
          .from("nutrition_goals")
          .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }),
    );
  }

  // ---- Saved foods ----
  async function saveFood(food: Omit<SavedFood, "id" | "lastUsedAt">) {
    if (!userId) return "You're not signed in.";
    const { data, error } = await supabase
      .from("saved_foods")
      .insert({
        name: food.name.trim(),
        serving: food.serving?.trim() || null,
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      })
      .select("*")
      .single();
    if (error) {
      return error.message.includes("saved_foods")
        ? "Saved foods aren't set up yet. Run supabase/17_undo_and_saved_foods.sql in Supabase."
        : error.message;
    }
    setSavedFoods((prev) => [toSavedFood(data as SavedFoodRow), ...prev]);
    return null;
  }

  function deleteSavedFood(id: string) {
    save(
      () => setSavedFoods((prev) => prev.filter((f) => f.id !== id)),
      () => supabase.from("saved_foods").delete().eq("id", id),
    );
  }

  function logSavedFood(food: SavedFood, servings: number, day?: string) {
    const r = (n: number) => Math.round(n * servings * 10) / 10;
    logFood({
      day,
      name: food.name,
      amount: servings,
      unit: servings === 1 ? "serving" : "servings",
      kcal: r(food.kcal),
      protein: r(food.protein),
      carbs: r(food.carbs),
      fat: r(food.fat),
      itemId: null,
    });
    // Move it to the top of the list (most recently used first)
    const now = new Date();
    setSavedFoods((prev) => [
      { ...food, lastUsedAt: now.getTime() },
      ...prev.filter((f) => f.id !== food.id),
    ]);
    supabase
      .from("saved_foods")
      .update({ last_used_at: now.toISOString() })
      .eq("id", food.id)
      .then(() => {});
  }

  const value: NutritionContextValue = {
    entries,
    goals,
    loading: userId !== null && loadedFor !== userId,
    refresh,
    logFood,
    deleteEntry,
    saveGoals,
    savedFoods,
    saveFood,
    deleteSavedFood,
    logSavedFood,
  };

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}

export function useNutrition(): NutritionContextValue {
  const value = useContext(NutritionContext);
  if (value === null) {
    throw new Error("useNutrition() must be used inside <NutritionProvider>");
  }
  return value;
}

// ---- Small helpers the screens share ----

// Everything logged on one day
export function entriesOn(entries: FoodEntry[], day: string): FoodEntry[] {
  return entries.filter((e) => e.day === day);
}

// The last `n` days, oldest first: ["2026-10-05", …, "2026-10-11"]
export function lastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(i - (n - 1)));
}
