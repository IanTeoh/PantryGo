import { colors } from "@/theme";
import type { Item } from "@/types";

import { daysUntil } from "./dates";

// How urgently an item needs using. "unknown" = no expiry date.
export type Freshness = "urgent" | "soon" | "fresh" | "unknown";

export function getFreshness(item: Item): Freshness {
  if (item.expiry === null) return "unknown";
  const days = daysUntil(item.expiry);
  if (days <= 0) return "urgent"; // use today, or already expired
  if (days <= 3) return "soon";
  return "fresh";
}

// The dot colour for each freshness level.
// Record<Freshness, string> = "an object with one string for every Freshness value".
// If we added a new level and forgot it here, TypeScript would flag it.
export const freshnessColor: Record<Freshness, string> = {
  urgent: colors.urgent,
  soon: colors.soon,
  fresh: colors.fresh,
  unknown: colors.border,
};

// For .sort(): soonest expiry first, items without a date last, then A–Z.
export function compareByExpiry(a: Item, b: Item): number {
  if (a.expiry !== b.expiry) {
    if (a.expiry === null) return 1; // a has no date → a goes after b
    if (b.expiry === null) return -1; // b has no date → a goes before b
    return a.expiry.localeCompare(b.expiry); // "2026-10-07" < "2026-10-20" works as text
  }
  return a.name.localeCompare(b.name);
}
