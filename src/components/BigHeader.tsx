import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/state/AuthContext";
import { colors, fonts, spacing } from "@/theme";
import { myAvatar, myName } from "@/utils/me";

// A big screen title with your photo (or initial) in a circle (opens your account).
// Used by tabs that hide the standard header (Home, Pantry).
export function BigHeader({ eyebrow, title }: { eyebrow?: string; title: string }) {
  // How much room the phone's status bar / notch takes at the top
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const name = myName(session?.user) || "You";

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.texts}>
        {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Pressable
        onPress={() => router.push("/account")}
        style={({ pressed }) => pressed && { opacity: 0.8 }}
        accessibilityLabel="Account"
      >
        <Avatar name={name} photo={myAvatar(session?.user)} size={44} />
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
});
