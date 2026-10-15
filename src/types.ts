import type { Aisle } from "@/utils/aisles";

export type Location = "pantry" | "fridge" | "freezer";

// What shape to draw on the item's detail screen.
// "countable" = things you count (eggs, cans) instead of pour or scoop.
// "plain": no particular shape, just a simple bar. "countable": pieces you count.
export type ContainerType =
  "plain" | "bottle" | "carton" | "jar" | "bag" | "box" | "can" | "tub" | "packet" | "countable";

export type Item = {
  id: string;
  name: string;
  quantity: number; // how much is left, e.g. 380
  capacity: number; // how much a full one holds, e.g. 1000 (same unit as quantity)
  unit: string; // "pcs", "g", "ml", "L"...
  container: ContainerType;
  location: Location;
  expiry: string | null; // "2026-10-12", or null if none
  barcode?: string | null; // the barcode it was scanned from, if any ("?" = optional)
  nutrition?: Nutrition | null; // calories etc., if known (see utils/nutrition.ts)
  // Its type (Spices & herbs, Meat…) if someone picked one. null = worked out from the
  // name (see typeOf in utils/aisles.ts)
  category?: Aisle | null;
};

// Nutrition for a pantry item. Per 100 g / 100 ml for things you weigh or pour,
// per 1 item for things you count. (nutritionBasis() in utils/nutrition.ts says which.)
export type Nutrition = {
  kcal: number;
  protein: number | null; // grams; null = not known
  carbs: number | null;
  fat: number | null;
};
