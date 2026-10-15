import { FOOD_ART, type FoodArtName } from "@/data/foodArt";
import type { tints } from "@/theme";

// ---------------------------------------------------------------------------
// Ready-made profile pictures: a food drawing on one of the app's soft colours,
// for people who'd rather not use a photo. Saved like "art:avocado:mint", in the
// same place a photo's path would go, so housemates see it the same way.
// ---------------------------------------------------------------------------

export type AvatarTint = keyof typeof tints;

export const AVATAR_TINTS: AvatarTint[] = ["mint", "honey", "sky", "coral", "plum"];

export const AVATAR_ART: FoodArtName[] = [
  "avocado",
  "carrot",
  "strawberry",
  "banana",
  "broccoli",
  "tomato",
  "lemon",
  "watermelon",
  "pineapple",
  "mushroom",
  "peach",
  "cherries",
  "grapes",
  "eggplant",
  "croissant",
  "bagel",
  "pretzel",
  "cheese-wedge",
  "egg",
  "pizza",
  "taco",
  "hamburger",
  "doughnut",
  "cupcake",
  "cookie",
  "shortcake",
  "honey-pot",
  "hot-beverage",
];

export function makeDrawnAvatar(art: FoodArtName, tint: AvatarTint): string {
  return `art:${art}:${tint}`;
}

// "art:avocado:mint" → { art: "avocado", tint: "mint" }; anything else → null
export function readDrawnAvatar(
  value: string | null | undefined,
): { art: FoodArtName; tint: AvatarTint } | null {
  if (!value?.startsWith("art:")) return null;
  const [, art, tint] = value.split(":");
  if (!(art in FOOD_ART)) return null;
  return {
    art: art as FoodArtName,
    tint: AVATAR_TINTS.includes(tint as AvatarTint) ? (tint as AvatarTint) : "mint",
  };
}

// A photo you uploaded (a file of yours we can delete), not a drawing or a Google link
export function isUploadedAvatar(value: string | null | undefined): value is string {
  return !!value && !value.startsWith("art:") && !/^https?:/.test(value);
}
