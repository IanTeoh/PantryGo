import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { colors, fonts } from "@/theme";
import { formatKcal } from "@/utils/nutrition";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// The dial runs from 0 to 125% of your goal, so the goal sits at 80% of the way
// round and there's a "over" zone after it, like the red zone on a rev counter.
const OVER = 1.25;
const GOAL_AT = 1 / OVER; // 0.8

// Colours for the two places the gauge appears
const TONES = {
  // On the dark green hero card (Calories page)
  hero: {
    track: "rgba(255,255,255,0.16)",
    overTrack: "rgba(255,170,150,0.22)",
    fill: "#A8E6C1",
    over: "#FFB49E",
    tick: "rgba(255,255,255,0.4)",
    goalTick: "#FFFFFF",
    needle: colors.onHero,
    text: colors.onHero,
    soft: colors.onHeroSoft,
  },
  // On a normal card (Home)
  surface: {
    track: colors.card,
    overTrack: colors.urgentBg,
    fill: colors.primaryBright,
    over: colors.urgent,
    tick: colors.textSoft, // drawn faint (see strokeOpacity below), so it shows in dark mode too
    goalTick: colors.text,
    needle: colors.text,
    text: colors.text,
    soft: colors.textSoft,
  },
};

// A semicircle "speedometer" for today's calories against your goal.
//   width: how wide the dial is; everything else scales from it
export function CalorieGauge({
  value,
  goal,
  width = 280,
  tone = "surface",
}: {
  value: number;
  goal: number;
  width?: number;
  tone?: keyof typeof TONES;
}) {
  const c = TONES[tone];
  const stroke = Math.max(10, width * 0.06);
  const r = width / 2 - stroke / 2 - 2;
  const cx = width / 2;
  const cy = r + stroke / 2 + 2;
  const height = cy + stroke * 0.6; // just room for the needle's hub

  // A point on the dial, f = 0 (left end) … 1 (right end)
  const at = (f: number, radius = r) => {
    const a = Math.PI * (1 - f);
    return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) };
  };
  const arc = (from: number, to: number) => {
    const a = at(from);
    const b = at(to);
    return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
  };
  const goalLen = Math.PI * r * GOAL_AT; // length of the 0 → goal part
  const overLen = Math.PI * r * (1 - GOAL_AT); // length of the goal → max part

  // Where the needle points (0…1), eased from wherever it was
  const target = Math.min(1, value / (goal * OVER));
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [target, p]);

  // Green fills up to the goal, then coral carries on into the over zone
  const fillProps = useAnimatedProps(() => {
    const f = Math.min(p.value, GOAL_AT) / GOAL_AT;
    return { strokeDashoffset: goalLen * (1 - f), strokeOpacity: p.value > 0.005 ? 1 : 0 };
  });
  const overProps = useAnimatedProps(() => {
    const f = Math.max(0, p.value - GOAL_AT) / (1 - GOAL_AT);
    return { strokeDashoffset: overLen * (1 - f), strokeOpacity: f > 0.01 ? 1 : 0 };
  });
  const needleLen = r - stroke * 1.6;
  const needleProps = useAnimatedProps(() => {
    const a = Math.PI * (1 - p.value);
    return { x2: cx + needleLen * Math.cos(a), y2: cy - needleLen * Math.sin(a) };
  });

  // Tick marks every 5% of the dial, longer every 20% (one of which is the goal)
  const ticks = Array.from({ length: 21 }, (_, i) => i / 20);
  const inner = r - stroke / 2 - 4;

  const over = value > goal;
  const left = Math.abs(goal - value);
  const big = Math.round(width * 0.15);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`${formatKcal(value)} of ${formatKcal(goal)} kcal`}
    >
      <Svg width={width} height={height}>
        {/* The track: the over zone underneath, the normal part on top */}
        <Path
          d={arc(GOAL_AT, 1)}
          stroke={c.overTrack}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={arc(0, GOAL_AT)}
          stroke={c.track}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />

        {/* What you've eaten */}
        <AnimatedPath
          d={arc(0, GOAL_AT)}
          stroke={c.fill}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${goalLen} ${goalLen}`}
          animatedProps={fillProps}
        />
        <AnimatedPath
          d={arc(GOAL_AT, 1)}
          stroke={c.over}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${overLen} ${overLen}`}
          animatedProps={overProps}
        />

        {/* Ticks inside the arc */}
        {ticks.map((f, i) => {
          const isGoal = Math.abs(f - GOAL_AT) < 0.001;
          const long = i % 4 === 0;
          const a = at(f, inner);
          const b = at(f, inner - (isGoal ? stroke * 0.9 : long ? stroke * 0.6 : stroke * 0.3));
          return (
            <Line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={isGoal ? c.goalTick : c.tick}
              strokeWidth={isGoal ? 2.5 : long ? 2 : 1.25}
              strokeOpacity={isGoal ? 1 : tone === "surface" ? 0.4 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* The needle */}
        <AnimatedLine
          x1={cx}
          y1={cy}
          stroke={c.needle}
          strokeWidth={Math.max(2.5, stroke * 0.22)}
          strokeLinecap="round"
          animatedProps={needleProps}
        />
        <Circle cx={cx} cy={cy} r={stroke * 0.5} fill={c.needle} />
        <Circle cx={cx} cy={cy} r={stroke * 0.2} fill={over ? c.over : c.fill} />
      </Svg>

      {/* The readout under the needle, like a car's digital display */}
      <Text style={[styles.number, { color: c.text, fontSize: big, lineHeight: big * 1.12 }]}>
        {formatKcal(value)}
        <Text style={[styles.unit, { color: c.soft, fontSize: big * 0.36 }]}> kcal</Text>
      </Text>
      <Text
        style={[
          styles.caption,
          { color: over ? c.over : c.soft, fontSize: Math.max(12, big * 0.33) },
        ]}
      >
        {over
          ? `${formatKcal(left)} over your ${formatKcal(goal)} goal`
          : `${formatKcal(left)} left of ${formatKcal(goal)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  number: { fontFamily: fonts.heading, marginTop: 4 },
  unit: { fontFamily: fonts.body },
  caption: { fontFamily: fonts.bodySemi, marginTop: 2 },
});
