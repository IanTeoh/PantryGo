import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { FoodArt } from "@/components/FoodIcon";
import { PressableScale } from "@/components/PressableScale";
import type { FoodArtName } from "@/data/foodArt";
import { colors, fonts, radius, spacing, tints } from "@/theme";
import { tick } from "@/utils/haptics";

// ---------------------------------------------------------------------------
// The first thing a new person sees: four swipeable slides on what PantryGo does,
// then on into the setup questions. "Skip" (top right) jumps straight to setup.
// ---------------------------------------------------------------------------

type Slide = {
  art: [FoodArtName, FoodArtName, FoodArtName];
  tint: keyof typeof tints;
  badge: ComponentProps<typeof Ionicons>["name"]; // a small icon on the drawings
  title: string;
  text: string;
};

const SLIDES: Slide[] = [
  {
    art: ["carrot", "glass-of-milk", "cheese-wedge"],
    tint: "mint",
    badge: "barcode-outline",
    title: "Know what's in your kitchen",
    text: "Scan a barcode or type it in. Fridge, freezer and cupboard in one place, shared with your household.",
  },
  {
    art: ["banana", "strawberry", "bread"],
    tint: "honey",
    badge: "notifications-outline",
    title: "Use it before it goes off",
    text: "PantryGo shows what to use soon and can nudge you the day before, so less ends up in the bin.",
  },
  {
    art: ["shopping-bags", "spaghetti", "tomato"],
    tint: "sky",
    badge: "cart-outline",
    title: "Shop and cook from what you have",
    text: "Recipes show what you can make right now, and anything missing goes on one shared shopping list.",
  },
  {
    art: ["green-salad", "pancakes", "red-apple"],
    tint: "coral",
    badge: "stats-chart-outline",
    title: "Track calories and spending, if you like",
    text: "Optional extras: a private food diary, and a simple way to split grocery costs.",
  },
];

export function WelcomeSlides({
  firstName,
  onStart,
  onSkipSetup,
}: {
  firstName: string;
  onStart: () => void; // on to the setup questions
  onSkipSetup: () => void; // straight into the app
}) {
  const { width, height } = useWindowDimensions();
  const small = height < 700; // e.g. iPhone SE: smaller drawings so everything fits
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) {
      setPage(p);
      tick();
    }
  }

  function next() {
    if (last) return onStart();
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.hello} numberOfLines={1}>
          {firstName ? `Welcome, ${firstName}!` : "Welcome to PantryGo!"}
        </Text>
        {!last && (
          <Pressable onPress={onStart} hitSlop={10} accessibilityRole="button">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={styles.pages}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.page, { width }]}>
            <View
              style={[styles.art, { backgroundColor: tints[s.tint].bg }, small && { height: 150 }]}
            >
              <View style={styles.artRow}>
                <View style={styles.artSide}>
                  <FoodArt art={s.art[0]} size={58} />
                </View>
                <FoodArt art={s.art[1]} size={92} />
                <View style={styles.artSide}>
                  <FoodArt art={s.art[2]} size={58} />
                </View>
              </View>
              <View style={[styles.badge, { backgroundColor: tints[s.tint].icon }]}>
                <Ionicons name={s.badge} size={20} color={colors.white} />
              </View>
            </View>

            <Text style={[styles.title, small && styles.titleSmall]}>{s.title}</Text>
            <Text style={styles.text}>{s.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <PressableScale scaleTo={0.97} onPress={next} style={styles.button}>
          <Text style={styles.buttonText}>{last ? "Let's set up" : "Next"}</Text>
        </PressableScale>
        {/* Always the same height, so the button doesn't jump on the last slide */}
        <Pressable
          onPress={onSkipSetup}
          hitSlop={8}
          style={[styles.later, !last && { opacity: 0 }]}
          disabled={!last}
        >
          <Text style={styles.laterText}>Skip setup, I'll do it later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 40,
  },
  hello: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.textSoft },
  skip: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.textSoft },
  pages: { flex: 1 },
  page: { paddingHorizontal: spacing.lg, justifyContent: "center", gap: spacing.md },
  art: {
    height: 210,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  artRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  artSide: { marginBottom: 6 },
  badge: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: colors.text },
  titleSmall: { fontSize: 24, lineHeight: 29 },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.textSoft },
  bottom: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { width: 22, backgroundColor: colors.primary },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  later: { alignSelf: "center", paddingVertical: spacing.xs },
  laterText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.textSoft },
});
