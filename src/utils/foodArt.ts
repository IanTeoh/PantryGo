import { FOOD_ART_RULES, type FoodArtName } from "@/data/foodArt";
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

// The drawing a name asks for, or null if no word matches
export function artForName(name: string): FoodArtName | null {
  for (const [art, pattern] of PATTERNS) {
    if (pattern.test(name)) return art;
  }
  return null;
}

// When the name doesn't say: something that looks like the container
const BY_CONTAINER: Record<ContainerType, FoodArtName> = {
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
