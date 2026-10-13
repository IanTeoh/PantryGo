import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type ReactNode } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { RecipeCover } from "@/components/RecipeCover";
import { usePantry } from "@/state/PantryContext";
import { useShopping } from "@/state/ShoppingContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { success, tick } from "@/utils/haptics";
import { formatKcal } from "@/utils/nutrition";
import {
  difficultyLabel,
  estimateRecipeNutrition,
  formatMinutes,
  prettyIngredient,
  scaleIngredients,
  tagLabel,
  cuisineLabel,
} from "@/utils/recipeMeta";
import {
  checkIngredient,
  recipeReadiness,
  type Ingredient,
  type RecipeContent,
} from "@/utils/recipes";
import { formatAmount } from "@/utils/units";

// ---------------------------------------------------------------------------
// The full recipe page. Used for your own recipes (/recipe/[id]) and shared ones
// (/community/[id]); each screen passes in its own buttons as `actions`.
// `actions` is a function: it gets the ingredients scaled to the servings
// chosen here, so "Cooked this" takes out the right amounts.
// ---------------------------------------------------------------------------
export function RecipeView({
  recipe,
  byline,
  sourceUrl,
  actions,
  footnote,
}: {
  recipe: RecipeContent;
  byline?: string | null; // "by PantryGo Kitchen"
  sourceUrl?: string | null;
  actions: (scaled: Ingredient[], serves: number) => ReactNode;
  footnote?: ReactNode; // small print at the bottom (delete, report…)
}) {
  const { items } = usePantry();
  const { list, addToList } = useShopping();

  // How many people you're cooking for. Starts at the recipe's own number.
  const baseServes = recipe.servings ?? 1;
  const [serves, setServes] = useState(baseServes);
  const [addedToList, setAddedToList] = useState(false);

  const ingredients = scaleIngredients(recipe.ingredients, serves / baseServes);
  const ready = recipeReadiness({ ingredients }, items);
  const nutrition = estimateRecipeNutrition(recipe.ingredients, recipe.servings);
  const steps = recipe.steps
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const toBuy = ready.missing.filter(
    (m) =>
      !list.some((r) => !r.done && r.name.trim().toLowerCase() === m.name.trim().toLowerCase()),
  );

  function addMissing() {
    success();
    for (const m of toBuy) addToList({ name: m.name }); // amounts are asked at put-away
    setAddedToList(true);
  }

  function changeServes(by: number) {
    const next = Math.min(50, Math.max(1, serves + by));
    if (next !== serves) tick();
    setServes(next);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RecipeCover
        cover={recipe.cover}
        ingredients={recipe.ingredients}
        photo={recipe.photo}
        height={220}
        radius={28}
      />

      {/* ---- Title ---- */}
      <View style={styles.titleBlock}>
        {(recipe.cuisine || recipe.tags.length > 0) && (
          <Text style={styles.eyebrow}>
            {[cuisineLabel(recipe.cuisine), ...recipe.tags.slice(0, 3).map(tagLabel)]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
        <Text style={styles.title}>{recipe.title}</Text>
        {byline && <Text style={styles.byline}>{byline}</Text>}
        {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}
        {sourceUrl && (
          <Pressable onPress={() => Linking.openURL(sourceUrl)} hitSlop={6}>
            <Text style={styles.link} numberOfLines={1}>
              {sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
            </Text>
          </Pressable>
        )}
      </View>

      {/* ---- Quick facts ---- */}
      <View style={styles.facts}>
        <Fact
          icon="time-outline"
          value={recipe.minutes ? formatMinutes(recipe.minutes) : "–"}
          label="Time"
        />
        <Fact
          icon="people-outline"
          value={recipe.servings ? String(recipe.servings) : "–"}
          label="Serves"
        />
        <Fact
          icon="speedometer-outline"
          value={difficultyLabel(recipe.difficulty) ?? "–"}
          label="Level"
        />
        <Fact
          icon="flame-outline"
          value={nutrition ? `~${formatKcal(nutrition.perServe.kcal)}` : "–"}
          label="kcal / serve"
        />
      </View>

      {/* ---- Pantry check ---- */}
      {ready.total > 0 && (
        <View style={[styles.readyCard, ready.canMake && styles.readyCardGood]}>
          <View style={styles.readyRow}>
            <Ionicons
              name={ready.canMake ? "checkmark-circle" : "basket-outline"}
              size={22}
              color={ready.canMake ? colors.primary : colors.text}
            />
            <Text style={styles.readyText}>
              {ready.canMake
                ? "You have everything for this"
                : `You have ${ready.have} of ${ready.total} ingredients`}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(ready.have / ready.total) * 100}%` }]} />
          </View>
          {ready.missing.length > 0 &&
            (toBuy.length > 0 && !addedToList ? (
              <Pressable onPress={addMissing} style={styles.outlineButton}>
                <Ionicons name="cart-outline" size={18} color={colors.primary} />
                <Text style={styles.outlineButtonText}>
                  Add {toBuy.length} missing to the shopping list
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.muted}>Missing ingredients are on your shopping list.</Text>
            ))}
        </View>
      )}

      {/* ---- Ingredients ---- */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Ingredients</Text>
          {/* Servings: scales every amount below */}
          <View style={styles.stepper}>
            <Pressable onPress={() => changeServes(-1)} hitSlop={8} style={styles.stepperButton}>
              <Ionicons name="remove" size={18} color={colors.primary} />
            </Pressable>
            <Text style={styles.stepperText}>
              {serves} {serves === 1 ? "serve" : "serves"}
            </Text>
            <Pressable onPress={() => changeServes(1)} hitSlop={8} style={styles.stepperButton}>
              <Ionicons name="add" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {ingredients.map((ing, i) => {
          const check = checkIngredient(ing, items);
          const staple = check.status === "staple";
          const ok = staple || (check.status === "have" && check.enough);
          const { amount, name } = prettyIngredient(ing);
          return (
            <View key={i} style={[styles.ingRow, i > 0 && styles.divider]}>
              <View style={[styles.ingDot, ok ? styles.ingDotOk : styles.ingDotMissing]}>
                <Ionicons
                  name={staple ? "ellipse" : ok ? "checkmark" : "add"}
                  size={staple ? 6 : 13}
                  color={ok ? colors.primary : colors.textSoft}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingName}>
                  {amount && <Text style={styles.ingAmount}>{amount} </Text>}
                  {name}
                </Text>
                {check.status === "have" && (
                  <Text style={styles.ingNote}>
                    {check.enough ? "In your pantry" : "Not enough"} · {check.item.name},{" "}
                    {formatAmount(check.item.quantity, check.item.unit)}
                  </Text>
                )}
                {check.status === "missing" && (
                  <Text style={styles.ingNote}>Not in your pantry</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* ---- Method ---- */}
      {steps.length > 0 && (
        <View style={styles.methodBlock}>
          <Text style={styles.sectionTitle}>Method</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ---- Nutrition (estimate) ---- */}
      {nutrition && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nutrition per serve</Text>
          <View style={styles.nutritionRow}>
            <Nutrient value={`~${formatKcal(nutrition.perServe.kcal)}`} label="kcal" />
            <Nutrient value={`${nutrition.perServe.protein} g`} label="Protein" />
            <Nutrient value={`${nutrition.perServe.carbs} g`} label="Carbs" />
            <Nutrient value={`${nutrition.perServe.fat} g`} label="Fat" />
          </View>
          <Text style={styles.muted}>
            A rough estimate from typical values
            {nutrition.counted < nutrition.total
              ? ` for ${nutrition.counted} of ${nutrition.total} ingredients`
              : ""}
            .
          </Text>
        </View>
      )}

      {/* ---- The screen's own buttons ---- */}
      <View style={styles.actions}>{actions(ingredients, serves)}</View>
      {footnote}
    </ScrollView>
  );
}

function Fact({
  icon,
  value,
  label,
}: {
  icon: "time-outline" | "people-outline" | "speedometer-outline" | "flame-outline";
  value: string;
  label: string;
}) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.factValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

function Nutrient({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.nutrient}>
      <Text style={styles.nutrientValue}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

// Shared button styles, so the two screens' actions match
export const recipeButtonStyles = StyleSheet.create({
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  primaryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.onPrimary,
    textAlign: "center",
  },
  soft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
  },
  softText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.primary },
  note: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noteTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  noteText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
  small: { alignItems: "center", padding: spacing.sm },
  smallText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSoft },
  danger: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.urgent },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },

  titleBlock: { gap: 6 },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.primary,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: colors.text,
  },
  byline: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSoft },
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginTop: 4,
  },
  link: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: "underline",
  },

  facts: { flexDirection: "row", gap: spacing.sm },
  fact: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
  },
  factValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  factLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textSoft },

  readyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  readyCardGood: { backgroundColor: colors.primarySoft },
  readyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  readyText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.card, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3, backgroundColor: colors.primaryBright },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
  },
  outlineButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.text },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    padding: 3,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.text,
    minWidth: 58,
    textAlign: "center",
  },

  ingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  ingDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  ingDotOk: { backgroundColor: colors.primarySoft },
  ingDotMissing: { borderWidth: 1.5, borderColor: colors.border },
  ingName: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  ingAmount: { fontFamily: fonts.bodyBold },
  ingNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft, marginTop: 1 },

  methodBlock: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.text, marginBottom: 2 },
  stepCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontFamily: fonts.heading, fontSize: 15, color: colors.onPrimary },
  stepText: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.text },

  nutritionRow: { flexDirection: "row", gap: spacing.sm },
  nutrient: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  nutrientValue: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSoft },

  actions: { gap: spacing.sm },
});
