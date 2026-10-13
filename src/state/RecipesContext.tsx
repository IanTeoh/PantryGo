import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";
import { makeId } from "@/utils/ids";
import {
  type CoverKey,
  type Difficulty,
  type Ingredient,
  type Recipe,
  type RecipeContent,
} from "@/utils/recipes";
import { roundAmount } from "@/utils/units";

import { useHousehold } from "./HouseholdContext";
import { usePantry } from "./PantryContext";
import { useLiveUpdates } from "./useLiveUpdates";
import { useSaveQueue } from "./useSaveQueue";

// What the edit form hands over. `share` = also share it with everyone on PantryGo.
export type RecipeDraft = RecipeContent & { sourceUrl: string | null; share: boolean };

// What cooking took out of the pantry, so the screen can say so
export type Taken = { name: string; amount: number; unit: string };

type RecipesContextValue = {
  recipes: Recipe[];
  loading: boolean;
  refresh: () => Promise<void>;
  addRecipe: (draft: RecipeDraft) => string; // returns the new recipe's (temporary) id
  updateRecipe: (id: string, draft: RecipeDraft) => void;
  deleteRecipe: (id: string) => void;
  // Take these amounts out of the pantry (from the cook screen)
  takeOut: (amounts: { itemId: string; amount: number }[]) => Taken[];
};

const RecipesContext = createContext<RecipesContextValue | null>(null);

export type RecipeRow = {
  id: string;
  title: string;
  description: string | null;
  minutes: number | null;
  difficulty: Difficulty | null;
  tags: string[] | null;
  cover: CoverKey | null;
  cuisine?: string | null;
  photo?: string | null;
  published_id?: string | null;
  saved_from?: string | null;
  servings: number | null;
  source_url: string | null;
  ingredients: Ingredient[];
  steps: string;
  created_by: string | null;
  created_at: string;
};

// The parts every recipe row has (household or shared), as app values.
// Exported so CommunityContext reads shared recipes the same way.
export function toContent(
  row: Omit<RecipeRow, "id" | "source_url" | "created_by" | "created_at">,
): RecipeContent {
  return {
    title: row.title,
    description: row.description ?? null,
    servings: row.servings,
    minutes: row.minutes ?? null,
    difficulty: row.difficulty ?? null,
    tags: row.tags ?? [],
    cover: row.cover ?? "sage",
    cuisine: row.cuisine ?? null,
    photo: row.photo ?? null,
    // jsonb arrives as ordinary JavaScript objects already
    ingredients: (row.ingredients ?? []).map((i) => ({
      name: String(i.name),
      quantity: i.quantity === null || i.quantity === undefined ? null : Number(i.quantity),
      unit: i.unit ?? null,
    })),
    steps: row.steps ?? "",
  };
}

function toRecipe(row: RecipeRow): Recipe {
  return {
    ...toContent(row),
    id: row.id,
    sourceUrl: row.source_url,
    createdBy: row.created_by,
    createdAt: Date.parse(row.created_at),
    publishedId: row.published_id ?? null,
    savedFrom: row.saved_from ?? null,
  };
}

// `withPhoto`: only send the photo column when there's something to say, so
// saving still works if 14_recipe_photos.sql hasn't been run yet
function toRow(draft: RecipeDraft, withPhoto: boolean) {
  return {
    ...(withPhoto ? { photo: draft.photo } : {}),
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    servings: draft.servings,
    minutes: draft.minutes,
    difficulty: draft.difficulty,
    tags: draft.tags,
    cover: draft.cover,
    cuisine: draft.cuisine,
    source_url: draft.sourceUrl,
    ingredients: draft.ingredients,
    steps: draft.steps,
  };
}

// The local copy of a draft, before the database confirms it
function fromDraft(
  draft: RecipeDraft,
): Omit<Recipe, "id" | "createdBy" | "createdAt" | "publishedId" | "savedFrom"> {
  const { share: _share, ...rest } = draft; // "_share": pulled out and not used
  return rest;
}

