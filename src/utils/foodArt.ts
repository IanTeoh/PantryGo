import { FOOD_ART, FOOD_ART_RULES, type FoodArtName } from "@/data/foodArt";
import type { ContainerType, Location } from "@/types";

// Picking a food drawing from a name. Plain functions (no React), so they're easy to test.

// Each rule word becomes a "whole word" pattern, allowing plurals:
// "pea" matches "peas" and "frozen peas" but not "peanut" or "pear".
const PATTERNS: [FoodArtName, RegExp][] = FOOD_ART_RULES.map(([art, words]) => [
  art,
  new RegExp(`\\b(${words.map(escape).join("|")})(e?s)?\\b`, "i"),
]);

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The key a picked drawing is remembered under: "  Firm  Tofu " → "firm tofu".
// Must match the check in supabase/21_food_icons.sql (lower case, 1–80 characters).
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 80);
}

// The drawing a name asks for, or null if no word matches. Answers are remembered,
// because each one tries ~160 word patterns and lists ask about the same names a lot.
const remembered = new Map<string, FoodArtName | null>();
export function artForName(name: string): FoodArtName | null {
  const known = remembered.get(name);
  if (known !== undefined) return known;
  let found: FoodArtName | null = null;
  for (const [art, pattern] of PATTERNS) {
    if (pattern.test(name)) {
      found = art;
      break;
    }
  }
  if (remembered.size > 2000) remembered.clear(); // never grows forever
  remembered.set(name, found);
  return found;
}

// When the name doesn't say: something that looks like the container
const BY_CONTAINER: Record<ContainerType, FoodArtName> = {
  plain: "package",
  bottle: "jar",
  carton: "beverage-box",
  jar: "jar",
  bag: "shopping-bags",
  box: "package",
  can: "canned-food",
  tub: "jar",
  packet: "package",
  countable: "package",
};

export function pickArt(name: string, container: ContainerType, location: Location): FoodArtName {
  return artForName(name) ?? (location === "freezer" ? "snowflake" : BY_CONTAINER[container]);
}

const NOT_FOOD: FoodArtName[] = [
  "roll-of-paper",
  "soap",
  "sponge",
  "lotion-bottle",
  "toothbrush",
  "dog-face",
  "cat-face",
  "baby",
  "jar",
  "canned-food",
  "beverage-box",
  "shopping-bags",
  "package",
  "snowflake",
];

// Every drawing with the words that pick it, for searching in the picker:
// typing "chick" finds the drumstick (from "chicken") as well as anything named so.
export const ALL_ART: { art: FoodArtName; words: string }[] = (() => {
  const words = new Map<FoodArtName, string[]>();
  for (const [art, list] of FOOD_ART_RULES) words.set(art, [...(words.get(art) ?? []), ...list]);
  // Food first; cleaning, pets and the plain containers at the end
  const last = (art: FoodArtName) => (NOT_FOOD.includes(art) ? 1 : 0);
  return (Object.keys(FOOD_ART) as FoodArtName[])
    .sort((x, y) => last(x) - last(y))
    .map((art) => ({
      art,
      words: [art.replace(/-/g, " "), ...(words.get(art) ?? [])].join(" ").toLowerCase(),
    }));
})();
