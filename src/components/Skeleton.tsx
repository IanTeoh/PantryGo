import { useEffect } from "react";
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, radius, spacing } from "@/theme";

// ---------------------------------------------------------------------------
// Grey placeholder shapes that gently pulse while a page loads, in the shape of
// what's coming (rows, cards). Feels quicker than a spinner, and nothing jumps
// around when the real content arrives.
// ---------------------------------------------------------------------------

export function Skeleton({
  width = "100%",
  height = 14,
  round = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const fade = useSharedValue(1);
  useEffect(() => {
    // 1 → 0.45 → 1 … forever (until the page has loaded and this disappears)
    fade.value = withRepeat(
      withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [fade]);
  const animated = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: round, backgroundColor: colors.card },
        animated,
        style,
      ]}
    />
  );
}

// Rows like the pantry or shopping list: a round icon and two lines of text
export function SkeletonRows({ count = 5, inset = true }: { count?: number; inset?: boolean }) {
  return (
    <View
      style={[styles.rows, inset && { marginHorizontal: spacing.lg }]}
      accessibilityLabel="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.divider]}>
          <Skeleton width={40} height={40} round={12} />
          <View style={styles.rowText}>
            <Skeleton width={`${60 - (i % 3) * 12}%`} height={14} />
            <Skeleton width="35%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Two columns of recipe cards
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.grid} accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton height={112} round={0} />
          <View style={styles.cardText}>
            <Skeleton width="80%" height={14} />
            <Skeleton width="45%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Big blocks, for pages made of cards (Impact)
export function SkeletonBlocks() {
  return (
    <View style={styles.blocks} accessibilityLabel="Loading">
      <Skeleton height={170} round={radius.xl} />
      <Skeleton height={110} round={radius.lg} />
      <Skeleton height={140} round={radius.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowText: { flex: 1, gap: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  cardText: { padding: spacing.md, gap: 8 },
  blocks: { gap: spacing.lg },
});
