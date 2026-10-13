import type { FoodArtName } from "@/data/foodArt";
import { bestFoodMatch } from "@/utils/foodMatch";
import { formatKcal, type Macros } from "@/utils/nutrition";
import { isStaple, type Difficulty, type Ingredient } from "@/utils/recipes";
import { roundAmount } from "@/utils/units";

// ---------------------------------------------------------------------------
// The look and the extras of a recipe: covers, tags, scaling, calories per serve.
// ---------------------------------------------------------------------------

// ---- Tags: a fixed list, so filtering works across everyone's recipes ----
// You can add up to MAX_CUSTOM_TAGS of your own too ("Mum's", "meal prep"). They show
// on the recipe, but Discover's filters stick to this list.
export const TAGS: { value: string; label: string }[] = [
  { value: "quick", label: "Quick" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "budget", label: "Budget" },
  { value: "breakfast", label: "Breakfast" },
  { value: "dinner", label: "Dinner" },
  { value: "baking", label: "Baking" },
  { value: "use-it-up", label: "Use it up" },
  { value: "freezer-friendly", label: "Freezer friendly" },
  { value: "no-cook", label: "No cook" },
];

export function tagLabel(value: string): string {
  return TAGS.find((t) => t.value === value)?.label ?? value; // your own tags show as typed
}

export const MAX_CUSTOM_TAGS = 3;
export const MAX_TAG_LENGTH = 20;
export const isBuiltInTag = (value: string) => TAGS.some((t) => t.value === value);

// Tidies a typed tag: trims, squashes spaces, cuts to length. A built-in tag typed by
// hand ("quick") becomes the built-in one. "" if there's nothing left.
export function cleanTag(typed: string): string {
  const t = typed.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
  const builtIn = TAGS.find(
    (x) => x.label.toLowerCase() === t.toLowerCase() || x.value === t.toLowerCase(),
  );
  return builtIn ? builtIn.value : t;
}

// ---- Cuisines: what kind of food a recipe is, for "recipes you'll like" ----
export const CUISINES: { value: string; label: string; art: FoodArtName }[] = [
  { value: "kiwi", label: "Kiwi classics", art: "pie" },
  { value: "italian", label: "Italian", art: "pizza" },
  { value: "mexican", label: "Mexican", art: "taco" },
  { value: "indian", label: "Indian", art: "curry-rice" },
  { value: "chinese", label: "Chinese", art: "dumpling" },
  { value: "japanese", label: "Japanese", art: "sushi" },
  { value: "korean", label: "Korean", art: "hot-pepper" },
  { value: "thai", label: "Thai", art: "coconut" },
  { value: "vietnamese", label: "Vietnamese", art: "steaming-bowl" },
  { value: "middle-eastern", label: "Middle Eastern", art: "flatbread" },
  { value: "mediterranean", label: "Mediterranean", art: "olive" },
  { value: "american", label: "American", art: "hamburger" },
];

// A cuisine's name. Ones people typed themselves ("Malaysian") show as typed.
export function cuisineLabel(value: string | null): string | null {
  if (!value) return null;
  return CUISINES.find((c) => c.value === value)?.label ?? value;
}

export const isBuiltInCuisine = (value: string | null) => CUISINES.some((c) => c.value === value);
export const MAX_CUISINE_LENGTH = 30;

// How you eat, from your preferences
export type Diet = "any" | "vegetarian" | "vegan";

// Does a recipe suit how you eat? (Goes by its tags: vegan counts as vegetarian too.)
export function suitsDiet(tags: string[], diet: Diet): boolean {
  if (diet === "vegan") return tags.includes("vegan");
  if (diet === "vegetarian") return tags.includes("vegetarian") || tags.includes("vegan");
  return true;
}

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Takes effort" },
];

export function difficultyLabel(d: Difficulty | null): string | null {
  return DIFFICULTIES.find((x) => x.value === d)?.label ?? null;
}

// 25 → "25 min", 70 → "1 hr 10 min"
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// ---- Scaling for a different number of people ----
export function scaleIngredients(ingredients: Ingredient[], factor: number): Ingredient[] {
  if (factor === 1) return ingredients;
  return ingredients.map((ing) => ({
    ...ing,
    quantity: ing.quantity === null ? null : roundAmount(ing.quantity * factor),
  }));
}

