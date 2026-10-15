import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Wordmark } from "@/components/Wordmark";

// ---------------------------------------------------------------------------
// The animated launch screen.
//
// A phone's own splash screen can only show a still picture (assets/images/
// splash-icon.png on green, see app.json). The moment the app starts, this covers
// it with exactly the same picture, so nothing seems to change, and then:
//   the logo slides up → "PantryGo" fades in under it → the leaf grows on the "t"
//   → once the app is ready, it all fades away.
// Plays every time the app starts fresh: opened after being swiped away, after the
// phone restarts, or after the phone closed it in the background to save memory.
// Not when you just switch back to it. Tap to skip once the app is ready.
// ---------------------------------------------------------------------------

export const SPLASH_GREEN = "#1E5C45";
export const SPLASH_IMAGE_WIDTH = 200; // must match imageWidth in app.json
const CREAM = "#F6F2E7";
const MIN_SHOW_MS = 1900; // long enough to see the leaf grow

const EASE = Easing.out(Easing.cubic);
// Set when the app's code first loads, which only happens on a fresh start (switching
// back to the app keeps it running, so this stays false and nothing replays)
let playedThisStart = false;

export function LaunchSplash({ ready }: { ready: boolean }) {
  const { height } = useWindowDimensions();
  const [gone, setGone] = useState(playedThisStart);
  const [minTimeUp, setMinTimeUp] = useState(false);

  const lift = useSharedValue(0); // 0 → 1: the logo moves up to make room
  const words = useSharedValue(0); // 0 → 1: "PantryGo" appears
  const fade = useSharedValue(1); // 1 → 0: the whole screen fades out

  // Start straight away: the phone's still splash is swapped for this one
  useEffect(() => {
    if (gone) return;
    playedThisStart = true;
    lift.value = withDelay(200, withTiming(1, { duration: 650, easing: EASE }));
    words.value = withDelay(450, withTiming(1, { duration: 450, easing: EASE }));
    const t = setTimeout(() => setMinTimeUp(true), MIN_SHOW_MS);
    return () => clearTimeout(t);
  }, [gone, lift, words]);

  // Both done (seen long enough, and the app knows where to go)? Fade out.
  useEffect(() => {
    if (!gone && ready && minTimeUp) leave();
  }, [ready, minTimeUp]);

  function leave() {
    fade.value = withTiming(0, { duration: 320, easing: EASE }, (finished) => {
      if (finished) runOnJS(setGone)(true);
    });
  }

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -70 * lift.value }, { scale: 1 - 0.12 * lift.value }],
  }));
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: 14 * (1 - words.value) }],
  }));
  const screenStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (gone) return null;

  const top = (height - SPLASH_IMAGE_WIDTH) / 2; // where the phone's splash draws it

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.screen, screenStyle]}>
      <StatusBar style="light" />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => ready && leave()}
        accessibilityLabel="PantryGo is opening"
        // Once this has drawn, the phone's own splash can go: they look the same
        onLayout={() => SplashScreen.hideAsync()}
      >
        <Animated.View style={[styles.logo, { top }, logoStyle]}>
          <Image
            source={require("../../assets/images/splash-icon.png")}
            style={{ width: SPLASH_IMAGE_WIDTH, height: SPLASH_IMAGE_WIDTH }}
            contentFit="contain"
          />
        </Animated.View>
        <Animated.View style={[styles.words, { top: top + SPLASH_IMAGE_WIDTH - 62 }, wordsStyle]}>
          <Wordmark size={46} color={CREAM} grow delay={750} onDark />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: SPLASH_GREEN, zIndex: 100 },
  logo: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  words: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
