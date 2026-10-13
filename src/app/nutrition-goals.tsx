import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useNutrition, type Goals } from "@/state/NutritionContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { success } from "@/utils/haptics";

// Daily targets. Every one is optional: leave a box empty for no goal.
export default function NutritionGoalsScreen() {
  const { goals, saveGoals } = useNutrition();

  // Text while typing; "" = no goal
  const toText = (v: number | null) => (v === null ? "" : String(v));
  const [text, setText] = useState({
    kcal: toText(goals.kcal),
    protein: toText(goals.protein),
    carbs: toText(goals.carbs),
    fat: toText(goals.fat),
  });

  // "" → null (no goal), "2000" → 2000, anything else → NaN (invalid)
  function parse(t: string): number | null {
    const s = t.trim().replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  }

  const next: Goals = {
    kcal: parse(text.kcal),
    protein: parse(text.protein),
    carbs: parse(text.carbs),
    fat: parse(text.fat),
  };
  const valid = Object.values(next).every((v) => !Number.isNaN(v)) && (next.kcal ?? 0) < 20000;

  function save() {
    if (!valid) return;
    success();
    saveGoals(next);
    router.back();
  }

  function row(key: keyof Goals, label: string, unit: string, placeholder: string) {
    const bad = Number.isNaN(next[key]);
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <TextInput
          value={text[key]}
          onChangeText={(t) => setText({ ...text, [key]: t })}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          style={[styles.input, bad && styles.inputError]}
          selectTextOnFocus
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.intro}>
        Set daily targets to see progress bars. Leave any box empty for no goal. Only you can see
        these.
      </Text>

      <View style={styles.card}>
        {row("kcal", "Calories", "kcal", "No goal")}
        <View style={styles.divider} />
        {row("protein", "Protein", "g", "No goal")}
        <View style={styles.divider} />
        {row("carbs", "Carbs", "g", "No goal")}
        <View style={styles.divider} />
        {row("fat", "Fat", "g", "No goal")}
      </View>

      <Text style={styles.note}>
        Not sure what to aim for? Needs differ a lot from person to person. A GP or dietitian can
        help you pick numbers that suit you.
      </Text>

      <Pressable
        onPress={save}
        disabled={!valid}
        style={({ pressed }) => [
          styles.saveButton,
          !valid && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.saveText}>Save goals</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSoft },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowLabel: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  input: {
    width: 110,
    textAlign: "right",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.urgent },
  unit: { width: 32, fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  divider: { height: 1, backgroundColor: colors.border },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSoft },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
});
