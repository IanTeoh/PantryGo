import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import {
  WORDMARK_BOTTOM,
  WORDMARK_LEFT,
  WORDMARK_PATH,
  WORDMARK_TIP,
  WORDMARK_WIDTH,
} from "@/data/wordmark";
import { colors } from "@/theme";

// ---------------------------------------------------------------------------
// The PantryGo lettering, with a leaf sprouting from the top of the "t".
//   size: like a font size (40 ≈ the sign-in logo)
//   grow: the leaf grows in when it first appears, from a bud to full size
//   delay: how long before it starts growing (ms)
//   onDark: lighter leaf colours, for the green launch screen
// The leaf is the same one as on the app icon (see the brand notes in docs).
// ---------------------------------------------------------------------------

const LEAF_W = 40; // the leaf's own drawing box (see Leaf below)
const LEAF_H = 44;
const LEAF_SCALE = 13.3; // leaf units → font units
const SINK = 25; // the stem starts a touch inside the "t", so they join up
const TOP = WORDMARK_TIP.y + SINK - LEAF_H * LEAF_SCALE - 12; // room above for the leaf

export function Wordmark({
  size = 40,
  color = colors.text,
  grow = false,
  delay = 350,
  onDark = false,
}: {
  size?: number;
  color?: string;
  grow?: boolean;
  delay?: number;
  onDark?: boolean;
}) {
  const k = size / 1000; // font units → pixels
  const width = WORDMARK_WIDTH * k;
  const height = (WORDMARK_BOTTOM - TOP) * k;

  // Where the leaf's box goes, so its stem's foot (6, 44) lands on the tip of the "t"
  const leafW = LEAF_W * LEAF_SCALE * k;
  const leafH = LEAF_H * LEAF_SCALE * k;
  const leafLeft = (WORDMARK_TIP.x - WORDMARK_LEFT - 6 * LEAF_SCALE) * k;
  const leafTop = (WORDMARK_TIP.y + SINK - TOP) * k - leafH;

  // 0 = a tiny bud, 1 = fully grown. Phones set to "reduce motion" skip to the end.
  const grown = useSharedValue(grow ? 0 : 1);
  useEffect(() => {
    if (!grow) return;
    grown.value = withDelay(
      delay,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
    );
  }, [grow, grown, delay]);

  const leafStyle = useAnimatedStyle(() => ({
    opacity: grown.value < 0.02 ? 0 : 1,
    transform: [{ rotate: `${(1 - grown.value) * -25}deg` }, { scale: 0.05 + grown.value * 0.95 }],
  }));

  return (
    <View
      style={{ width, height }}
      accessible
      accessibilityRole="header"
      accessibilityLabel="PantryGo"
    >
      <Svg
        width={width}
        height={height}
        viewBox={`${WORDMARK_LEFT} ${TOP} ${WORDMARK_WIDTH} ${WORDMARK_BOTTOM - TOP}`}
      >
        <Path d={WORDMARK_PATH} fill={color} />
      </Svg>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: leafLeft,
            top: leafTop,
            width: leafW,
            height: leafH,
            // grows out from the foot of its stem, on the "t"
            transformOrigin: [(6 / LEAF_W) * leafW, leafH, 0],
          },
          leafStyle,
        ]}
      >
        <Leaf width={leafW} height={leafH} onDark={onDark} />
      </Animated.View>
    </View>
  );
}

// The leaf: a short curved stem, the blade, and a light vein. Greens that work on
// both light and dark backgrounds.
export function Leaf({
  width,
  height,
  onDark = false,
}: {
  width: number;
  height: number;
  onDark?: boolean;
}) {
  const [stem, blade, vein] = onDark
    ? ["#A8E6C1", "#7FD1A3", "#E3F7EA"]
    : ["#2F8F5B", "#3FA86B", "#A8E6C1"];
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${LEAF_W} ${LEAF_H}`}>
      <Path
        d="M6 44 C6 36 7 30 11 24"
        fill="none"
        stroke={stem}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Path d="M11 25 C10 12 22 3 37 3 C37 17 27 27 11 25 Z" fill={blade} />
      <Path
        d="M12 24 C19 17 26 11 33 7"
        fill="none"
        stroke={vein}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
