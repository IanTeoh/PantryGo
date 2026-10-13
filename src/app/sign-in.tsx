import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TextInput } from "@/components/TextInput";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/state/AuthContext";
import { colors, fonts, radius, spacing } from "@/theme";

type Mode = "signIn" | "signUp" | "forgot";

export default function SignInScreen() {
  const { signIn, signUp, sendPasswordReset, linkError, clearLinkError } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); // waiting for Supabase to answer
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false); // "Check your email"

  const isSignUp = mode === "signUp";
  const isForgot = mode === "forgot";

  // Simple checks before we even ask Supabase
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim()); // something@something.something
  const passwordOk = password.length >= 6; // Supabase's minimum
  const nameOk = !isSignUp || name.trim().length > 0;
  const canSubmit = emailOk && (isForgot || passwordOk) && nameOk && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    clearLinkError();

    if (isForgot) {
      const message = await sendPasswordReset(email);
      setBusy(false);
      if (message) setError(friendlyError(message));
      else setResetSent(true);
      return;
    }

    // Wait for Supabase. If it works, the AuthProvider hears about the new session
    // and the root layout swaps this screen for the tabs. We don't navigate ourselves.
    const message = isSignUp ? await signUp(name, email, password) : await signIn(email, password);

    setBusy(false);
    if (message) setError(friendlyError(message));
  }

  function switchMode() {
    setMode(mode === "signIn" ? "signUp" : "signIn"); // from "forgot", back to sign in
    setError(null);
    setResetSent(false);
    clearLinkError();
  }

  function forgot() {
    setMode("forgot");
    setError(null);
    setResetSent(false);
    clearLinkError();
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Pushes the form up when the keyboard opens, so fields aren't hidden */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.logo}>PantryGo</Text>
            <Text style={styles.tagline}>Know what's in your kitchen. Waste less.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>
              {isForgot ? "Reset your password" : isSignUp ? "Create your account" : "Welcome back"}
            </Text>
            {isForgot && !resetSent && (
              <Text style={styles.help}>
                Enter the email you signed up with. We'll send a link that opens PantryGo so you can
                choose a new password.
              </Text>
            )}

            {isSignUp && (
              <Field label="Your name">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Ian"
                  placeholderTextColor={colors.textSoft}
                  style={styles.input}
                  autoCapitalize="words"
                  textContentType="givenName"
                />
              </Field>
            )}

            <Field label="Email">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
              />
            </Field>

            {!isForgot && (
              <Field label="Password">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textSoft}
                  style={styles.input}
                  secureTextEntry // shows dots instead of the letters
                  textContentType={isSignUp ? "newPassword" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />
              </Field>
            )}

            {!isSignUp && !isForgot && (
              <Pressable onPress={forgot} hitSlop={8} style={styles.forgot}>
                <Text style={styles.switchLink}>Forgot password?</Text>
              </Pressable>
            )}

            {(error || linkError) && <Text style={styles.error}>{error ?? linkError}</Text>}
            {resetSent && (
              <View style={styles.sent}>
                <Text style={styles.sentTitle}>Check your email</Text>
                <Text style={styles.help}>
                  If there's an account for {email.trim()}, a reset link is on its way. Open it on
                  this phone. It can take a few minutes, so check your spam folder too.
                </Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.button,
                !canSubmit && { opacity: 0.4 },
                pressed && { opacity: 0.8 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} /> // a spinning wheel while we wait
              ) : (
                <Text style={styles.buttonText}>
                  {isForgot
                    ? resetSent
                      ? "Send it again"
                      : "Send reset link"
                    : isSignUp
                      ? "Create account"
                      : "Sign in"}
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={switchMode} style={styles.switch}>
            <Text style={styles.switchText}>
              {isForgot
                ? "Remembered it? "
                : isSignUp
                  ? "Already have an account? "
                  : "New to PantryGo? "}
              <Text style={styles.switchLink}>
                {isForgot ? "Back to sign in" : isSignUp ? "Sign in" : "Create an account"}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// A label above an input. `children` = whatever is placed between <Field> and </Field>.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

// Supabase's error messages are written for developers; reword the common ones.
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match an account.";
  if (m.includes("already registered"))
    return "There's already an account with that email. Try signing in.";
  if (m.includes("email not confirmed")) return "Check your inbox and confirm your email first.";
  if (m.includes("network")) return "Couldn't reach the server. Check your internet connection.";
  if (m.includes("rate limit") || m.includes("security purposes"))
    return "Too many emails sent just now. Wait a few minutes, then try again.";
  return message;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.lg },
  brand: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  logo: { fontFamily: fonts.heading, fontSize: 40, color: colors.text },
  tagline: { fontFamily: fonts.body, fontSize: 15, color: colors.textSoft },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.urgent },
  help: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSoft },
  forgot: { alignSelf: "flex-end", marginTop: -spacing.xs },
  sent: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sentTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.primary },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  switch: { alignItems: "center", padding: spacing.sm },
  switchText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  switchLink: { fontFamily: fonts.bodyBold, color: colors.primary },
});
