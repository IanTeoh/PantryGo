import { Easing, FadeIn, FadeOut, LinearTransition, withTiming } from "react-native-reanimated";

// ---------------------------------------------------------------------------
// The app's motion, in one place, so everything moves the same way.
// Calm on purpose: things fade and ease, nothing bounces.
// Reanimated runs these on the phone's UI thread, so they stay smooth even when
// the JavaScript side is busy. Phones set to "reduce motion" get them toned down
// automatically.
// ---------------------------------------------------------------------------

const EASE = Easing.out(Easing.cubic); // starts quick, settles gently, no overshoot

// Pressing: shrink a touch while held, ease back on release
export function pressIn(to: number) {
  "worklet"; // can also run on the UI thread
  return withTiming(to, { duration: 90, easing: EASE });
}
export function pressOut() {
  "worklet";
  return withTiming(1, { duration: 160, easing: EASE });
}

// A list row arriving: a soft fade. Rows further down start a moment later,
// so a list fades in from the top. (Capped, so long lists don't drag.)
export function rowEntering(index: number) {
  return FadeIn.duration(220).delay(Math.min(index, 10) * 25);
}

// A row leaving: a quick fade
export const rowExiting = FadeOut.duration(160);

// When rows above or below change, the others slide smoothly into place
export const rowLayout = LinearTransition.duration(220).easing(EASE);
