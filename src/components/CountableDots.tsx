import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/theme";

// For things you count (eggs, cans): one circle per item.
// Filled = still have it. Tap a circle to set how many are left
// (tap the last filled one to use it).
export function CountableDots({
  count,
  capacity,
  onSet,
}: {
  count: number;
  capacity: number;
  onSet: (newCount: number) => void;
}) {
  const total = Math.max(capacity, count);

  return (
    <View style={styles.grid}>
      {/* Array.from({ length: 12 }, …) makes [0, 1, 2, … 11]: one entry per circle */}
      {Array.from({ length: total }, (_, i) => {
        const filled = i < count;
        return (
          <Pressable
            key={i}
            onPress={() => onSet(i + 1 === count ? i : i + 1)}
            hitSlop={4} // a slightly bigger tap area than the circle itself
            style={[styles.dot, filled ? styles.filled : styles.empty]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap", // wrap onto the next line when the row is full
    justifyContent: "center",
    gap: spacing.md,
    alignSelf: "center",
    maxWidth: 300,
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
  },
  filled: { backgroundColor: colors.primaryBright, borderColor: colors.primaryBright },
  empty: { backgroundColor: colors.background },
});
