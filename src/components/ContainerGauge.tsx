import { useEffect, useId, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { ClipPath, Defs, Line, Path, Rect } from "react-native-svg";

import { colors } from "@/theme";
import type { ContainerType } from "@/types";

// ---------------------------------------------------------------------------
// The shapes (bottle, carton, jar, bag, box, can, tub, packet). Each is drawn on a 100 × 160 grid (the "viewBox"), then scaled
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
      "M42 16 H58 V30 C58 40 84 44 84 60 V146 Q84 156 74 156 H26 Q16 156 16 146 V60 C16 44 42 40 42 30 Z",
    top: 44,
    bottom: 156,
    right: 84,
    extras: <Rect x={38} y={5} width={24} height={12} rx={3} fill={colors.primary} />,
  },
  carton: {
    outline: "M20 46 L32 26 H68 L80 46 V148 Q80 156 72 156 H28 Q20 156 20 148 Z",
    top: 46,
    bottom: 156,
    right: 80,
    extras: (
      <>
        <Line x1={20} y1={46} x2={80} y2={46} stroke={colors.text} strokeWidth={2} />
        <Rect x={56} y={14} width={12} height={12} rx={2.5} fill={colors.primary} />
      </>
    ),
  },
  jar: {
    outline: "M22 36 H78 Q86 36 86 46 V144 Q86 156 74 156 H26 Q14 156 14 144 V46 Q14 36 22 36 Z",
    top: 40,
    bottom: 156,
    right: 86,
    extras: <Rect x={18} y={16} width={64} height={18} rx={5} fill={colors.primary} />,
  },
  bag: {
    outline: "M24 30 H76 L84 144 Q85 156 73 156 H27 Q15 156 16 144 Z",
    top: 38,
    bottom: 156,
    right: 82,
    extras: <Rect x={21} y={15} width={58} height={14} rx={3} fill={colors.primary} />,
  },
  box: {
    outline: "M18 42 H82 V150 Q82 156 76 156 H24 Q18 156 18 150 Z",
    top: 42,
    bottom: 156,
    right: 82,
    extras: (
      <>
        <Path
          d="M18 42 L28 26 H72 L82 42"
          fill="none"
          stroke={colors.text}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <Line x1={50} y1={26} x2={50} y2={42} stroke={colors.text} strokeWidth={2} />
      </>
    ),
  },
  can: {
    outline: "M20 34 H80 V148 Q80 156 72 156 H28 Q20 156 20 148 Z",
    top: 34,
    bottom: 156,
    right: 80,
    extras: (
      <>
        <Rect x={17} y={22} width={66} height={12} rx={6} fill={colors.primary} />
        <Line
          x1={20}
          y1={56}
          x2={80}
          y2={56}
          stroke={colors.text}
          strokeOpacity={0.25}
          strokeWidth={1.5}
        />
        <Line
          x1={20}
          y1={134}
          x2={80}
          y2={134}
          stroke={colors.text}
          strokeOpacity={0.25}
          strokeWidth={1.5}
        />
      </>
    ),
  },
  tub: {
    outline: "M12 70 H88 L82 146 Q81 156 71 156 H29 Q19 156 18 146 Z",
    top: 70,
    bottom: 156,
    right: 85,
    extras: <Rect x={7} y={56} width={86} height={14} rx={5} fill={colors.primary} />,
  },
  packet: {
    outline: "M24 22 H76 Q80 22 80 26 V138 Q80 156 62 156 H38 Q20 156 20 138 V26 Q20 22 24 22 Z",
    top: 38,
    bottom: 156,
    right: 80,
    extras: (
      <>
        <Line x1={20} y1={36} x2={80} y2={36} stroke={colors.text} strokeWidth={2} />
        <Path
          d="M80 26 L74 29 L80 32"
          fill="none"
          stroke={colors.text}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </>
    ),
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
