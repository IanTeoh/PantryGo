import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";

import { RecipeCover } from "@/components/RecipeCover";
import { colors, fonts, radius, spacing } from "@/theme";
import { estimateRecipeNutrition, formatMinutes, kcalLabel } from "@/utils/recipeMeta";
import type { RecipeContent } from "@/utils/recipes";

// One recipe as a card: illustrated cover, title, time and calories, and a footer line.
//   "grid": half the screen wide, in a 2-column grid
//   "wide": a bigger card for horizontal rows ("Most saved")
export function RecipeCard({
  recipe,
  footer,
  badge,
  variant = "grid",
  onPress,
}: {
  recipe: RecipeContent;
  footer?: string | null; // e.g. "by Ian · 12 saves" or "You have 5 of 7"
  badge?: { label: string; tone: "good" | "plain" } | null; // a pill on the cover
  variant?: "grid" | "wide";
  onPress: () => void;
}) {
  const kcal = kcalLabel(estimateRecipeNutrition(recipe.ingredients, recipe.servings));
  const meta = [recipe.minutes ? formatMinutes(recipe.minutes) : null, kcal]
    .filter(Boolean)
    .join(" · ");
  const wide = variant === "wide";

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, wide ? styles.wide : styles.grid]}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
    >
      <View>
        <RecipeCover
          cover={recipe.cover}
          ingredients={recipe.ingredients}
          photo={recipe.photo}
          height={wide ? 150 : 112}
        />
        {badge && (
          <Text style={[styles.badge, badge.tone === "good" && styles.badgeGood]}>
            {badge.label}
          </Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, wide && styles.titleWide]} numberOfLines={2}>
          {recipe.title}
        </Text>
        {meta !== "" && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={colors.textSoft} />
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        )}
        {footer && (
          <Text style={styles.footer} numberOfLines={1}>
            {footer}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" },
  grid: { width: "100%" }, // the grid's wrapper sets the width (two per row)
  wide: { width: 260 },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: "hidden",
  },
  badgeGood: { backgroundColor: colors.primary, color: colors.onPrimary },
  body: { padding: spacing.md, gap: 4 },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19, color: colors.text },
  titleWide: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  footer: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.primary },
});
