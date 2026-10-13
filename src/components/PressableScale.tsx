import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { pressIn, pressOut } from "@/utils/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A Pressable that shrinks a little while your finger is down and eases back
// when you let go. Use it instead of Pressable for cards and buttons.
//   scaleTo: how small it gets (0.96 = 4% smaller; small buttons can go lower)
export function PressableScale({
  scaleTo = 0.97,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const scale = useSharedValue(1);
  // Runs on the UI thread: turns the shared value into a style
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = pressIn(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = pressOut();
        onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
