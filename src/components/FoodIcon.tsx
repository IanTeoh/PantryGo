import { memo } from "react";
import { View } from "react-native";
import { SvgAst, parse } from "react-native-svg";

import { FOOD_ART, FOOD_ART_SIZE, type FoodArtName } from "@/data/foodArt";
import { useFoodIcons } from "@/state/FoodIconsContext";
import { colors } from "@/theme";
import type { ContainerType, Location } from "@/types";
import { artForName, pickArt } from "@/utils/foodArt";
import { useFoodPictures } from "@/utils/foodPictures";

export { artForName, pickArt }; // so screens can keep importing them from here

// ---------------------------------------------------------------------------
// Colour food drawings (Google's Noto emoji art, see data/foodArt.ts), picked
// from an item's name: "Anchor Blue Milk" → a glass of milk, "Free range eggs" → an egg.
// ---------------------------------------------------------------------------

// Each drawing is read from its SVG text once, the first time it's needed, and kept.
// (Reading SVG text is the slow part: doing it for every row made long lists lag.)
const parsed = new Map<FoodArtName, ReturnType<typeof parse>>();
function drawingFor(art: FoodArtName) {
  let ast = parsed.get(art);
  if (ast === undefined) {
    ast = parse(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FOOD_ART_SIZE} ${FOOD_ART_SIZE}">${FOOD_ART[art]}</svg>`,
    );
    parsed.set(art, ast);
  }
  return ast;
}

// The drawing on its own, at any size. memo(): only redraws when the props change,
// which matters in long lists (SVG drawings are slower to draw than text).
export const FoodArt = memo(function FoodArt({ art, size }: { art: FoodArtName; size: number }) {
  return <SvgAst ast={drawingFor(art)} override={{ width: size, height: size }} />;
});

// The tile colour by where it lives: pale blue fridge, icy freezer, wheat pantry
const TILE: Record<Location, string> = {
  fridge: colors.tileFridge,
  freezer: colors.tileFreezer,
  pantry: colors.tilePantry,
};

// A rounded tile with a food drawing on it, e.g. a glass of milk on pale blue.
// Uses the drawing your household picked for this name if there is one, else a guess.
// Draws nothing at all if food pictures are switched off (Profile → Features).
export function FoodIcon({
  name,
  container,
  location,
  size = 48,
}: {
  name: string;
  container: ContainerType;
  location: Location;
  size?: number;
}) {
  const show = useFoodPictures();
  const { chosenArt } = useFoodIcons();
  if (!show) return null;
  const art = chosenArt(name) ?? pickArt(name, container, location);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: TILE[location],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FoodArt art={art} size={size * 0.64} />
    </View>
  );
}
