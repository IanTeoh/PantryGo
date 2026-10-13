import * as Haptics from "expo-haptics";

// Little buzzes that make taps feel physical. Each is "fire and forget":
// if the phone can't do haptics (or it's the web version), nothing happens.

// A light tick: picking a chip, each step while dragging the bottle level
export function tick() {
  Haptics.selectionAsync().catch(() => {});
}

// A firmer tap: pressing + / −, ticking off a shopping item
export function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// "Done!": used it all, put shopping away, cooked a recipe
export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// "Careful": threw something out, deleted something
export function warning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
