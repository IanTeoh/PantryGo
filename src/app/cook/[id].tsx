import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/components/TextInput";
import Animated, { FadeIn } from "react-native-reanimated";

import { FoodIcon } from "@/components/FoodIcon";
import { NutritionFields } from "@/components/NutritionFields";
import { PressableScale } from "@/components/PressableScale";
import { RecipeCover } from "@/components/RecipeCover";
import { useCommunity } from "@/state/CommunityContext";
import { useNutrition } from "@/state/NutritionContext";
import { usePreferences } from "@/state/PreferencesContext";
import { usePantry } from "@/state/PantryContext";
import { useRecipes, type Taken } from "@/state/RecipesContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { success, tick } from "@/utils/haptics";
import { rowEntering } from "@/utils/motion";
import {
  EMPTY_NUTRITION_TEXT,
  formatKcal,
  nutritionToText,
  parseNutrition,
  type NutritionText,
} from "@/utils/nutrition";
import { estimateRecipeNutrition, niceQuantity, scaleIngredients } from "@/utils/recipeMeta";
import { planCook, type RecipeContent } from "@/utils/recipes";
import { formatAmount, roundAmount } from "@/utils/units";

// After cooking a recipe (/cook/abc?serves=4), or "I ate this" (?mode=eat).
//   1. How much came out of the pantry: each line starts at the recipe's amount,
//      and you can change it, since not everyone follows a recipe exactly.
//   2. How much you ate, logged to your (private) calorie tracker.
export default function CookScreen() {
  const params = useLocalSearchParams<{
    id: string;
    serves?: string;
    mode?: "cook" | "eat";
    from?: "mine" | "community";
  }>();
  const { recipes } = useRecipes();
  const community = useCommunity();

  const recipe: RecipeContent | undefined =
    params.from === "community"
      ? community.recipes.find((r) => r.id === params.id)
      : recipes.find((r) => r.id === params.id);

  if (!recipe) {
    return (
      <View style={styles.missing}>
        <Text style={styles.hint}>This recipe isn't available any more.</Text>
      </View>
    );
  }
  const serves = Math.max(1, Number(params.serves) || recipe.servings || 1);
  return <CookForm recipe={recipe} serves={serves} eatOnly={params.mode === "eat"} />;
}

type Done = { taken: Taken[]; logged: number | null };

