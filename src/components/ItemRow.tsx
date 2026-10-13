import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { colors, fonts, radius, spacing } from "@/theme";
import type { Item } from "@/types";
import { success, tap, tick, warning } from "@/utils/haptics";
import { pressIn, pressOut } from "@/utils/motion";
import { formatAmount, stepFor } from "@/utils/units";

import { FoodIcon } from "./FoodIcon";
import { PressableScale } from "./PressableScale";
import { StatusPill } from "./StatusPill";

// One item in the pantry list. Tap to open it; swipe left for "Used" and "Bin".
export function ItemRow({
  item,
  onChangeQuantity,
  onUsedAll,
  onDiscard,
}: {
  item: Item;
  onChangeQuantity: (id: string, delta: number) => void;
  onUsedAll: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  // A ref to the swipeable, so the action buttons can close it again
  const swipeRef = useRef<SwipeableMethods>(null);

  const isOut = item.quantity === 0;
  const isCountable = item.container === "countable";
  const step = stepFor(item.unit);
  const fraction = item.capacity > 0 ? Math.min(1, item.quantity / item.capacity) : 0;

  // The whole row shrinks a touch while you hold it
  const pressScale = useSharedValue(1);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  // The level bar slides to its new width
  const level = useSharedValue(fraction);
  useEffect(() => {
    level.value = withTiming(fraction, { duration: 350 });
  }, [fraction]);
  const levelStyle = useAnimatedStyle(() => ({ width: `${level.value * 100}%` }));

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      // What's revealed when you swipe left (nothing to use or bin when it's out)
      renderRightActions={
        isOut
          ? undefined
          : (progress) => (
              <SwipeActions
                progress={progress}
                name={item.name}
                onUsed={() => {
                  success();
                  swipeRef.current?.close();
                  onUsedAll(item.id);
                }}
                onBin={() => {
                  warning();
                  swipeRef.current?.close();
                  onDiscard(item.id);
                }}
              />
            )
      }
      overshootRight={false}
      friction={1.6}
      rightThreshold={40}
      containerStyle={styles.swipeContainer}
    >
      <Animated.View style={[styles.row, isOut && styles.rowOut, rowStyle]}>
        <Pressable
          style={styles.main}
          onPressIn={() => (pressScale.value = pressIn(0.98))}
          onPressOut={() => (pressScale.value = pressOut())}
          onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${formatAmount(item.quantity, item.unit)}`}
        >
          <FoodIcon
            name={item.name}
            container={item.container}
            location={item.location}
            size={48}
          />
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.meta}>
              {isOut ? <Text style={styles.outPill}>Run out</Text> : <StatusPill item={item} />}
              <Text style={styles.location}>{item.location}</Text>
            </View>
          </View>
        </Pressable>

        {isCountable ? (
          // Things you count get − / + right in the list
          <View style={styles.stepper}>
            <PressableScale
              scaleTo={0.82}
              onPress={() => {
                tap();
                onChangeQuantity(item.id, -step);
              }}
              hitSlop={6}
              style={styles.stepButton}
              accessibilityLabel={`Use one ${item.name}`}
            >
              <Text style={styles.stepMinus}>−</Text>
            </PressableScale>
            <Text style={styles.count}>{formatAmount(item.quantity, "").trim()}</Text>
            <PressableScale
              scaleTo={0.82}
              onPress={() => {
                tap();
                onChangeQuantity(item.id, step);
              }}
              hitSlop={6}
              style={[styles.stepButton, styles.stepPlus]}
              accessibilityLabel={`Add one ${item.name}`}
            >
              <Text style={styles.stepPlusText}>+</Text>
            </PressableScale>
          </View>
        ) : (
          // Things you pour or scoop show the amount and how full it is
          <View style={styles.amountBox}>
            <Text style={styles.amount}>{formatAmount(item.quantity, item.unit)}</Text>
            <View style={styles.levelTrack}>
              <Animated.View style={[styles.levelFill, levelStyle]} />
            </View>
          </View>
        )}
      </Animated.View>
    </ReanimatedSwipeable>
  );
}

// ---------------------------------------------------------------------------
// The Used / Bin buttons behind a row. As you pull, their icons fade in;
// when they're fully open there's a little haptic "snap".
// `progress` goes 0 → 1 as the row opens (a shared value from the swipeable).
// ---------------------------------------------------------------------------
function SwipeActions({
  progress,
  name,
  onUsed,
  onBin,
}: {
  progress: SharedValue<number>;
  name: string;
  onUsed: () => void;
  onBin: () => void;
}) {
  // Haptic snap the moment it opens fully (runOnJS: haptics live on the JS side)
  useAnimatedReaction(
    () => progress.value >= 0.98,
    (open, wasOpen) => {
      if (open && wasOpen === false) runOnJS(tick)();
    },
  );

  // The icons fade in as you pull: the first one a little ahead of the second
  const usedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.1, 0.5], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0.1, 0.6], [0.85, 1], Extrapolation.CLAMP) }],
  }));
  const binStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 0.7], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0.3, 0.8], [0.85, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.actions}>
      <Pressable
        style={[styles.action, { backgroundColor: colors.fresh }]}
        onPress={onUsed}
        accessibilityLabel={`Used all of ${name}`}
      >
        <Animated.View style={[styles.actionInner, usedStyle]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.onPrimary} />
          <Text style={styles.actionText}>Used</Text>
        </Animated.View>
      </Pressable>
      <Pressable
        style={[styles.action, styles.actionLast, { backgroundColor: colors.urgent }]}
        onPress={onBin}
        accessibilityLabel={`Threw out ${name}`}
      >
        <Animated.View style={[styles.actionInner, binStyle]}>
          <Ionicons name="trash" size={21} color={colors.onPrimary} />
          <Text style={styles.actionText}>Bin</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rowOut: { opacity: 0.55 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  info: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  location: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSoft,
    textTransform: "capitalize",
  },
  outPill: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.textSoft,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  amountBox: { alignItems: "flex-end", gap: 6 },
  amount: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  levelTrack: {
    width: 52,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  levelFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.primaryBright },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepPlus: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepMinus: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.primary, lineHeight: 20 },
  stepPlusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.onPrimary,
    lineHeight: 20,
  },
  count: {
    minWidth: 28,
    textAlign: "center",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.text,
  },
  actions: { flexDirection: "row", width: 150, marginLeft: -24, paddingLeft: 24 },
  action: { flex: 1, alignItems: "center", justifyContent: "center" },
  actionInner: { alignItems: "center", gap: 2 },
  actionLast: { borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.onPrimary },
});
