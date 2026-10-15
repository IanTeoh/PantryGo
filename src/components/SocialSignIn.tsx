import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useAuth } from "@/state/AuthContext";
import { colors, fonts, isDark, radius, spacing } from "@/theme";

// "Continue with Apple" (iPhone only) and "Continue with Google", under the email
// form. Both make an account the first time, and sign you in after that.
export function SocialSignIn({ onError }: { onError: (message: string | null) => void }) {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [appleReady, setAppleReady] = useState(false);
  const [busy, setBusy] = useState<"apple" | "google" | null>(null);

  // Apple's button only shows on phones that support it (iOS 13+)
  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleReady);
  }, []);

  async function run(which: "apple" | "google") {
    if (busy) return;
    onError(null);
    setBusy(which);
    const message = await (which === "apple" ? signInWithApple() : signInWithGoogle());
    setBusy(null);
    if (message) onError(message);
    // Worked: the app swaps to your pantry (or setup) by itself
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.orRow}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>

      {appleReady && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            isDark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radius.pill}
          style={styles.apple}
          onPress={() => run("apple")}
        />
      )}

      <Pressable
        onPress={() => run("google")}
        disabled={busy !== null}
        style={({ pressed }) => [styles.google, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        {busy === "google" ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <GoogleG />
            <Text style={styles.googleText}>Continue with Google</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// Google's "G", as Google's sign-in button guidelines ask for
function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  or: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  apple: { height: 52, width: "100%" },
  google: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  googleText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
});
