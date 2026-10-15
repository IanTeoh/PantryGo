import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FoodArt, artForName } from "@/components/FoodIcon";
import type { FoodArtName } from "@/data/foodArt";
import { photoUrl } from "@/lib/photos";
import { isDark } from "@/theme";
import { isStaple, type CoverKey, type Ingredient } from "@/utils/recipes";

// ---------------------------------------------------------------------------
// A recipe's cover: its photo if it has one, otherwise a soft colour with
// drawings of its main ingredients (so every recipe looks good without a photo).
// ---------------------------------------------------------------------------

type CoverColours = { bg: string; fg: string };

const LIGHT: Record<CoverKey, CoverColours> = {
  sage: { bg: "#DCEBDF", fg: "#2F6B4F" },
  tomato: { bg: "#F7DDD4", fg: "#A8432C" },
  honey: { bg: "#F5E7C6", fg: "#8A6213" },
  ocean: { bg: "#D8E8EF", fg: "#2D6A8F" },
  plum: { bg: "#E9DEEC", fg: "#6D4A7A" },
  sand: { bg: "#EEE7DB", fg: "#7A6447" },
};

const DARK: Record<CoverKey, CoverColours> = {
  sage: { bg: "#1F3A2F", fg: "#9FD8B6" },
  tomato: { bg: "#3B231D", fg: "#F0A48F" },
  honey: { bg: "#3A2E15", fg: "#E8C77A" },
  ocean: { bg: "#182C36", fg: "#8EC1E0" },
  plum: { bg: "#2E2333", fg: "#CDB0DA" },
  sand: { bg: "#2F2A21", fg: "#D8C6A6" },
};

export const COVER_KEYS: CoverKey[] = ["sage", "tomato", "honey", "ocean", "plum", "sand"];

export function coverColours(key: CoverKey): CoverColours {
  return (isDark ? DARK : LIGHT)[key] ?? LIGHT.sage;
}

// Up to 3 different drawings, from the ingredients in order. Kept per ingredient list
// (WeakMap: forgotten by itself once that recipe is gone), so lists don't redo it.
const iconsCache = new WeakMap<Ingredient[], FoodArtName[]>();
export function coverIcons(ingredients: Ingredient[]): FoodArtName[] {
  const cached = iconsCache.get(ingredients);
  if (cached) return cached;
  const icons = findIcons(ingredients);
  iconsCache.set(ingredients, icons);
  return icons;
}

function findIcons(ingredients: Ingredient[]): FoodArtName[] {
  const icons: FoodArtName[] = [];
  for (const ing of ingredients) {
    if (isStaple(ing)) continue;
    const icon = artForName(ing.name);
    if (icon && !icons.includes(icon)) icons.push(icon);
    if (icons.length === 3) break;
  }
  return icons.length > 0 ? icons : ["pot-of-food"];
}

export function RecipeCover({
  cover,
  ingredients,
  photo = null,
  height,
  radius = 0,
}: {
  cover: CoverKey;
  ingredients: Ingredient[];
  photo?: string | null;
  height: number;
  radius?: number;
}) {
  const { bg, fg } = coverColours(cover);
  const url = photoUrl(photo);
  // If the photo can't load (offline the first time, or the file's missing),
  // fall back to the drawing rather than leaving a blank colour.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url && url !== failedUrl) {
    return (
      // The colour shows while the photo loads, then it fades in
      <View style={[styles.wrap, { height, backgroundColor: bg, borderRadius: radius }]}>
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
          onError={() => setFailedUrl(url)}
        />
      </View>
    );
  }

  const [main, second, third] = coverIcons(ingredients);
  const big = height * 0.5;
  const small = height * 0.28;

  return (
    <View style={[styles.wrap, { height, backgroundColor: bg, borderRadius: radius }]}>
      {/* Soft shapes in the background */}
      <View
        style={[
          styles.blob,
          {
            width: height * 1.1,
            height: height * 1.1,
            borderRadius: height,
            right: -height * 0.25,
            top: -height * 0.35,
            backgroundColor: fg,
          },
        ]}
      />
      <View
        style={[
          styles.blob,
          {
            width: height * 0.6,
            height: height * 0.6,
            borderRadius: height,
            left: -height * 0.18,
            bottom: -height * 0.28,
            backgroundColor: fg,
          },
        ]}
      />

      {/* The drawings: one big, up to two small, tilted a little */}
      <View style={styles.center}>
        {second && (
          <View
            style={[styles.side, { transform: [{ rotate: "-14deg" }], marginRight: -small * 0.1 }]}
          >
            <FoodArt art={second} size={small} />
          </View>
        )}
        <FoodArt art={main} size={big} />
        {third && (
          <View
            style={[styles.side, { transform: [{ rotate: "12deg" }], marginLeft: -small * 0.1 }]}
          >
            <FoodArt art={third} size={small} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", justifyContent: "center" },
  blob: { position: "absolute", opacity: 0.08 },
  center: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  side: { marginTop: 18 },
});
