import type { FoodArtName } from "@/data/foodArt";
import { artForName } from "@/utils/foodArt";

// ---------------------------------------------------------------------------
// Supermarket aisles, so the shopping list reads in the order you walk the shop.
// Worked out from the same words that pick an item's food drawing.
// ---------------------------------------------------------------------------

export type Aisle =
  | "produce"
  | "bakery"
  | "meat"
  | "dairy"
  | "dry"
  | "spices"
  | "sauces"
  | "snacks"
  | "drinks"
  | "frozen"
  | "other";

// In walking order (roughly how NZ supermarkets are laid out). The pantry page
// uses the same groups as "types", so you can see all your spices at once.
export const AISLES: { key: Aisle; label: string }[] = [
  { key: "produce", label: "Fruit & veg" },
  { key: "bakery", label: "Bakery" },
  { key: "meat", label: "Meat & seafood" },
  { key: "dairy", label: "Dairy & eggs" },
  { key: "dry", label: "Dry goods & tins" },
  { key: "spices", label: "Spices & herbs" },
  { key: "sauces", label: "Sauces, oils & spreads" },
  { key: "snacks", label: "Snacks & treats" },
  { key: "drinks", label: "Drinks" },
  { key: "frozen", label: "Frozen" },
  { key: "other", label: "Others" },
];

export const isAisle = (v: unknown): v is Aisle => AISLES.some((a) => a.key === v);
export const aisleLabel = (key: Aisle) => AISLES.find((a) => a.key === key)?.label ?? "";

// Words that decide it before the drawing does (spices and sauces share the jar drawing,
// and "fish sauce" isn't fish)
const SPICES =
  /\b(salt|spices?|paprika|cumin|seasoning|curry powder|cinnamon|turmeric|nutmeg|cloves|cardamom|garam masala|five spice|allspice|(black|white|ground|cracked) pepper|peppercorns?|ground (ginger|coriander|cinnamon|nutmeg|cloves|turmeric|cumin|allspice|cardamom)|cayenne|chill?i (flakes|powder)|oregano|bay lea(f|ves)|mixed herbs|italian herbs|dried (herbs?|basil|parsley|thyme|rosemary|sage|mint|dill|chill?i|coriander)|stock (powder|cubes?)|bouillon|(garlic|onion|ginger) (powder|granules)|(mustard|sesame|fennel|coriander|cumin|chia|poppy) seeds?|caraway|star anise|sumac|za'?atar|dukkah|vanilla|baking (powder|soda)|bicarb(onate)?( soda)?|yeast)\b/i;
const DRY = /\b(sugar|coconut (milk|cream)|cocoa|custard powder|gelatine|cornstarch)\b/i;
const SAUCES =
  /\b(sauces?|ketchup|mayo(nnaise)?|mustard|chutney|relish|vinegar|dressing|aioli|pesto|sriracha|hoisin|tahini|paste|salsa|gravy|marmite|vegemite|peanut butter|jam|honey|syrup|spreads?|oils?)\b/i;

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
  "eggplant",
  "root-vegetable",
  "seedling",
  "green-apple",
  "lime",
]);
put("bakery", [
  "bread",
  "baguette-bread",
  "croissant",
  "bagel",
  "flatbread",
  "birthday-cake",
  "doughnut",
  "cupcake",
  "shortcake",
  "moon-cake",
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
  "meat-on-bone",
  "fried-shrimp",
  "lobster",
  "octopus",
  "fish-cake-with-swirl",
]);
put("dairy", ["egg", "cheese-wedge", "butter", "custard", "glass-of-milk"]);
put("dry", [
  "canned-food",
  "bowl-with-spoon",
  "steaming-bowl",
  "spaghetti",
  "cooked-rice",
  "curry-rice",
  "beans",
  "peanuts",
  "chestnut",
  "pancakes",
  "waffle",
  "sheaf-of-rice",
]);
put("spices", ["salt"]);
put("sauces", ["jar", "honey-pot", "maple-leaf", "olive"]);
put("snacks", [
  "chocolate-bar",
  "cookie",
  "popcorn",
  "french-fries",
  "candy",
  "lollipop",
  "dango",
  "fortune-cookie",
  "rice-cracker",
  "pretzel",
]);
put("drinks", [
  "beverage-box",
  "cup-with-straw",
  "wine-glass",
  "beer-mug",
  "hot-beverage",
  "teacup-without-handle",
  "bubble-tea",
  "tumbler-glass",
  "cocktail-glass",
  "bottle-with-popping-cork",
  "sake",
  "teapot",
]);
put("frozen", ["ice-cream", "ice", "soft-ice-cream", "shaved-ice"]);

export function aisleFor(name: string): Aisle {
  if (/\bfrozen\b/i.test(name)) return "frozen"; // "frozen peas" goes with the frozen things
  if (SPICES.test(name)) return "spices";
  if (SAUCES.test(name)) return "sauces";
  if (DRY.test(name)) return "dry";
  const art = artForName(name);
  return (art && BY_ART[art]) || "other";
}

// An item's type: the one picked on its Edit page, or worked out from its name
export function typeOf(item: { name: string; category?: Aisle | null }): Aisle {
  return item.category ?? aisleFor(item.name);
}

// Split a list into aisles, in walking order, leaving out empty ones
export function groupByAisle<T>(rows: T[], nameOf: (row: T) => string) {
  return AISLES.map((a) => ({
    ...a,
    rows: rows.filter((r) => aisleFor(nameOf(r)) === a.key),
  })).filter((g) => g.rows.length > 0);
}
