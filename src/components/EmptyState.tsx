import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { FoodArt } from "@/components/FoodIcon";
import { PressableScale } from "@/components/PressableScale";
import type { FoodArtName } from "@/data/foodArt";
import { colors, fonts, radius, spacing } from "@/theme";

// A friendly "nothing here yet" card: a few food drawings, a title, a line of
// help, and up to two buttons. Used by the pantry, shopping list, recipes…
export function EmptyState({
  art,
  title,
  text,
  action,
  secondary,
  inset = false,
}: {
  art: FoodArtName[]; // 1–3 drawings; the middle one is drawn biggest
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  inset?: boolean; // add the page's side margins
}) {
  const [a, b, c] =
    art.length >= 3 ? art : art.length === 2 ? [art[0], art[1]] : [undefined, art[0]];
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.card, inset && { marginHorizontal: spacing.lg }]}
    >
      <View style={styles.art}>
        {a && (
          <View style={{ transform: [{ rotate: "-12deg" }], marginTop: 14 }}>
            <FoodArt art={a} size={40} />
          </View>
        )}
        {b && <FoodArt art={b} size={60} />}
        {c && (
          <View style={{ transform: [{ rotate: "10deg" }], marginTop: 14 }}>
            <FoodArt art={c} size={40} />
          </View>
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      {action && (
        <PressableScale onPress={action.onPress} style={styles.button}>
          <Text style={styles.buttonText}>{action.label}</Text>
        </PressableScale>
      )}
      {secondary && (
        <PressableScale onPress={secondary.onPress} style={styles.secondary}>
          <Text style={styles.secondaryText}>{secondary.label}</Text>
        </PressableScale>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: "center",
  },
  art: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.sm },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, textAlign: "center" },
  text: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSoft,
    textAlign: "center",
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  secondary: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  secondaryText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.primary },
});
