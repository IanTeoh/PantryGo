import type { ContainerType } from "@/types";

const SMALL_UNITS = ["g", "ml"];
const BIG_UNITS = ["kg", "L"];

// How much one tap of − or + changes an item: 50 g, 0.1 L, or 1 egg.
export function stepFor(unit: string): number {
  if (SMALL_UNITS.includes(unit)) return 50;
  if (BIG_UNITS.includes(unit)) return 0.1;
  return 1;
}

// How finely dragging the gauge snaps: every 10 ml, every 0.05 L, or whole items.
export function dragStepFor(unit: string): number {
  if (SMALL_UNITS.includes(unit)) return 10;
  if (BIG_UNITS.includes(unit)) return 0.05;
  return 1;
}

// Computers store decimals in binary, so 0.1 + 0.2 = 0.30000000000000004.
// Rounding to 2 decimal places hides that.
export function roundAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

// Round to the nearest multiple of `step`: snapTo(387, 10) = 390.
export function snapTo(n: number, step: number): number {
  return roundAmount(Math.round(n / step) * step);
}

// "1500 g" reads better as "1.5 kg", so big amounts switch up by themselves.
// (Things are stored in g and ml; kg and L are only for showing.)
export function formatAmount(n: number, unit: string): string {
  const nice = niceAmount(n, unit);
  return `${nice.value} ${nice.unit}`;
}

export function niceAmount(n: number, unit: string): { value: number; unit: string } {
  if (unit === "g" && n >= 1000) return { value: roundAmount(n / 1000), unit: "kg" };
  if (unit === "ml" && n >= 1000) return { value: roundAmount(n / 1000), unit: "L" };
  return { value: roundAmount(n), unit };
}

// ---- Units on the Add item form ----
// The main choice is just pieces, grams or millilitres. kg and L aren't needed
// (1500 g shows as 1.5 kg anyway). Ways of counting pieces live in More options.
export const MAIN_UNITS = [
  { value: "pcs", label: "pieces" },
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
];
export const COUNT_UNITS = [
  { value: "pcs", label: "pieces" },
  { value: "can", label: "cans" },
  { value: "pack", label: "packs" },
  { value: "jar", label: "jars" },
  { value: "bottle", label: "bottles" },
];

// A list of unit chips, plus the item's own unit if it isn't in the list
// (older items in kg or L, or a shopping entry counted in cans), so it isn't lost
export function unitChips(
  options: { value: string; label: string }[],
  current: string,
): { value: string; label: string }[] {
  return options.some((o) => o.value === current)
    ? options
    : [...options, { value: current, label: current }];
}

// Everything, for the Edit item page (which shows all the options at once)
export const ALL_UNITS = [...MAIN_UNITS, ...COUNT_UNITS.slice(1)];

export function isMeasured(unit: string): boolean {
  return ["g", "kg", "ml", "L"].includes(unit);
}

// Which main chip a unit lights up: "can" → pieces, "kg" → g (older items)
export function mainUnitOf(unit: string): string {
  if (unit === "g" || unit === "kg") return "g";
  if (unit === "ml" || unit === "L") return "ml";
  return "pcs";
}

