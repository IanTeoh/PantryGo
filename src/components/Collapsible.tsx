import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, fonts, radius, spacing } from "@/theme";
import { tick } from "@/utils/haptics";

type IconName = ComponentProps<typeof Ionicons>["name"];

// A tap-to-open section for optional parts of a form. When it's closed, `summary`
// says what's inside ("$4.50 · split 3 ways"), so you don't have to open it to check.
// The parent owns `open`, so it can open it itself (e.g. after a scan fills it in).
export function Collapsible({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: IconName;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  // The arrow turns as it opens
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [open, turn]);
  const arrow = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          tick();
          onToggle();
        }}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${summary}`}
      >
        <View style={styles.icon}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <Animated.View style={arrow}>
          <Ionicons name="chevron-down" size={20} color={colors.textSoft} />
        </Animated.View>
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(220)} style={styles.body}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card, // inputs inside are white, so they stand out
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  summary: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  // Children bring their own side padding (the same as on the page)
  body: { paddingBottom: spacing.lg, gap: spacing.md },
});
