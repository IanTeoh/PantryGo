import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme";
import type { NutritionText } from "@/utils/nutrition";

// Four small number boxes: calories, protein, carbs, fat.
// Used on the Add item, Edit item and Add food screens.
// `basisLabel` says what the numbers are for, e.g. "per 100 g" or "per item".
export function NutritionFields({
  value,
  onChange,
  basisLabel,
  invalid = false,
}: {
  value: NutritionText;
  onChange: (next: NutritionText) => void;
  basisLabel?: string;
  invalid?: boolean;
}) {
  // One box. `key` is which of the four it is; "keyof NutritionText" = "kcal" | "protein" | …
  function box(key: keyof NutritionText, label: string, suffix: string) {
    return (
      <View style={styles.box}>
        <Text style={styles.boxLabel}>{label}</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={value[key]}
            // [key]: a "computed" property name: replace just this one field
            onChangeText={(t) => onChange({ ...value, [key]: t })}
            keyboardType="decimal-pad"
            placeholder="–"
            placeholderTextColor={colors.textSoft}
            style={styles.input}
            selectTextOnFocus
          />
          <Text style={styles.suffix}>{suffix}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {basisLabel && <Text style={styles.basis}>Values {basisLabel}</Text>}
      <View style={styles.grid}>
        {box("kcal", "Calories", "kcal")}
        {box("protein", "Protein", "g")}
        {box("carbs", "Carbs", "g")}
        {box("fat", "Fat", "g")}
      </View>
      {invalid && (
        <Text style={styles.error}>
          Use numbers only, and fill in calories if you add protein, carbs or fat.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  basis: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  grid: { flexDirection: "row", gap: spacing.sm },
  box: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  boxLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textSoft },
  inputRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.text,
  },
  suffix: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.urgent },
});
