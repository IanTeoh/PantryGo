import { SvgXml } from "react-native-svg";

import { LOGO_ASPECT, LOGO_SVG } from "@/data/logoMark";

// The PantryGo logo (the bag of groceries with the P), drawn sharp at any size.
//   height: how tall it is; the width follows
export function Logo({ height = 96 }: { height?: number }) {
  return (
    <SvgXml
      xml={LOGO_SVG}
      width={height * LOGO_ASPECT}
      height={height}
      accessibilityRole="image"
      accessibilityLabel="PantryGo logo"
    />
  );
}