function CookForm({
  recipe,
  serves,
  eatOnly,
}: {
  recipe: RecipeContent;
  serves: number;
  eatOnly: boolean;
}) {
  const { items } = usePantry();
  const { takeOut } = useRecipes();
  const { logFood, entries, goals } = useNutrition();
  const { prefs } = usePreferences();

  // ---- 1. The pantry ----
  const ingredients = scaleIngredients(recipe.ingredients, serves / (recipe.servings ?? serves));
  const plan = planCook(ingredients, items);
  // What to take from each item, as text while typing. Starts at the recipe's amount
  // (never more than you have); "" when the recipe doesn't say how much.
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      plan.lines.map((l) => [
        l.item.id,
        l.recipeAmount === null
          ? ""
          : String(roundAmount(Math.min(l.recipeAmount, l.item.quantity))),
      ]),
    ),
  );
  const parsed = plan.lines.map((l) => {
    const t = (amounts[l.item.id] ?? "").trim().replace(",", ".");
    const n = t === "" ? 0 : Number(t);
    return { line: l, amount: n, ok: Number.isFinite(n) && n >= 0 };
  });
  const takingCount = parsed.filter((p) => p.ok && p.amount > 0).length;
  const amountsOk = parsed.every((p) => p.ok);

  function setAmount(itemId: string, value: number | string) {
    tick();
    setAmounts((prev) => ({ ...prev, [itemId]: String(value) }));
  }

  // ---- 2. What you ate ----
  const estimate = estimateRecipeNutrition(recipe.ingredients, recipe.servings);
  // Log it? On for "I ate this"; when cooking, on if you use the calorie tracker
  const tracksCalories = prefs.trackCalories && (goals.kcal !== null || entries.length > 0);
  const [logIt, setLogIt] = useState(eatOnly || tracksCalories);
  const [eaten, setEaten] = useState(1); // servings
  const fill = (n: number): NutritionText =>
    estimate
      ? nutritionToText({
          kcal: Math.round(estimate.perServe.kcal * n),
          protein: Math.round(estimate.perServe.protein * n),
          carbs: Math.round(estimate.perServe.carbs * n),
          fat: Math.round(estimate.perServe.fat * n),
        })
      : EMPTY_NUTRITION_TEXT;
  const [nutritionText, setNutritionText] = useState<NutritionText>(() => fill(1));
  const [edited, setEdited] = useState(false); // typed their own numbers?
  const nutrition = parseNutrition(nutritionText);
  const n = nutrition.ok ? nutrition.value : null;

  function changeEaten(by: number) {
    const next = Math.min(20, Math.max(0.5, eaten + by));
    if (next === eaten) return;
    tick();
    // Typed your own numbers? Scale those. Otherwise start again from the estimate.
    if (edited && n) {
      const k = next / eaten;
      const scale = (v: number | null) => (v === null ? null : Math.round(v * k));
      setNutritionText(
        nutritionToText({
          kcal: Math.round(n.kcal * k),
          protein: scale(n.protein),
          carbs: scale(n.carbs),
          fat: scale(n.fat),
        }),
      );
    } else {
      setNutritionText(fill(next));
    }
    setEaten(next);
  }

  const logOk = !logIt || n !== null;
  const canFinish = amountsOk && logOk && (eatOnly ? logIt : true);

  const [done, setDone] = useState<Done | null>(null);

  function finish() {
    if (!canFinish) return;
    success();
    const taken = eatOnly
      ? []
      : takeOut(
          parsed
            .filter((p) => p.ok && p.amount > 0)
            .map((p) => ({ itemId: p.line.item.id, amount: p.amount })),
        );
    let logged: number | null = null;
    if (logIt && n) {
      logFood({
        name: recipe.title,
        amount: eaten,
        unit: eaten === 1 ? "serving" : "servings",
        kcal: n.kcal,
        protein: n.protein ?? 0,
        carbs: n.carbs ?? 0,
        fat: n.fat ?? 0,
        itemId: null,
      });
      logged = n.kcal;
    }
    setDone({ taken, logged });
  }

  // ---- After: what happened ----
  if (done) {
    return (
      <View style={styles.doneScreen}>
        <Stack.Screen options={{ title: "" }} />
        <Animated.View entering={FadeIn.duration(280)} style={styles.doneCard}>
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={36} color={colors.onPrimary} />
          </View>
          <Text style={styles.doneTitle}>{eatOnly ? "Logged" : "Enjoy!"}</Text>
          {done.taken.length > 0 && (
            <Text style={styles.doneText}>
              Taken out of the pantry:{" "}
              {done.taken.map((t) => `${formatAmount(t.amount, t.unit)} ${t.name}`).join(", ")}.
            </Text>
          )}
          {!eatOnly && done.taken.length === 0 && (
            <Text style={styles.doneText}>Nothing was taken out of the pantry.</Text>
          )}
          {done.logged !== null && (
            <Text style={styles.doneText}>
              {formatKcal(done.logged)} kcal added to today's calories.
            </Text>
          )}
          <PressableScale onPress={() => router.back()} style={styles.button}>
            <Text style={styles.buttonText}>Done</Text>
          </PressableScale>
        </Animated.View>
      </View>
    );
  }

  const buttonLabel = eatOnly
    ? n
      ? `Log ${formatKcal(n.kcal)} kcal`
      : "Log it"
    : [
        takingCount > 0 ? `Take out ${takingCount} ${takingCount === 1 ? "item" : "items"}` : null,
        logIt && n ? `log ${formatKcal(n.kcal)} kcal` : null,
      ]
        .filter(Boolean)
        .join(" & ")
        .replace(/^log/, "Log") || "Done";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: eatOnly ? "I ate this" : "Cooked it" }} />

      {/* The recipe */}
      <View style={styles.recipeRow}>
        <View style={styles.thumb}>
          <RecipeCover
            cover={recipe.cover}
            ingredients={recipe.ingredients}
            photo={recipe.photo}
            height={56}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {recipe.title}
          </Text>
          {!eatOnly && (
            <Text style={styles.hint}>
              Made for {serves} {serves === 1 ? "person" : "people"}
            </Text>
          )}
        </View>
      </View>

      {/* ---- 1. Out of the pantry ---- */}
      {!eatOnly && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What came out of the pantry?</Text>
          <Text style={styles.hint}>
            Filled in from the recipe. Change anything you used more or less of.
          </Text>
          {plan.lines.length === 0 ? (
            <Text style={styles.empty}>
              None of the ingredients are in your pantry, so there's nothing to take out.
            </Text>
          ) : (
            <View style={styles.card}>
              {parsed.map(({ line: l, amount, ok }, i) => {
                const text = amounts[l.item.id] ?? "";
                const isNone = text.trim() === "" || amount === 0;
                return (
                  <Animated.View
                    key={l.item.id}
                    entering={rowEntering(i)}
                    style={[styles.line, i > 0 && styles.divider, isNone && styles.lineOff]}
                  >
                    <View style={styles.lineTop}>
                      <FoodIcon
                        name={l.item.name}
                        container={l.item.container}
                        location={l.item.location}
                        size={36}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lineName} numberOfLines={1}>
                          {l.item.name}
                        </Text>
                        <Text style={styles.lineMeta} numberOfLines={2}>
                          {l.recipeAmount !== null
                            ? `Recipe: ${niceQuantity(l.recipeAmount)} ${l.item.unit}`
                            : "Recipe doesn't say how much"}
                          {` · you have ${formatAmount(l.item.quantity, l.item.unit)}`}
                        </Text>
                      </View>
                      <View style={styles.amountBox}>
                        <TextInput
                          value={text}
                          onChangeText={(t) => setAmounts((p) => ({ ...p, [l.item.id]: t }))}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.textSoft}
                          style={[styles.amountInput, !ok && styles.inputError]}
                          selectTextOnFocus
                        />
                        <Text style={styles.amountUnit}>{l.item.unit}</Text>
                      </View>
                    </View>
                    {/* Quick picks */}
                    <View style={styles.quick}>
                      <QuickChip label="None" on={isNone} onPress={() => setAmount(l.item.id, 0)} />
                      {l.recipeAmount !== null && l.recipeAmount > 0 && (
                        <>
                          <QuickChip
                            label="Half"
                            on={
                              amount === roundAmount(Math.min(l.recipeAmount / 2, l.item.quantity))
                            }
                            onPress={() =>
                              setAmount(
                                l.item.id,
                                roundAmount(Math.min(l.recipeAmount! / 2, l.item.quantity)),
                              )
                            }
                          />
                          <QuickChip
                            label="As recipe"
                            on={amount === roundAmount(Math.min(l.recipeAmount, l.item.quantity))}
                            onPress={() =>
                              setAmount(
                                l.item.id,
                                roundAmount(Math.min(l.recipeAmount!, l.item.quantity)),
                              )
                            }
                          />
                        </>
                      )}
                      <QuickChip
                        label="All of it"
                        on={amount === roundAmount(l.item.quantity)}
                        onPress={() => setAmount(l.item.id, roundAmount(l.item.quantity))}
                      />
                    </View>
                    {ok && amount > l.item.quantity && (
                      <Text style={styles.warn}>
                        That's more than you have; only {formatAmount(l.item.quantity, l.item.unit)}{" "}
                        will come out.
                      </Text>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          )}
          {plan.missing.length > 0 && (
            <Text style={styles.hint}>Not in your pantry: {plan.missing.join(", ")}.</Text>
          )}
        </View>
      )}

      {/* ---- 2. What you ate (only if you track calories) ---- */}
      {(eatOnly || prefs.trackCalories) && (
        <View style={styles.section}>
          {!eatOnly && (
            <Pressable
              onPress={() => {
                tick();
                setLogIt((v) => !v);
              }}
              style={styles.toggleRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: logIt }}
            >
              <Ionicons
                name={logIt ? "checkbox" : "square-outline"}
                size={22}
                color={logIt ? colors.primary : colors.textSoft}
              />
              <Text style={styles.toggleText}>I ate some: add it to my calories</Text>
            </Pressable>
          )}
          {eatOnly && <Text style={styles.sectionTitle}>How much did you have?</Text>}

          {logIt && (
            <Animated.View entering={FadeIn.duration(220)} style={styles.section}>
              <View style={styles.servesRow}>
                <Text style={styles.servesLabel}>Servings</Text>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => changeEaten(-0.5)}
                    hitSlop={8}
                    style={styles.stepButton}
                  >
                    <Ionicons name="remove" size={20} color={colors.primary} />
                  </Pressable>
                  <Text style={styles.stepValue}>{niceQuantity(eaten)}</Text>
                  <Pressable onPress={() => changeEaten(0.5)} hitSlop={8} style={styles.stepButton}>
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
              <NutritionFields
                value={nutritionText}
                onChange={(t) => {
                  setEdited(true);
                  setNutritionText(t);
                }}
                basisLabel={`for ${niceQuantity(eaten)} ${eaten === 1 ? "serving" : "servings"}`}
                invalid={!nutrition.ok}
              />
              <Text style={styles.hint}>
                {estimate
                  ? `Estimated from the ingredients (about ${formatKcal(estimate.perServe.kcal)} kcal a serving). Change anything that looks off.`
                  : "We couldn't estimate this recipe from its ingredients. Enter the calories if you know them."}{" "}
                Only you can see your calories.
              </Text>
            </Animated.View>
          )}
        </View>
      )}

      <PressableScale
        onPress={finish}
        disabled={!canFinish}
        style={[styles.button, !canFinish && { opacity: 0.4 }]}
      >
        <Text style={styles.buttonText}>{buttonLabel}</Text>
      </PressableScale>
    </ScrollView>
  );
}

function QuickChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  missing: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 72, borderRadius: radius.md, overflow: "hidden" },
  recipeTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSoft },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSoft,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  line: { paddingVertical: spacing.md, gap: spacing.sm },
  lineOff: { opacity: 0.6 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  lineTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lineName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  lineMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  amountBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  amountInput: {
    width: 64,
    textAlign: "right",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.text,
  },
  inputError: { borderColor: colors.urgent },
  amountUnit: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, minWidth: 26 },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 36 + spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSoft },
  chipTextOn: { color: colors.primary },
  warn: { fontFamily: fonts.body, fontSize: 12, color: colors.soon, paddingLeft: 36 + spacing.md },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  toggleText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  servesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  servesLabel: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    minWidth: 32,
    textAlign: "center",
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  doneScreen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "center",
  },
  doneCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "stretch",
  },
  doneBadge: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, textAlign: "center" },
  doneText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    textAlign: "center",
  },
});
