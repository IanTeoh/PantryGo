import { Storage } from "expo-sqlite/kv-store";
import { Appearance } from "react-native";

// PantryGo's "Greenhouse" look. One place for every colour, font and size.
// Screens import these instead of typing raw values.

// ---------------------------------------------------------------------------
// Colours: a light and a dark palette with exactly the same names
// ---------------------------------------------------------------------------
const light = {
  background: "#F3F6F2", // mint-tinted page background
  surface: "#FFFFFF", // cards, list rows, inputs
  card: "#E6EFE7", // soft sage: pills, hero blocks, chips
  border: "#DCE5DD", // dividers and outlines

  text: "#15302A", // main text (deep green-black)
  textSoft: "#5B6F67", // secondary text

  primary: "#1E5C45", // forest green: buttons, active things
  primaryBright: "#2F8F5B", // leaf green: progress bars, ticks
  primarySoft: "#DCEBE1", // pale green: active tab, soft buttons
  onPrimary: "#FFFFFF", // text and icons on top of primary

  hero: "#1E5C45", // the big card on Home
  onHero: "#FFFFFF",
  onHeroSoft: "#A9D9BD",

  // Freshness: dots, labels, expiry text
  fresh: "#2F8F5B",
  soon: "#A86E10", // honey (dark enough to read as text)
  soonBg: "#F6E3BF",
  urgent: "#C4472F", // tomato
  urgentBg: "#F8D9D2",

  // Food icon tiles, coloured by where things live
  tileFridge: "#E3EEF6",
  iconFridge: "#2D6A8F",
  tileFreezer: "#E2F0F3",
  iconFreezer: "#3E7F96",
  tilePantry: "#F4ECDD",
  iconPantry: "#8A6A2E",

  // The "liquid" inside the container gauge
  fill: "#9CC5A8",
  fillLow: "#E8B66B",

  // Insights charts (checked for colour-blind readability)
  chartUsed: "#4E9A63",
  chartWasted: "#C2410C",

  white: "#FFFFFF", // only for things that are always white (e.g. over the camera)
};

// Same names, dark values. Not just "inverted": each was picked to read well on the dark ground.
const dark: Palette = {
  background: "#0F1A16",
  surface: "#17241F",
  card: "#1F302A",
  border: "#2A3B34",

  text: "#E6EFE9",
  textSoft: "#93A79E",

  primary: "#7FD1A3", // mint
  primaryBright: "#7FD1A3",
  primarySoft: "#1F3A2F",
  onPrimary: "#0F1A16",

  hero: "#1F3A2F",
  onHero: "#E6EFE9",
  onHeroSoft: "#93C9AA",

  fresh: "#6CC48C",
  soon: "#E8B45A",
  soonBg: "#3A2C12",
  urgent: "#F08A72",
  urgentBg: "#3D1F19",

  tileFridge: "#1C2E3A",
  iconFridge: "#8EC1E0",
  tileFreezer: "#1A3036",
  iconFreezer: "#8FCBDB",
  tilePantry: "#2E2717",
  iconPantry: "#E0C48A",

  fill: "#3F7A5C",
  fillLow: "#A9792E",

  chartUsed: "#6CC48C",
  chartWasted: "#F08A72",

  white: "#FFFFFF",
};

// Every palette must have every colour name the light one has
type Palette = Record<keyof typeof light, string>;

// ---------------------------------------------------------------------------
// Which palette to use
// ---------------------------------------------------------------------------
// The choice from Profile → Appearance. Light unless you pick dark.
export type ThemeChoice = "light" | "dark";
const THEME_KEY = "pantrygo.theme";

// Read the saved choice *synchronously* (getItemSync, not await). This file runs before any
// screen builds its StyleSheet, so the colours must be known straight away.
function readChoice(): ThemeChoice {
  try {
    const saved = Storage.getItemSync(THEME_KEY);
    return saved === "dark" ? "dark" : "light"; // (an old "system" choice becomes light)
  } catch {
    return "light"; // storage unavailable
  }
}

export const themeChoice: ThemeChoice = readChoice();

// Tell React Native too, so built-in things (keyboard, alerts, pickers) match the app
// rather than the phone's own setting.
Appearance.setColorScheme(themeChoice);

// Saves the choice for next launch. (Account reloads the app straight after, because every
// StyleSheet was built with the old colours when its file first loaded.)
export function saveThemeChoice(choice: ThemeChoice) {
  try {
    Storage.setItemSync(THEME_KEY, choice);
  } catch {
    // couldn't save (rare): the app stays light
  }
}

export const isDark = themeChoice === "dark";
export const colors: Palette = isDark ? dark : light;

// ---------------------------------------------------------------------------
// Fonts: loaded in src/app/_layout.tsx
// Use the bold *font* for bold text, never fontWeight (it breaks custom fonts on Android).
// ---------------------------------------------------------------------------
export const fonts = {
  heading: "BricolageGrotesque_700Bold", // titles and big numbers
  body: "Figtree_400Regular",
  bodyMedium: "Figtree_500Medium",
  bodySemi: "Figtree_600SemiBold",
  bodyBold: "Figtree_700Bold",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

// tiles 14 · cards 20 · hero 28 · pill buttons
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

// ---------------------------------------------------------------------------
// Tints: soft, warm accent colours for tiles and buttons (quick actions,
// section icons). `bg` is the tile, `icon` is a stronger circle on it.
// Icons on `icon` use colors.onPrimary (white in light mode, ink in dark mode).
// ---------------------------------------------------------------------------
export type Tint = { bg: string; icon: string };

const lightTints = {
  mint: { bg: "#DDEFE3", icon: "#2F8F5B" },
  sky: { bg: "#DCEBF5", icon: "#2D6A8F" },
  honey: { bg: "#F7E7C4", icon: "#B57A12" },
  coral: { bg: "#F9DED6", icon: "#C9553C" },
  plum: { bg: "#ECE1F0", icon: "#7E4F93" },
};

const darkTints: Record<keyof typeof lightTints, Tint> = {
  mint: { bg: "#1D3529", icon: "#6CC48C" },
  sky: { bg: "#192C38", icon: "#7DB4D8" },
  honey: { bg: "#382C14", icon: "#E2B154" },
  coral: { bg: "#3A231D", icon: "#EE8F78" },
  plum: { bg: "#2E2434", icon: "#C49AD6" },
};

export const tints: Record<keyof typeof lightTints, Tint> = isDark ? darkTints : lightTints;

// The two ends of the gradient on the big green "hero" cards
export const heroGradient: [string, string] = isDark
  ? ["#1C3A2E", "#2A5443"]
  : ["#174D3A", "#2E8A5F"];

// ---------------------------------------------------------------------------
// Macro colours, the same everywhere: protein coral, carbs honey, fat sky.
// `onHero` = brighter versions for the dark green cards.
// ---------------------------------------------------------------------------
export const macroColors = {
  protein: tints.coral.icon,
  carbs: tints.honey.icon,
  fat: tints.sky.icon,
} as const;
export const macroColorsOnHero = { protein: "#FFB49E", carbs: "#F5D27A", fat: "#9CCBEA" } as const;
export const macroSoft = {
  protein: tints.coral.bg,
  carbs: tints.honey.bg,
  fat: tints.sky.bg,
} as const;
