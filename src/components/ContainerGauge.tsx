import { useEffect, useId, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { ClipPath, Defs, Line, Path, Rect } from "react-native-svg";

import { colors } from "@/theme";
import type { ContainerType } from "@/types";

// ---------------------------------------------------------------------------
// The shapes. Each is drawn on a 100 × 160 grid (the "viewBox"), then scaled
// to whatever size we display it at.
//   outline: the SVG path of the container's inside
//   top / bottom: the grid y values for "full" and "empty"
//   right: the x value of the right wall (where the tick marks go)
//   extras: decoration drawn on top (a cap, a lid…)
// ---------------------------------------------------------------------------
const VIEW_W = 100;
const VIEW_H = 160;

type GaugeShape = Exclude<ContainerType, "countable">; // every type except "countable"

const SHAPES: Record<
  GaugeShape,
  { outline: string; top: number; bottom: number; right: number; extras: ReactNode }
> = {
  bottle: {
    outline:
      "M42 12 H58 V30 C58 40 85 42 85 58 V146 Q85 156 75 156 H25 Q15 156 15 146 V58 C15 42 42 40 42 30 Z",
    top: 34,
    bottom: 156,
    right: 85,
    extras: <Rect x={39} y={3} width={22} height={10} rx={2.5} fill={colors.primary} />,
  },
  carton: {
    outline: "M20 42 L50 16 L80 42 V150 Q80 156 74 156 H26 Q20 156 20 150 Z",
    top: 42,
    bottom: 156,
    right: 80,
    extras: (
      <>
        <Rect x={44} y={6} width={12} height={10} rx={2} fill={colors.primary} />
        <Line x1={20} y1={42} x2={80} y2={42} stroke={colors.primary} strokeWidth={1.5} />
      </>
    ),
  },
  jar: {
    outline: "M24 32 H76 Q86 32 86 42 V146 Q86 156 76 156 H24 Q14 156 14 146 V42 Q14 32 24 32 Z",
    top: 36,
    bottom: 156,
    right: 86,
    extras: <Rect x={16} y={14} width={68} height={16} rx={4} fill={colors.primary} />,
  },
  bag: {
    outline: "M22 24 H78 L84 146 Q84 156 74 156 H26 Q16 156 16 146 Z",
    top: 34,
    bottom: 156,
    right: 82,
    extras: (
      <Path
        d="M22 24 L27 16 L32 24 L37 16 L42 24 L47 16 L52 24 L57 16 L62 24 L67 16 L72 24 L77 16 L78 24"
        fill="none"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    ),
  },
  box: {
    outline: "M18 28 H82 V150 Q82 156 76 156 H24 Q18 156 18 150 Z",
    top: 28,
    bottom: 156,
    right: 82,
    extras: <Line x1={18} y1={42} x2={82} y2={42} stroke={colors.primary} strokeWidth={1.5} />,
  },
};

// An SVG rectangle that Reanimated can animate without re-rendering React
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function ContainerGauge({
  shape,
  fraction,
  color,
  width = 170,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  shape: GaugeShape;
  fraction: number; // 0 = empty, 1 = full
  color: string;
  width?: number;
  onDragStart?: () => void;
  onDrag?: (fraction: number) => void; // called continuously while dragging
  onDragEnd?: (fraction: number) => void; // called once, when the finger lifts
}) {
  const height = (width * VIEW_H) / VIEW_W;
  const s = SHAPES[shape];
  const clipId = `inside${useId().replace(/[^a-zA-Z0-9]/g, "")}`; // unique id, letters/digits only

  // A "shared value": a number Reanimated can animate smoothly at 60 fps.
  const fill = useSharedValue(fraction);
  // Are we mid-drag? A ref is like state that doesn't cause a re-render when changed.
  const dragging = useRef(false);

  // When `fraction` changes from outside (a − tap, "Used it all"), glide to the new level.
  // While dragging, the finger is in charge, so skip it.
  useEffect(() => {
    if (!dragging.current) {
      fill.value = withTiming(fraction, { duration: 400 });
    }
  }, [fraction, fill]);

  // Finger position (pixels from the top of the gauge) → fill level (0 to 1)
  function toFraction(y: number): number {
    const gridY = (y / height) * VIEW_H; // pixels → grid units
    const f = (s.bottom - gridY) / (s.bottom - s.top);
    return Math.min(1, Math.max(0, f)); // keep between 0 and 1
  }

  // The drag gesture. runOnJS(true) runs these callbacks as normal JavaScript,
  // so they can call our props and update React state.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0) // react straight away, so a single tap also sets the level
    .onBegin((e) => {
      dragging.current = true;
      onDragStart?.();
      const f = toFraction(e.y);
      fill.value = f;
      onDrag?.(f);
    })
    .onUpdate((e) => {
      const f = toFraction(e.y);
      fill.value = f;
      onDrag?.(f);
    })
    .onFinalize((e) => {
      if (!dragging.current) return;
      dragging.current = false;
      onDragEnd?.(toFraction(e.y));
    });

  // Recalculated every animation frame from `fill`: where the liquid's surface is.
  // (The animation runs on a separate thread, so we hand it plain numbers only, not `s`.)
  const top = s.top;
  const bottom = s.bottom;
  const liquidProps = useAnimatedProps(() => {
    const surface = bottom - fill.value * (bottom - top);
    return { y: surface, height: VIEW_H - surface };
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width, height }}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Defs>
            {/* Anything using this clip is only drawn inside the container's outline */}
            <ClipPath id={clipId}>
              <Path d={s.outline} />
            </ClipPath>
          </Defs>

          {/* 1. Empty container */}
          <Path d={s.outline} fill={colors.background} />

          {/* 2. The liquid: a tall rectangle, clipped to the container's shape */}
          <AnimatedRect
            x={0}
            width={VIEW_W}
            fill={color}
            clipPath={`url(#${clipId})`}
            animatedProps={liquidProps}
          />

          {/* 3. Tick marks at ¼, ½ and ¾ */}
          {[0.25, 0.5, 0.75].map((p) => {
            const y = s.bottom - p * (s.bottom - s.top);
            return (
              <Line
                key={p}
                x1={s.right - 11}
                x2={s.right - 4}
                y1={y}
                y2={y}
                stroke={colors.text}
                strokeOpacity={0.3}
                strokeWidth={1.5}
              />
            );
          })}

          {/* 4. The outline and decoration on top */}
          <Path
            d={s.outline}
            fill="none"
            stroke={colors.text}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {s.extras}
        </Svg>
      </View>
    </GestureDetector>
  );
}
