import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { colors, radius } from "@/theme";

// The simple way to show and set how much is left: a wide rounded bar.
// Drag along it (or tap a spot) to set the level. Used on item pages in Simple view
// (Profile → Appearance); the container drawing is the other option.
export function LevelBar({
  fraction,
  color,
  onDrag,
  onDragEnd,
}: {
  fraction: number; // 0 = empty, 1 = full
  color: string;
  onDrag?: (fraction: number) => void; // while the finger moves
  onDragEnd?: (fraction: number) => void; // once, when it lifts
}) {
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(fraction);
  const dragging = useRef(false);

  // Glide to changes made elsewhere (a quick-pour button, "Used it all")
  useEffect(() => {
    if (!dragging.current) fill.value = withTiming(fraction, { duration: 300 });
  }, [fraction, fill]);

  const toFraction = (x: number) => (width > 0 ? Math.min(1, Math.max(0, x / width)) : 0);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0) // a tap sets it too
    .onBegin((e) => {
      dragging.current = true;
      const f = toFraction(e.x);
      fill.value = f;
      onDrag?.(f);
    })
    .onUpdate((e) => {
      const f = toFraction(e.x);
      fill.value = f;
      onDrag?.(f);
    })
    .onFinalize((e) => {
      if (!dragging.current) return;
      dragging.current = false;
      onDragEnd?.(toFraction(e.x));
    });

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.track}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      >
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
        {/* Marks at a quarter, half and three quarters */}
        {[0.25, 0.5, 0.75].map((p) => (
          <View key={p} style={[styles.mark, { left: `${p * 100}%` }]} />
        ))}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  mark: {
    position: "absolute",
    top: 12,
    bottom: 12,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: colors.text,
    opacity: 0.15,
  },
});
