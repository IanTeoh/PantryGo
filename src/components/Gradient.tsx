import { useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { heroGradient } from "@/theme";

// A soft diagonal gradient that fills its parent (put it first inside a card
// with overflow: "hidden"). Drawn with SVG, so no extra package is needed.
export function Gradient({
  from = heroGradient[0],
  to = heroGradient[1],
}: {
  from?: string;
  to?: string;
}) {
  // A unique id per gradient (two on one screen mustn't clash). SVG ids can't have ":".
  const id = `grad${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}
