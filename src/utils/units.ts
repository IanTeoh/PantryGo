import type { ContainerType } from "@/types";

const SMALL_UNITS = ["g", "ml"];
const BIG_UNITS = ["kg", "L"];

// How much one tap of − or + changes an item: 50 g, 0.1 L, or 1 egg.
export function stepFor(unit: string): number {
  if (SMALL_UNITS.includes(unit)) return 50;
  if (BIG_UNITS.includes(unit)) return 0.1;
  return 1;
}

// How finely dragging the gauge snaps: every 10 ml, every 0.05 L, or whole items.
export function dragStepFor(unit: string): number {
  if (SMALL_UNITS.includes(unit)) return 10;
  if (BIG_UNITS.includes(unit)) return 0.05;
  return 1;
}

// Computers store decimals in binary, so 0.1 + 0.2 = 0.30000000000000004.
// Rounding to 2 decimal places hides that.
export function roundAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

// Round to the nearest multiple of `step`: snapTo(387, 10) = 390.
export function snapTo(n: number, step: number): number {
  return roundAmount(Math.round(n / step) * step);
}

export function formatAmount(n: number, unit: string): string {
  return `${roundAmount(n)} ${unit}`;
}

// A sensible default shape for a unit, so people rarely have to choose.
export function guessContainer(unit: string): ContainerType {
  switch (unit) {
    case "ml":
    case "L":
      return "bottle";
    case "g":
    case "kg":
      return "bag";
    case "jar":
      return "jar";
    case "pack":
      return "box";
    default:
      return "countable"; // pcs, can, bottle (as in "2 bottles of wine")
  }
}

export const CONTAINER_OPTIONS: { value: ContainerType; label: string }[] = [
  { value: "bottle", label: "Bottle" },
  { value: "carton", label: "Carton" },
  { value: "jar", label: "Jar" },
  { value: "bag", label: "Bag" },
  { value: "box", label: "Box" },
  { value: "countable", label: "Count them" },
];

// The "quick pour" buttons on an item's page: everyday amounts for its unit.
// e.g. oil in ml → "− 1 tbsp" (15 ml), "− ¼ cup" (60 ml), "+ 50 ml"
export function quickSteps(unit: string): { label: string; delta: number }[] {
  switch (unit) {
    case "ml":
      return [
        { label: "− 1 tbsp", delta: -15 },
        { label: "− ¼ cup", delta: -60 },
        { label: "+ 50 ml", delta: 50 },
      ];
    case "L":
      return [
        { label: "− 1 cup", delta: -0.25 },
        { label: "− 100 ml", delta: -0.1 },
        { label: "+ 250 ml", delta: 0.25 },
      ];
    case "g":
      return [
        { label: "− 50 g", delta: -50 },
        { label: "− 100 g", delta: -100 },
        { label: "+ 50 g", delta: 50 },
      ];
    case "kg":
      return [
        { label: "− 100 g", delta: -0.1 },
        { label: "− 250 g", delta: -0.25 },
        { label: "+ 250 g", delta: 0.25 },
      ];
    default:
      return [
        { label: "− 1", delta: -1 },
        { label: "+ 1", delta: 1 },
      ];
  }
}