// ---- Shapes ----
// Words in a food's name → the shape it usually comes in. First match wins, so the
// more specific ones go first ("coconut milk" is a can, "milk" a carton).
const SHAPE_RULES: [ContainerType, string[]][] = [
  ["carton", ["chocolate milk", "iced coffee"]],
  ["packet", ["chocolate", "milk chocolate"]],
  [
    "can",
    [
      "tinned",
      "canned",
      "can of",
      "coconut milk",
      "coconut cream",
      "baked beans",
      "chickpeas",
      "kidney beans",
      "black beans",
      "cannellini",
      "tuna",
      "sardines",
      "corned beef",
      "spaghetti hoops",
      "condensed milk",
      "evaporated milk",
    ],
  ],
  [
    "jar",
    [
      "jam",
      "honey",
      "peanut butter",
      "nutella",
      "vegemite",
      "marmite",
      "mayo",
      "mayonnaise",
      "mustard",
      "pesto",
      "pickles",
      "gherkins",
      "olives",
      "curry paste",
      "tomato paste",
      "salsa",
      "chutney",
      "relish",
      "pasta sauce",
      "marmalade",
      "tahini",
      "capers",
      "spread",
      "instant coffee",
    ],
  ],
  [
    "tub",
    [
      "yoghurt",
      "yogurt",
      "ice cream",
      "gelato",
      "margarine",
      "cream cheese",
      "sour cream",
      "hummus",
      "cottage cheese",
      "ricotta",
      "mascarpone",
      "dip",
      "custard",
    ],
  ],
  [
    "carton",
    [
      "milk",
      "cream",
      "juice",
      "stock",
      "broth",
      "oat milk",
      "soy milk",
      "almond milk",
      "coconut water",
      "passata",
      "eggnog",
    ],
  ],
  [
    "bottle",
    [
      "oil",
      "sauce",
      "vinegar",
      "wine",
      "beer",
      "cider",
      "soda",
      "water",
      "syrup",
      "dressing",
      "ketchup",
      "sriracha",
      "mirin",
      "kombucha",
      "lemonade",
      "cordial",
      "spirits",
      "vodka",
      "gin",
      "rum",
      "whisky",
    ],
  ],
  [
    "bag",
    [
      "rice",
      "flour",
      "sugar",
      "pasta",
      "spaghetti",
      "penne",
      "oats",
      "lentils",
      "quinoa",
      "couscous",
      "chips",
      "crisps",
      "frozen peas",
      "frozen vegetables",
      "frozen veg",
      "frozen berries",
      "potatoes",
      "coffee beans",
      "ground coffee",
      "nuts",
      "almonds",
      "walnuts",
      "cashews",
      "seeds",
      "polenta",
      "breadcrumbs",
      "salad mix",
      "spinach",
      "popcorn",
      "lollies",
    ],
  ],
  [
    "box",
    [
      "cereal",
      "cornflakes",
      "weet-bix",
      "weetbix",
      "muesli",
      "granola",
      "tea bags",
      "teabags",
      "crackers",
      "cake mix",
      "baking soda",
      "lasagne sheets",
    ],
  ],
  [
    "packet",
    [
      "biscuits",
      "cookies",
      "noodles",
      "ramen",
      "yeast",
      "gravy",
      "seasoning",
      "taco",
      "jelly",
      "instant",
      "sachet",
    ],
  ],
];
const SHAPE_PATTERNS: [ContainerType, RegExp][] = SHAPE_RULES.map(([shape, words]) => [
  shape,
  new RegExp(`\\b(${words.join("|")})(e?s)?\\b`, "i"),
]);

// The shape for a new item. Counted things are pieces. Measured things get the
// shape their name suggests, or just a simple bar if nothing fits.
export function guessContainer(unit: string, name = ""): ContainerType {
  if (!isMeasured(unit)) return "countable";
  for (const [shape, pattern] of SHAPE_PATTERNS) {
    if (pattern.test(name)) return shape;
  }
  return "plain";
}

export const CONTAINER_OPTIONS: { value: ContainerType; label: string }[] = [
  { value: "plain", label: "Simple bar" },
  { value: "bottle", label: "Bottle" },
  { value: "carton", label: "Carton" },
  { value: "jar", label: "Jar" },
  { value: "bag", label: "Bag" },
  { value: "box", label: "Box" },
  { value: "can", label: "Can" },
  { value: "tub", label: "Tub" },
  { value: "packet", label: "Packet" },
  { value: "countable", label: "Count them" },
];

// The "quick pour" buttons on an item's page: everyday amounts for its unit.
// e.g. oil in ml → "− 1 tbsp" (15 ml), "− ¼ cup" (60 ml), "+ 50 ml"
export function quickSteps(unit: string): { label: string; delta: number }[] {
  switch (unit) {
    case "ml":
      return [
        { label: "− 1 tbsp", delta: -15 },
        { label: "− ¼ cup", delta: -60 },
        { label: "+ 50 ml", delta: 50 },
      ];
    case "L":
      return [
        { label: "− 1 cup", delta: -0.25 },
        { label: "− 100 ml", delta: -0.1 },
        { label: "+ 250 ml", delta: 0.25 },
      ];
    case "g":
      return [
        { label: "− 50 g", delta: -50 },
        { label: "− 100 g", delta: -100 },
        { label: "+ 50 g", delta: 50 },
      ];
    case "kg":
      return [
        { label: "− 100 g", delta: -0.1 },
        { label: "− 250 g", delta: -0.25 },
        { label: "+ 250 g", delta: 0.25 },
      ];
    default:
      return [
        { label: "− 1", delta: -1 },
        { label: "+ 1", delta: 1 },
      ];
  }
}
