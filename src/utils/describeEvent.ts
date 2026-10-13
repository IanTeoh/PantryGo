import type { PantryEvent } from "@/state/PantryContext";

import { formatAmount } from "./units";

// One line of the activity feed: "Used 120 ml of Olive oil"
export function describeEvent(event: PantryEvent): string {
  const amount = formatAmount(event.amount, event.unit);
  switch (event.type) {
    case "used":
      return `Used ${amount} of ${event.itemName}`;
    case "restocked":
      return `Topped up ${event.itemName} by ${amount}`;
    case "added":
      return `Added ${event.itemName} (${amount})`;
    case "wasted":
      return `Threw out ${amount} of ${event.itemName}`;
    case "removed":
      return `Removed ${event.itemName}`;
  }
}