export function RecipesProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household?.id ?? null;
  const { items, setQuantity } = usePantry();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  async function load(forHousehold: string) {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("household_id", forHousehold)
      .order("title");
    if (isSaving()) return;
    if (error) console.warn("Couldn't load recipes:", error.message);
    else setRecipes((data as RecipeRow[]).map(toRecipe));
    setLoadedFor(forHousehold);
  }

  useEffect(() => {
    if (householdId === null) {
      setRecipes([]);
      setLoadedFor(null);
      return;
    }
    load(householdId);
  }, [householdId]);

  async function refresh() {
    if (householdId) await load(householdId);
  }

  const { save, isSaving } = useSaveQueue(refresh);
  useLiveUpdates("recipes", ["recipes"], householdId, () => {
    if (!isSaving()) refresh();
  });

  function addRecipe(draft: RecipeDraft): string {
    // Make the real id here, so the app can open the new recipe straight away
    // and it keeps the same id once saved.
    const id = makeUuid();
    if (!householdId) return id;
    const recipe: Recipe = {
      ...fromDraft(draft),
      id,
      createdBy: null,
      createdAt: Date.now(),
      publishedId: null,
      savedFrom: null,
    };
    save(
      () => setRecipes((prev) => [...prev, recipe]),
      async () => {
        const added = await supabase
          .from("recipes")
          .insert({ id, household_id: householdId, ...toRow(draft, draft.photo !== null) });
        if (added.error || !draft.share) return added;
        // Share it too: the database copies it into community_recipes
        return supabase.rpc("publish_recipe", { p_recipe_id: id });
      },
    );
    return id;
  }

  function updateRecipe(id: string, draft: RecipeDraft) {
    const before = recipes.find((r) => r.id === id);
    const wasShared = before?.publishedId != null;
    const withPhoto = draft.photo !== null || (before?.photo ?? null) !== null;
    save(
      () =>
        setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, ...fromDraft(draft) } : r))),
      async () => {
        const updated = await supabase
          .from("recipes")
          .update({ ...toRow(draft, withPhoto), updated_at: new Date().toISOString() })
          .eq("id", id);
        if (updated.error) return updated;
        // Sharing: start, update the shared copy, or stop
        if (draft.share) return supabase.rpc("publish_recipe", { p_recipe_id: id });
        if (wasShared) return supabase.rpc("unpublish_recipe", { p_recipe_id: id });
        return updated;
      },
    );
  }

  function deleteRecipe(id: string) {
    save(
      () => setRecipes((prev) => prev.filter((r) => r.id !== id)),
      () => supabase.from("recipes").delete().eq("id", id),
    );
  }

  // Cooking: take the chosen amounts out of the pantry. Goes through setQuantity,
  // so each one is logged as "used" and counts on the Insights tab.
  function takeOut(amounts: { itemId: string; amount: number }[]): Taken[] {
    const taken: Taken[] = [];
    for (const { itemId, amount } of amounts) {
      const item = items.find((it) => it.id === itemId);
      if (!item || !(amount > 0)) continue;
      const used = Math.min(amount, item.quantity); // can't use more than there is
      setQuantity(itemId, roundAmount(item.quantity - used));
      taken.push({ name: item.name, amount: roundAmount(used), unit: item.unit });
    }
    return taken;
  }

  return (
    <RecipesContext.Provider
      value={{
        recipes,
        loading: householdId !== null && loadedFor !== householdId,
        refresh,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        takeOut,
      }}
    >
      {children}
    </RecipesContext.Provider>
  );
}

// A random id in the same format the database uses (a "UUID")
function makeUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useRecipes(): RecipesContextValue {
  const value = useContext(RecipesContext);
  if (value === null) throw new Error("useRecipes() must be used inside <RecipesProvider>");
  return value;
}
