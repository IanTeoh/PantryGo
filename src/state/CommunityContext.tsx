import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";
import type { CommunityRecipe } from "@/utils/recipes";

import { useAuth } from "./AuthContext";
import { useHousehold } from "./HouseholdContext";
import { toContent, useRecipes, type RecipeRow } from "./RecipesContext";

// ---------------------------------------------------------------------------
// Recipes shared with everyone on PantryGo (plus the PantryGo Kitchen starters).
// Anyone signed in can read them; saving one copies it into your household.
// ---------------------------------------------------------------------------

type CommunityContextValue = {
  recipes: CommunityRecipe[]; // most saved first
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  // Copies it into your household's recipe book. Returns the new recipe's id, or an error.
  saveToMine: (id: string) => Promise<{ id: string } | { error: string }>;
  report: (id: string, reason: string) => Promise<string | null>; // error message or null
  // People you've blocked: their shared recipes are hidden for you (15_blocking.sql)
  blocked: BlockedPerson[];
  block: (userId: string, name: string) => Promise<string | null>;
  unblock: (userId: string) => Promise<string | null>;
};

export type BlockedPerson = { userId: string; name: string };

const CommunityContext = createContext<CommunityContextValue | null>(null);

type CommunityRow = Omit<RecipeRow, "source_url" | "created_by" | "published_id" | "saved_from"> & {
  author_id: string | null;
  author_name: string;
  save_count: number;
};

function toCommunity(row: CommunityRow): CommunityRecipe {
  return {
    ...toContent(row),
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name || "A PantryGo cook",
    saveCount: row.save_count,
    createdAt: Date.parse(row.created_at),
  };
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { household } = useHousehold();
  const { refresh: refreshMine } = useRecipes();
  const signedIn = session !== null;

  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedPerson[]>([]);

  async function loadBlocked() {
    const { data, error: e } = await supabase
      .from("user_blocks")
      .select("blocked, blocked_name")
      .order("created_at", { ascending: false });
    if (e) return; // most likely 15_blocking.sql hasn't been run yet: nobody's blocked
    setBlocked(
      (data as { blocked: string; blocked_name: string | null }[]).map((r) => ({
        userId: r.blocked,
        name: r.blocked_name || "Someone",
      })),
    );
  }

  async function load() {
    const { data, error: e } = await supabase
      .from("community_recipes")
      .select("*")
      .order("save_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300); // plenty for now; search happens on the phone
    if (e) setError(e.message);
    else {
      setError(null);
      setRecipes((data as CommunityRow[]).map(toCommunity));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!signedIn) {
      setRecipes([]);
      setBlocked([]);
      return;
    }
    load();
    loadBlocked();
  }, [signedIn]);

  async function saveToMine(id: string) {
    if (!household) return { error: "Join a household first" };
    const { data, error: e } = await supabase.rpc("save_community_recipe", {
      p_recipe_id: id,
      p_household_id: household.id,
    });
    if (e) return { error: e.message };
    await Promise.all([refreshMine(), load()]); // your book, and the save count
    return { id: data as string };
  }

  async function report(id: string, reason: string) {
    const { error: e } = await supabase.rpc("report_recipe", {
      p_recipe_id: id,
      p_reason: reason.trim() || null,
    });
    if (!e) await load(); // a recipe you report disappears for you straight away
    return e ? e.message : null;
  }

  async function block(userId: string, name: string) {
    const { error: e } = await supabase
      .from("user_blocks")
      .insert({ blocked: userId, blocked_name: name.slice(0, 80) });
    if (e && !e.message.includes("duplicate")) {
      return e.message.includes("user_blocks")
        ? "Blocking isn't set up yet. Run supabase/15_blocking.sql in Supabase."
        : e.message;
    }
    await Promise.all([load(), loadBlocked()]); // their recipes disappear
    return null;
  }

  async function unblock(userId: string) {
    const { error: e } = await supabase.from("user_blocks").delete().eq("blocked", userId);
    if (e) return e.message;
    setBlocked((prev) => prev.filter((p) => p.userId !== userId));
    await load(); // their recipes come back
    return null;
  }

  return (
    <CommunityContext.Provider
      value={{
        recipes,
        loading,
        error,
        refresh: load,
        saveToMine,
        report,
        blocked,
        block,
        unblock,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunity(): CommunityContextValue {
  const value = useContext(CommunityContext);
  if (value === null) throw new Error("useCommunity() must be used inside <CommunityProvider>");
  return value;
}
