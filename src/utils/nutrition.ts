import type { Nutrition } from "@/types";

// ---------------------------------------------------------------------------
// The maths behind calorie tracking. No React here: plain functions that take
// numbers and give numbers back, so they're easy to test.
// ---------------------------------------------------------------------------

// What a logged food adds up to. Unknown macros count as 0 in totals.
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

// Which way an item's nutrition is written, based on its unit:
//   g / kg / ml / L → "per 100 g" or "per 100 ml" (like the label on the pack)
//   anything else  → "per item" (one egg, one can…)
export type Basis =
  { kind: "per100"; base: "g" | "ml"; label: string } | { kind: "each"; label: string };

export function nutritionBasis(unit: string): Basis {
  if (unit === "g" || unit === "kg") return { kind: "per100", base: "g", label: "per 100 g" };
  if (unit === "ml" || unit === "L") return { kind: "per100", base: "ml", label: "per 100 ml" };
  const one = unit === "pcs" ? "item" : unit; // "per item", "per can", "per jar"…
  return { kind: "each", label: `per ${one}` };
}

// 0.5 kg → 500 g, 0.25 L → 250 ml. Other units stay as they are.
function toBase(amount: number, unit: string): number {
  if (unit === "kg" || unit === "L") return amount * 1000;
  return amount;
}

// How much `amount` of an item adds up to.
// e.g. 200 ml of milk at 64 kcal per 100 ml → 128 kcal.
export function nutritionFor(n: Nutrition, amount: number, unit: string): Macros {
  const basis = nutritionBasis(unit);
  const factor = basis.kind === "per100" ? toBase(amount, unit) / 100 : amount;
  return {
    kcal: round1(n.kcal * factor),
    protein: round1((n.protein ?? 0) * factor),
    carbs: round1((n.carbs ?? 0) * factor),
    fat: round1((n.fat ?? 0) * factor),
  };
}

// Add up a list of foods (e.g. everything eaten today)
export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (total, m) => ({
      kcal: total.kcal + m.kcal,
      protein: total.protein + m.protein,
      carbs: total.carbs + m.carbs,
      fat: total.fat + m.fat,
    }),
    ZERO,
  );
}

// 1240.4 → "1,240"
export function formatKcal(n: number): string {
  return Math.round(n).toLocaleString("en-NZ");
}

// 12.34 → "12 g", 0.4 → "0.4 g"
export function formatGrams(n: number): string {
  return `${n < 10 ? round1(n) : Math.round(n)} g`;
}

// How full a progress bar should be: 0 to 1. No goal → null (show no bar).
export function progress(value: number, goal: number | null): number | null {
  if (!goal || goal <= 0) return null;
  return Math.min(1, value / goal);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Turning the four text boxes on a form into Nutrition (or null if left empty)
// ---------------------------------------------------------------------------
export type NutritionText = { kcal: string; protein: string; carbs: string; fat: string };

export const EMPTY_NUTRITION_TEXT: NutritionText = { kcal: "", protein: "", carbs: "", fat: "" };

export function nutritionToText(n: Nutrition | null | undefined): NutritionText {
  if (!n) return EMPTY_NUTRITION_TEXT;
  const t = (v: number | null) => (v === null ? "" : String(v));
  return { kcal: String(n.kcal), protein: t(n.protein), carbs: t(n.carbs), fat: t(n.fat) };
}

// "" → null, "12,5" → 12.5, "abc" → NaN (invalid)
function parse(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

// ok: false when something typed isn't a number, or macros are given without calories
export function parseNutrition(
  text: NutritionText,
): { ok: true; value: Nutrition | null } | { ok: false } {
  const kcal = parse(text.kcal);
  const protein = parse(text.protein);
  const carbs = parse(text.carbs);
  const fat = parse(text.fat);
  if ([kcal, protein, carbs, fat].some((v) => Number.isNaN(v))) return { ok: false };
  if (kcal === null) {
    // Everything blank = "not known". Macros without calories isn't allowed.
    return protein === null && carbs === null && fat === null
      ? { ok: true, value: null }
      : { ok: false };
  }
  return { ok: true, value: { kcal, protein, carbs, fat } };
}
