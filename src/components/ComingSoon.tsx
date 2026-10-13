import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme";

// A friendly placeholder for tabs we haven't built yet.
// Reusable: each tab passes its own icon, title and description as props.
export function ComingSoon({
  icon,
  title,
  description,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.text,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 20,
  },
});
