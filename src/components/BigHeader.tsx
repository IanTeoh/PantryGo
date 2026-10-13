import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/state/AuthContext";
import { colors, fonts, radius, spacing } from "@/theme";

// A big screen title with your initial in a circle (opens your account).
// Used by tabs that hide the standard header (Home, Pantry).
export function BigHeader({ eyebrow, title }: { eyebrow?: string; title: string }) {
  // How much room the phone's status bar / notch takes at the top
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const name = (session?.user.user_metadata?.display_name as string | undefined) || "You";

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.texts}>
        {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Pressable
        onPress={() => router.push("/account")}
        style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}
        accessibilityLabel="Account"
      >
        <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  texts: { flex: 1, gap: 6 },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.textSoft,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: colors.text,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 18, color: colors.onPrimary },
});
