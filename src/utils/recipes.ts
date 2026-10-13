import type { Item } from "@/types";

import { roundAmount } from "./units";

// Plain functions for recipes: reading ingredient lines, and checking them
// against the pantry. No React here.

export type Ingredient = {
  name: string; // "chicken thighs"
  quantity: number | null; // 500, or null for "some"
  unit: string | null; // "g", "cup"… or null for things you count
};

export type Difficulty = "easy" | "medium" | "hard";
export type CoverKey = "sage" | "tomato" | "honey" | "ocean" | "plum" | "sand";

// What every recipe has, whether it's in your household or shared with everyone
export type RecipeContent = {
  title: string;
  description: string | null; // a line or two about it
  servings: number | null;
  minutes: number | null; // total time
  difficulty: Difficulty | null;
  tags: string[]; // e.g. ["quick", "vegetarian"] (see TAGS in utils/recipeMeta.ts)
  cover: CoverKey; // the colour of its illustrated cover
  cuisine: string | null; // e.g. "italian" (see CUISINES in utils/recipeMeta.ts)
  photo: string | null; // path in Supabase Storage (see lib/photos.ts), or null for the drawing
  ingredients: Ingredient[];
  steps: string; // one step per line
};

// A recipe in your household's recipe book
export type Recipe = RecipeContent & {
  id: string;
  sourceUrl: string | null;
  createdBy: string | null;
  createdAt: number;
  publishedId: string | null; // its shared copy, if it's been shared with everyone
  savedFrom: string | null; // the shared recipe it was saved from, if any
};

// A recipe anyone on PantryGo can see (community_recipes in the database)
export type CommunityRecipe = RecipeContent & {
  id: string;
  authorId: string | null; // null = a PantryGo Kitchen starter recipe
  authorName: string;
  saveCount: number;
  createdAt: number;
};

// ---------------------------------------------------------------------------
// Reading ingredient lines: "500 g chicken thighs", "1 1/2 cups rice", "2 eggs", "salt"
// ---------------------------------------------------------------------------
const UNIT_WORDS: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  ml: "ml",
  l: "L",
  litre: "L",
  litres: "L",
  liter: "L",
  liters: "L",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  can: "can",
  cans: "can",
  tin: "can",
  tins: "can",
  pack: "pack",
  packs: "pack",
  packet: "pack",
  packets: "pack",
  jar: "jar",
  jars: "jar",
  bottle: "bottle",
  bottles: "bottle",
  clove: "clove",
  cloves: "clove",
  pinch: "pinch",
};

const FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};

// "1 1/2" → 1.5, "½" → 0.5, "2" → 2, "1.5" → 1.5
function readNumber(text: string): number | null {
  let total = 0;
  for (const part of text.trim().split(/\s+/)) {
    if (FRACTIONS[part] !== undefined) total += FRACTIONS[part];
    else if (part.includes("/")) {
      const [a, b] = part.split("/").map(Number);
      if (!b) return null;
      total += a / b;
    } else {
      const n = Number(part.replace(",", "."));
      if (!Number.isFinite(n)) return null;
      total += n;
    }
  }
  return total > 0 ? roundAmount(total) : null;
}

export function parseIngredientLine(line: string): Ingredient | null {
  let rest = line.trim().replace(/^[-•*]\s*/, ""); // drop bullet points
  if (!rest) return null;

  // A number at the start: "1 1/2", "½", "200", "1.5" (also "200g", with no space)
  const numberMatch = rest.match(
    /^((?:\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾⅓⅔])(?:\s+(?:\d+\/\d+|[½¼¾⅓⅔]))?)\s*/,
  );
  let quantity: number | null = null;
  if (numberMatch) {
    quantity = readNumber(numberMatch[1]);
    rest = rest.slice(numberMatch[0].length);
  }

  // Then maybe a unit word: "g", "cups", "tbsp"…
  let unit: string | null = null;
  const unitMatch = rest.match(/^([a-zA-Z]+)\.?\s+(?:of\s+)?/);
  if (quantity !== null && unitMatch && UNIT_WORDS[unitMatch[1].toLowerCase()]) {
    unit = UNIT_WORDS[unitMatch[1].toLowerCase()];
    rest = rest.slice(unitMatch[0].length);
  }

  const name = rest.trim();
  return name ? { name, quantity, unit } : null;
}

