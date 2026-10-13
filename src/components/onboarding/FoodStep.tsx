import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FilterChips } from "@/components/FilterChips";
import { FoodArt } from "@/components/FoodIcon";
import { PressableScale } from "@/components/PressableScale";
import { usePreferences } from "@/state/PreferencesContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { tick } from "@/utils/haptics";
import { CUISINES, type Diet } from "@/utils/recipeMeta";

const DIETS: { value: Diet; label: string }[] = [
  { value: "any", label: "I eat everything" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];

// "What do you like to eat?" Cuisines (pick any) and how you eat.
// Used in the setup flow and from Profile → Food preferences.
export function FoodStep({
  onDone,
  doneLabel = "Next",
}: {
  onDone: () => void;
  doneLabel?: string;
}) {
  const { prefs, savePrefs } = usePreferences();
  const [cuisines, setCuisines] = useState<string[]>(prefs.cuisines);
  const [diet, setDiet] = useState<Diet>(prefs.diet);

  function toggle(value: string) {
    tick();
    setCuisines((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  }

  async function save() {
    await savePrefs({ cuisines, diet });
    onDone();
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {CUISINES.map((c) => {
          const on = cuisines.includes(c.value);
          return (
            <PressableScale
              key={c.value}
              scaleTo={0.94}
              onPress={() => toggle(c.value)}
              style={[styles.tile, on && styles.tileOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={c.label}
            >
              {on && (
                <View style={styles.tick}>
                  <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                </View>
              )}
              <FoodArt art={c.art} size={40} />
              <Text style={[styles.tileText, on && styles.tileTextOn]} numberOfLines={1}>
                {c.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {cuisines.length === 0
          ? "Pick as many as you like, or none."
          : `${cuisines.length} picked. Recipes like these show up first.`}
      </Text>

      <Text style={styles.label}>How do you eat?</Text>
      <View style={styles.bleed}>
        <FilterChips options={DIETS} selected={diet} onSelect={setDiet} />
      </View>
      {diet !== "any" && (
        <Text style={styles.hint}>
          Suggestions will stick to recipes tagged{" "}
          {diet === "vegan" ? "vegan" : "vegetarian or vegan"}.
        </Text>
      )}

      <PressableScale scaleTo={0.97} onPress={save} style={styles.button}>
        <Text style={styles.buttonText}>{doneLabel}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.sm,
  },
  tile: {
    width: "31.5%",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tileOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tick: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
  tileTextOn: { color: colors.primary },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, marginTop: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  bleed: { marginHorizontal: -spacing.lg },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
});