// 1.5 → "1 ½", 0.25 → "¼", 2 → "2", 0.4 → "0.4"
const NICE: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

export function niceQuantity(q: number): string {
  const whole = Math.floor(q);
  const part = q - whole;
  if (part < 0.01) return String(whole);
  const frac = NICE.find(([v]) => Math.abs(v - part) < 0.02);
  if (!frac) return String(roundAmount(q));
  return whole > 0 ? `${whole} ${frac[1]}` : frac[1];
}

// "1 ½ cup plain flour" / "2 eggs" / "salt"
export function prettyIngredient(ing: Ingredient): { amount: string | null; name: string } {
  if (ing.quantity === null) return { amount: null, name: ing.name };
  const unit = ing.unit && ing.quantity > 1 && ing.unit === "cup" ? "cups" : ing.unit;
  return { amount: [niceQuantity(ing.quantity), unit].filter(Boolean).join(" "), name: ing.name };
}

// ---- Calories per serve (an estimate from the common foods list) ----

// How many grams (or ml) one recipe line is, if we can tell
function gramsFor(
  ing: Ingredient,
): { grams: number; food: NonNullable<ReturnType<typeof bestFoodMatch>> } | null {
  if (ing.quantity === null) return null;
  const food = bestFoodMatch(ing.name, "pantry");
  if (!food) return null;
  const q = ing.quantity;
  // What one cup of this food weighs: from its typical serve if that's in cups
  const cup = cupWeight(food);
  const perUnit: Record<string, number | null> = {
    g: 1,
    kg: 1000,
    ml: 1,
    L: 1000,
    tsp: 5,
    tbsp: 15,
    cup,
    can: food.portion?.label.includes("can") ? food.portion.amount : 400,
    clove: food.each ?? 3,
    pinch: 0,
  };
  const unit = ing.unit ?? "each";
  const factor =
    unit === "each" ? (food.each ?? food.portion?.amount ?? null) : (perUnit[unit] ?? null);
  return factor === null ? null : { grams: q * factor, food };
}

function cupWeight(food: NonNullable<ReturnType<typeof bestFoodMatch>>): number {
  const label = food.portion?.label ?? "";
  if (label.includes("cup")) {
    if (label.startsWith("½")) return food.portion!.amount * 2;
    if (label.startsWith("¼")) return food.portion!.amount * 4;
    if (label.startsWith("1 cup")) return food.portion!.amount;
  }
  return food.basis === "ml" ? 250 : 125; // e.g. a cup of flour or grated cheese
}

export type RecipeNutrition = {
  perServe: Macros;
  counted: number; // ingredient lines we could work out
  total: number; // ingredient lines that have an amount (staples and "some bread" don't count)
};

// null if we can't work out enough of it to be useful (under half the ingredients)
export function estimateRecipeNutrition(
  ingredients: Ingredient[],
  servings: number | null,
): RecipeNutrition | null {
  const lines = ingredients.filter((i) => !isStaple(i) && i.quantity !== null);
  if (lines.length === 0) return null;
  const sum: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let counted = 0;
  for (const ing of lines) {
    const g = gramsFor(ing);
    if (!g) continue;
    counted += 1;
    const f = g.grams / 100;
    sum.kcal += g.food.kcal * f;
    sum.protein += g.food.protein * f;
    sum.carbs += g.food.carbs * f;
    sum.fat += g.food.fat * f;
  }
  if (counted / lines.length < 0.5) return null;
  const s = servings && servings > 0 ? servings : 1;
  return {
    perServe: {
      kcal: Math.round(sum.kcal / s),
      protein: Math.round(sum.protein / s),
      carbs: Math.round(sum.carbs / s),
      fat: Math.round(sum.fat / s),
    },
    counted,
    total: lines.length,
  };
}

export function kcalLabel(n: RecipeNutrition | null): string | null {
  return n ? `~${formatKcal(n.perServe.kcal)} kcal` : null;
}