export function formatIngredient(ing: Ingredient): string {
  if (ing.quantity === null) return ing.name;
  return [roundAmount(ing.quantity), ing.unit, ing.name].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Matching ingredients to pantry items
// ---------------------------------------------------------------------------

// Things every kitchen is assumed to have, so recipes don't count them as missing
const STAPLES = ["salt", "pepper", "black pepper", "salt and pepper", "water", "ice"];

// Words that describe an ingredient rather than name it
const DESCRIPTIONS = new Set([
  "fresh",
  "chopped",
  "diced",
  "sliced",
  "minced",
  "large",
  "small",
  "medium",
  "ripe",
  "finely",
  "roughly",
  "grated",
  "peeled",
  "optional",
  "organic",
  "whole",
  "raw",
  "cooked",
  "boneless",
  "skinless",
  "thinly",
  "crushed",
  "softened",
  "melted",
  "to",
  "taste",
  "a",
  "an",
  "the",
  "of",
  "for",
  "and",
  "or",
  "some",
  "extra",
  "handful",
]);

// "Chopped Tomatoes (400g)" → ["tomato"]: lowercase, no brackets or descriptions, singular
function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !DESCRIPTIONS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

export function isStaple(ing: Ingredient): boolean {
  return STAPLES.includes(ing.name.trim().toLowerCase());
}

// The pantry item an ingredient refers to, if any. A match = every word of the
// shorter name appears in the longer one ("olive oil" ↔ "Extra virgin olive oil").
export function findPantryItem(ing: Ingredient, items: Item[]): Item | null {
  const want = nameWords(ing.name);
  if (want.length === 0) return null;
  let best: Item | null = null;
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const have = nameWords(item.name);
    if (have.length === 0) continue;
    const [shorter, longer] = want.length <= have.length ? [want, have] : [have, want];
    if (shorter.every((w) => longer.includes(w))) {
      // Prefer the closest match (fewest extra words)
      if (
        !best ||
        Math.abs(have.length - want.length) < Math.abs(nameWords(best.name).length - want.length)
      ) {
        best = item;
      }
    }
  }
  return best;
}

// Units that can be converted into each other, measured in g or ml
const MASS: Record<string, number> = { g: 1, kg: 1000 };
const VOLUME: Record<string, number> = { ml: 1, L: 1000, tsp: 5, tbsp: 15, cup: 250 };

// How much of `item` (in the item's own unit) this ingredient uses.
// null = can't tell (no amount in the recipe, or units that don't convert, like "cups" of eggs).
export function amountToTake(ing: Ingredient, item: Item): number | null {
  if (ing.quantity === null) return null;
  const from = ing.unit ?? "pcs";
  const to = item.unit;
  if (from === to) return ing.quantity;
  if (MASS[from] && MASS[to]) return roundAmount((ing.quantity * MASS[from]) / MASS[to]);
  if (VOLUME[from] && VOLUME[to]) return roundAmount((ing.quantity * VOLUME[from]) / VOLUME[to]);
  // Counting things: "2 eggs" against an item counted in pcs, cans, packs…
  const countUnits = ["pcs", "can", "pack", "jar", "bottle", "clove"];
  if (countUnits.includes(from) && countUnits.includes(to)) return ing.quantity;
  return null;
}

export type IngredientCheck =
  | { status: "staple" }
  | { status: "have"; item: Item; take: number | null; enough: boolean }
  | { status: "missing" };

export function checkIngredient(ing: Ingredient, items: Item[]): IngredientCheck {
  if (isStaple(ing)) return { status: "staple" };
  const item = findPantryItem(ing, items);
  if (!item) return { status: "missing" };
  const take = amountToTake(ing, item);
  return { status: "have", item, take, enough: take === null || take <= item.quantity };
}

// For the recipe list: how many ingredients you have, and which are missing
export function recipeReadiness(recipe: Pick<RecipeContent, "ingredients">, items: Item[]) {
  let have = 0;
  let total = 0;
  const missing: Ingredient[] = [];
  for (const ing of recipe.ingredients) {
    const check = checkIngredient(ing, items);
    if (check.status === "staple") continue;
    total += 1;
    if (check.status === "have" && check.enough) have += 1;
    else missing.push(ing);
  }
  return { have, total, missing, canMake: total > 0 && have === total };
}

// ---------------------------------------------------------------------------
// Cooking: what a recipe would take out of the pantry, one line per pantry item
// (two ingredients can use the same item: "1 onion" + "½ onion, to serve").
// The cook screen starts each line at the recipe's amount; you can change it.
// ---------------------------------------------------------------------------
export type CookLine = {
  item: Item;
  ingredients: string[]; // the recipe lines that use it
  recipeAmount: number | null; // in the item's unit; null = the recipe doesn't say, or can't convert
};

export function planCook(ingredients: Ingredient[], items: Item[]) {
  const lines: CookLine[] = [];
  const missing: string[] = [];
  for (const ing of ingredients) {
    const check = checkIngredient(ing, items);
    if (check.status === "staple") continue;
    if (check.status === "missing") {
      missing.push(ing.name);
      continue;
    }
    const line = lines.find((l) => l.item.id === check.item.id);
    if (line) {
      line.ingredients.push(ing.name);
      if (check.take !== null)
        line.recipeAmount = roundAmount((line.recipeAmount ?? 0) + check.take);
    } else {
      lines.push({ item: check.item, ingredients: [ing.name], recipeAmount: check.take });
    }
  }
  return { lines, missing };
}
