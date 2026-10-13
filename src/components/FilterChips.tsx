import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";

import { colors, fonts, radius, spacing } from "@/theme";
import { tick } from "@/utils/haptics";

// A row of pill buttons where exactly one is selected, e.g. All / Fridge / Freezer / Pantry.
// It doesn't store which one is selected: the parent owns that state and passes it in
// (`selected`), and we report taps back up (`onSelect`). Props down, events up.
export function FilterChips<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string; dot?: string }[]; // dot: an optional colour dot
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <PressableScale
            key={option.value}
            scaleTo={0.92}
            onPress={() => {
              if (!isSelected) tick(); // a light buzz when the choice changes
              onSelect(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            {option.dot && <View style={[styles.dot, { backgroundColor: option.dot }]} />}
            <Text style={[styles.label, isSelected && styles.labelSelected]}>{option.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Selected = an ink-coloured pill (dark in light mode, light in dark mode)
  chipSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.text,
  },
  labelSelected: {
    color: colors.background,
  },
});
