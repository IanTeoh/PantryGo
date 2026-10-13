import type { FoodArtName } from "@/data/foodArt";
import { artForName } from "@/utils/foodArt";

// ---------------------------------------------------------------------------
// Supermarket aisles, so the shopping list reads in the order you walk the shop.
// Worked out from the same words that pick an item's food drawing.
// ---------------------------------------------------------------------------

export type Aisle =
  "produce" | "bakery" | "dairy" | "meat" | "pantry" | "frozen" | "drinks" | "snacks" | "other";

// In walking order (roughly how NZ supermarkets are laid out)
export const AISLES: { key: Aisle; label: string }[] = [
  { key: "produce", label: "Fruit & veg" },
  { key: "bakery", label: "Bakery" },
  { key: "meat", label: "Meat & seafood" },
  { key: "dairy", label: "Dairy & eggs" },
  { key: "pantry", label: "Pantry" },
  { key: "snacks", label: "Snacks & treats" },
  { key: "drinks", label: "Drinks" },
  { key: "frozen", label: "Frozen" },
  { key: "other", label: "Everything else" },
];

const BY_ART: Partial<Record<FoodArtName, Aisle>> = {};
const put = (aisle: Aisle, arts: FoodArtName[]) => arts.forEach((a) => (BY_ART[a] = aisle));

put("produce", [
  "leafy-green",
  "green-salad",
  "broccoli",
  "herb",
  "cucumber",
  "bell-pepper",
  "hot-pepper",
  "carrot",
  "roasted-sweet-potato",
  "potato",
  "onion",
  "garlic",
  "ginger-root",
  "mushroom",
  "ear-of-corn",
  "pea-pod",
  "avocado",
  "tomato",
  "red-apple",
  "banana",
  "lemon",
  "tangerine",
  "kiwi-fruit",
  "strawberry",
  "blueberries",
  "grapes",
  "cherries",
  "peach",
  "pear",
  "watermelon",
  "melon",
  "mango",
  "pineapple",
  "coconut",
]);
put("bakery", [
  "bread",
  "baguette-bread",
  "croissant",
  "bagel",
  "flatbread",
  "birthday-cake",
  "doughnut",
]);
put("meat", [
  "poultry-leg",
  "bacon",
  "hot-dog",
  "cut-of-meat",
  "shrimp",
  "crab",
  "oyster",
  "squid",
  "fish",
]);
put("dairy", ["egg", "cheese-wedge", "butter", "custard", "glass-of-milk"]);
put("pantry", [
  "canned-food",
  "bowl-with-spoon",
  "steaming-bowl",
  "spaghetti",
  "cooked-rice",
  "curry-rice",
  "beans",
  "honey-pot",
  "olive",
  "salt",
  "jar",
  "peanuts",
  "pancakes",
]);
put("snacks", ["chocolate-bar", "cookie", "popcorn", "french-fries", "candy"]);
put("drinks", [
  "beverage-box",
  "cup-with-straw",
  "wine-glass",
  "beer-mug",
  "hot-beverage",
  "teacup-without-handle",
]);
put("frozen", ["ice-cream", "ice"]);

export function aisleFor(name: string): Aisle {
  if (/\bfrozen\b/i.test(name)) return "frozen"; // "frozen peas" goes with the frozen things
  const art = artForName(name);
  return (art && BY_ART[art]) || "other";
}

// Split a list into aisles, in walking order, leaving out empty ones
export function groupByAisle<T>(rows: T[], nameOf: (row: T) => string) {
  return AISLES.map((a) => ({
    ...a,
    rows: rows.filter((r) => aisleFor(nameOf(r)) === a.key),
  })).filter((g) => g.rows.length > 0);
}
