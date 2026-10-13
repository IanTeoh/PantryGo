import type { Location } from "@/types";

// The chip choices used by both the Add item and Edit item forms.
// One place, so the two forms always offer the same options.

export const LOCATION_OPTIONS: { value: Location; label: string }[] = [
  { value: "fridge", label: "Fridge" },
  { value: "freezer", label: "Freezer" },
  { value: "pantry", label: "Pantry" },
];

export const UNIT_OPTIONS = ["pcs", "g", "kg", "ml", "L", "can", "pack", "jar", "bottle"].map(
  (u) => ({ value: u, label: u }),
);
