import { memo } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";

import { FOOD_ART, FOOD_ART_SIZE, type FoodArtName } from "@/data/foodArt";
import { colors } from "@/theme";
import type { ContainerType, Location } from "@/types";
import { artForName, pickArt } from "@/utils/foodArt";

export { artForName, pickArt }; // so screens can keep importing them from here

// ---------------------------------------------------------------------------
// Colour food drawings (Google's Noto emoji art, see data/foodArt.ts), picked
// from an item's name: "Anchor Blue Milk" → a glass of milk, "Free range eggs" → an egg.
// ---------------------------------------------------------------------------

// The drawing on its own, at any size. memo(): only redraws when the props change,
// which matters in long lists (SVG drawings are slower to draw than text).
export const FoodArt = memo(function FoodArt({ art, size }: { art: FoodArtName; size: number }) {
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FOOD_ART_SIZE} ${FOOD_ART_SIZE}">${FOOD_ART[art]}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
});

// The tile colour by where it lives: pale blue fridge, icy freezer, wheat pantry
const TILE: Record<Location, string> = {
  fridge: colors.tileFridge,
  freezer: colors.tileFreezer,
  pantry: colors.tilePantry,
};

// A rounded tile with a food drawing on it, e.g. a glass of milk on pale blue
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
      <FoodArt art={pickArt(name, container, location)} size={size * 0.64} />
    </View>
  );
}
