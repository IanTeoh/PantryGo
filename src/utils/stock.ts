import type { Item, Location } from "@/types";

// Running low: out completely, or a quarter or less left.
export function isLow(item: Item): boolean {
  if (item.quantity <= 0) return true;
  return item.capacity > 0 && item.quantity / item.capacity <= 0.25;
}

// Where a newly bought thing probably goes, from its name. Easy to change afterwards.
const FRIDGE_WORDS = [
  "milk",
  "yoghurt",
  "yogurt",
  "cheese",
  "butter",
  "egg",
  "chicken",
  "beef",
  "pork",
  "lamb",
  "mince",
  "fish",
  "salmon",
  "ham",
  "bacon",
  "sausage",
  "cream",
  "lettuce",
  "spinach",
  "juice",
  "tofu",
  "hummus",
  "feta",
  "mushroom",
  "berries",
];
const FREEZER_WORDS = ["frozen", "ice cream", "ice block"];

export function guessLocation(name: string): Location {
  const n = name.toLowerCase();
  if (FREEZER_WORDS.some((w) => n.includes(w))) return "freezer";
  if (FRIDGE_WORDS.some((w) => n.includes(w))) return "fridge";
  return "pantry";
}

// "Olive Oil " and "olive oil" are the same thing
export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
