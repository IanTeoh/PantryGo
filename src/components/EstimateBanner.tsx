import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme";
import type { Nutrition } from "@/types";
import { estimateForItem } from "@/utils/foodMatch";
import { formatKcal, nutritionBasis } from "@/utils/nutrition";

// "Looks like Milk (whole): about 64 kcal per 100 ml  [Use]"
// Shown on the Add / Edit item forms when the nutrition boxes are empty and the
// name matches a common food. Shows nothing if there's no good match.
export function EstimateBanner({
  name,
  unit,
  onUse,
}: {
  name: string;
  unit: string;
  onUse: (estimate: Nutrition) => void;
}) {
  const estimate = estimateForItem(name, unit);
  if (!estimate) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
      <Text style={styles.text}>
        Looks like <Text style={styles.bold}>{estimate.food.name}</Text>: about{" "}
        {formatKcal(estimate.nutrition.kcal)} kcal {nutritionBasis(unit).label}
      </Text>
      <Pressable
        onPress={() => onUse(estimate.nutrition)}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Use</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  text: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.text },
  bold: { fontFamily: fonts.bodySemi },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onPrimary },
});
