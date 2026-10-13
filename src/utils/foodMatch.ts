import { COMMON_FOODS, type CommonFood } from "@/data/commonFoods";
import type { Nutrition } from "@/types";
import type { Macros } from "@/utils/nutrition";
import { nutritionBasis } from "@/utils/nutrition";

// ---------------------------------------------------------------------------
// Matching what someone typed ("Anchor Blue Milk 2L", "chick") to a food in
// data/commonFoods.ts, so the app can estimate calories straight away.
// ---------------------------------------------------------------------------

// Which screen is asking. The pantry wants foods as they're stored (dry rice,
// raw chicken); the "Other food" diary wants them as eaten (cooked rice).
export type MatchContext = "pantry" | "meal";

// "Anchor Blue-Top Milk 2L!" → ["anchor", "blue", "top", "milk"]
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’'`]/g, "") // "Wattie's" → "watties"
    .replace(/[^a-z0-9ā-ūē]+/g, " ") // anything else becomes a space
    .split(" ")
    .filter((w) => w.length > 0 && !/^\d/.test(w)) // drop "2l", "500g", "6"
    .map(singular);
}

// Rough singular, so "tomatoes" matches "tomato" and "berries" matches "berry"
function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (/(ss|us|is)$/.test(word)) return word; // "glass", "hummus", "quinoa"… keep
  if (/(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

// Every way of naming a food, already split into words
type Phrase = string[];
const PHRASES: Map<CommonFood, Phrase[]> = new Map(
  COMMON_FOODS.map((food) => [food, [tokens(food.name), ...food.aliases.map(tokens)]]),
);

// How well the typed words fit one phrase, 0–100
function scorePhrase(query: string[], phrase: Phrase): number {
  if (phrase.length === 0 || query.length === 0) return 0;
  const same = query.length === phrase.length && query.every((w, i) => w === phrase[i]);
  if (same) return 100;

  // Every word of the phrase is in what was typed: "milk" in "anchor blue milk".
  // Longer phrases are more specific, so they score higher ("trim milk" beats "milk").
  if (phrase.every((w) => query.includes(w))) return 70 + 5 * phrase.length;

  // Still typing: every typed word is in the phrase, the last one maybe half-typed
  // ("chick" → "chicken breast")
  const last = query[query.length - 1];
  const done = query.slice(0, -1);
  const typingFits =
    done.every((w) => phrase.includes(w)) &&
    last.length >= 2 &&
    phrase.some((w) => w.startsWith(last));
  if (typingFits) return 55 + 3 * query.length - phrase.length; // shorter = closer

  // Some words in common
  const shared = phrase.filter((w) => query.includes(w)).length;
  const fraction = shared / Math.max(phrase.length, query.length);
  return fraction >= 0.5 ? Math.round(40 * fraction) : 0;
}

// Words people add that aren't the food: "a big bowl of pasta" → "pasta".
// Matching tries with and without them, so "big breakfast" still works.
const FILLER = new Set([
  "a",
  "an",
  "the",
  "of",
  "some",
  "my",
  "from",
  "at",
  "for",
  "bowl",
  "plate",
  "plateful",
  "serve",
  "serving",
  "portion",
  "piece",
  "box",
  "big",
  "small",
  "large",
  "medium",
  "regular",
  "huge",
  "little",
  "half",
  "mini",
  "extra",
  "restaurant",
  "cafe",
  "takeaway",
  "takeout",
  "homemade",
  "home",
  "made",
]);

export type FoodMatch = { food: CommonFood; score: number };

// The best few foods for what's been typed, best first
export function searchFoods(text: string, context: MatchContext, limit = 4): FoodMatch[] {
  const query = tokens(text);
  if (query.length === 0) return [];
  const trimmed = query.filter((w) => !FILLER.has(w));
  const queries = trimmed.length > 0 && trimmed.length < query.length ? [query, trimmed] : [query];
  const results: FoodMatch[] = [];
  for (const [food, phrases] of PHRASES) {
    let score = Math.max(...queries.flatMap((q) => phrases.map((p) => scorePhrase(q, p))));
    if (score === 0) continue;
    if (food.prefer === context) score += 3; // tie-break: dry rice for the pantry, cooked for meals
    if (food.prefer && food.prefer !== context) score -= 3;
    // Logging a meal: a whole dish ("pasta" → a bowl of pasta) beats the plain ingredient
    if (context === "meal" && food.sized) score += 1;
    results.push({ food, score });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// One confident match, or null. "Confident" = the food's whole name or an alias
// appears in what was typed (score 70+), not just a few letters in common.
export function bestFoodMatch(text: string, context: MatchContext): CommonFood | null {
  const [top] = searchFoods(text, context, 1);
  return top && top.score >= 70 ? top.food : null;
}

// ---------------------------------------------------------------------------
// Turning a food into numbers
// ---------------------------------------------------------------------------

// For a pantry item: the food's values written the way the item needs them
// (per 100 g/ml for weighed things, per one for counted things). null if that
// can't be worked out, e.g. "per can" for a food with no typical weight.
export function estimateForItem(
  name: string,
  unit: string,
): { food: CommonFood; nutrition: Nutrition } | null {
  const food = bestFoodMatch(name, "pantry");
  if (!food) return null;
  const basis = nutritionBasis(unit);
  // per 100 g ≈ per 100 ml here: close enough for an estimate
  const factor = basis.kind === "per100" ? 1 : food.each ? food.each / 100 : null;
  if (factor === null) return null;
  return {
    food,
    nutrition: {
      kcal: round1(food.kcal * factor),
      protein: round1(food.protein * factor),
      carbs: round1(food.carbs * factor),
      fat: round1(food.fat * factor),
    },
  };
}

// What `amount` g (or ml) of a food adds up to
export function macrosForAmount(food: CommonFood, amount: number): Macros {
  const factor = amount / 100;
  return {
    kcal: round1(food.kcal * factor),
    protein: round1(food.protein * factor),
    carbs: round1(food.carbs * factor),
    fat: round1(food.fat * factor),
  };
}

// The serving sizes to offer as chips: the typical serve, one of it, and 100 g.
// Dishes get Small / Regular / Large instead.
export type Portion = { label: string; amount: number };

export type Size = "small" | "regular" | "large";
export const SIZE_FACTOR: Record<Size, number> = { small: 0.7, regular: 1, large: 1.4 };
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

export function portionsFor(food: CommonFood): Portion[] {
  const u = food.basis;
  if (food.sized && food.portion) {
    const base = food.portion.amount;
    const small = round5(base * SIZE_FACTOR.small);
    const large = round5(base * SIZE_FACTOR.large);
    return [
      { label: `Small (${small} ${u})`, amount: small },
      { label: `Regular · ${food.portion.label} (${base} ${u})`, amount: base },
      { label: `Large (${large} ${u})`, amount: large },
    ];
  }
  const list: Portion[] = [];
  if (food.portion) {
    list.push({
      label: `${food.portion.label} (${food.portion.amount} ${u})`,
      amount: food.portion.amount,
    });
  }
  if (food.each && food.each !== food.portion?.amount) {
    list.push({ label: `1 (${food.each} ${u})`, amount: food.each });
  }
  if (food.portion?.amount !== 100 && food.each !== 100) {
    list.push({ label: `100 ${u}`, amount: 100 });
  }
  return list;
}

// The amount to start with: the regular serve, or a small/large one if the
// words typed say so ("a big bowl of pasta" → Large). Words that are part of
// the food's own name don't count ("big breakfast" is still Regular).
export function defaultPortion(food: CommonFood, typed = ""): Portion {
  const list = portionsFor(food);
  if (!food.sized || list.length < 3) return list[0];
  const own = new Set([food.name, ...food.aliases].flatMap(tokens));
  const words = tokens(typed).filter((w) => !own.has(w));
  if (words.some((w) => ["small", "little", "half", "mini", "light", "kid"].includes(w)))
    return list[0];
  if (words.some((w) => ["big", "large", "huge", "extra", "double", "massive"].includes(w)))
    return list[2];
  return list[1];
}

// ---------------------------------------------------------------------------
// Your own history: foods you've logged before, matched by name
// ---------------------------------------------------------------------------
type LoggedFood = Macros & { name: string; at: number };

export function searchHistory<T extends LoggedFood>(entries: T[], text: string, limit = 3): T[] {
  const query = tokens(text);
  if (query.length === 0) return [];
  const seen = new Set<string>();
  const matches: T[] = [];
  // newest first, so the most recent version of each food wins
  for (const e of [...entries].sort((a, b) => b.at - a.at)) {
    const key = e.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (scorePhrase(query, tokens(e.name)) >= 55) matches.push(e);
    if (matches.length === limit) break;
  }
  return matches;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
